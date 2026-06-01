"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "./DashboardProvider";
import { cn } from "@/lib/format";
import type { ColumnProfile, TrustLevel } from "@/lib/types";

const TRUST_STYLE: Record<TrustLevel, string> = {
  trusted: "text-ready border-ready/40",
  low_signal: "text-working border-working/40",
  deprecated: "text-diag border-diag/40",
  duplicate: "text-govt border-govt/40",
};
const ROLE_LABEL: Record<string, string> = {
  identifier: "ID", location: "Location", work_stage: "Work Stage", sale_type: "Sale Type",
  payment_status: "Payment", flag: "Flag", metric: "Metric", date: "Date", other: "Other",
};
// Display order for the base (un-prefixed) role categories. Entity categories
// (Email / Staff / Round Robin …) are appended after, in detection order.
const ROLE_ORDER = [
  "identifier", "location", "work_stage", "sale_type",
  "payment_status", "metric", "flag", "date", "other",
];

interface Category {
  label: string;
  columns: ColumnProfile[];
}

export function SchemaReview() {
  const { schema, parsed, entities, usedFallback, inferenceNote, confirmSchema } = useDashboard();

  // The schema is what makes a column "deprecated"/"duplicate" → un-checked by
  // default. We track *exclusions* (vetoed) so the confirm payload is unchanged.
  const makeSuggested = () => {
    const s = new Set<string>();
    schema?.columns.forEach((c) => {
      if (c.trust === "deprecated" || c.trust === "duplicate") s.add(c.name);
    });
    return s;
  };
  const [vetoed, setVetoed] = useState<Set<string>>(makeSuggested);

  // column name -> entity label (only for prefixed columns like `email::…`).
  const colEntity = useMemo(() => {
    const m = new Map<string, string>();
    entities?.related.forEach((e) => e.columns.forEach((c) => m.set(c, e.label)));
    return m;
  }, [entities]);

  const categoryOf = (c: ColumnProfile) =>
    colEntity.get(c.name) ?? ROLE_LABEL[c.role] ?? c.role;

  // Grouped categories in display order: base roles first, then entities.
  const categories = useMemo<Category[]>(() => {
    const groups = new Map<string, ColumnProfile[]>();
    for (const c of schema?.columns ?? []) {
      const cat = colEntity.get(c.name) ?? ROLE_LABEL[c.role] ?? c.role;
      (groups.get(cat) ?? groups.set(cat, []).get(cat)!).push(c);
    }
    const ordered: Category[] = [];
    for (const role of ROLE_ORDER) {
      const label = ROLE_LABEL[role];
      if (groups.has(label)) { ordered.push({ label, columns: groups.get(label)! }); groups.delete(label); }
    }
    entities?.related.forEach((e) => {
      if (groups.has(e.label)) { ordered.push({ label: e.label, columns: groups.get(e.label)! }); groups.delete(e.label); }
    });
    for (const [label, columns] of groups) ordered.push({ label, columns }); // any leftovers
    return ordered;
  }, [schema, entities, colEntity]);

  const concept = schema?.conceptMap ?? {};
  const conceptRows = useMemo(() =>
    ([["Unit name", concept.unitName], ["Serial", concept.serial], ["Location", concept.location],
      ["Work stage", concept.workStage], ["Sale type", concept.saleType], ["Payment status", concept.paymentStatus]]
      .filter(([, v]) => v) as [string, string][]), [concept]);

  if (!schema || !parsed) return null;

  const toggle = (name: string) => setVetoed((prev) => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
  });

  // Batch toggle a whole category: if all currently included → exclude all, else include all.
  const toggleCategory = (cat: Category) => setVetoed((prev) => {
    const next = new Set(prev);
    const allIn = cat.columns.every((c) => !next.has(c.name));
    cat.columns.forEach((c) => (allIn ? next.add(c.name) : next.delete(c.name)));
    return next;
  });

  const selectAll = () => setVetoed(new Set());
  const clearAll = () => setVetoed(new Set(schema.columns.map((c) => c.name)));
  const resetSuggested = () => setVetoed(makeSuggested());

  const keptCount = schema.columns.length - vetoed.size;

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 pb-24 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-brand">Step 2 of 2 · Choose Your Data</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Select the data sources to include</h1>
        </div>
        <span className={cn("border px-2 py-1 text-[10px] uppercase tracking-wider",
          usedFallback ? "border-working/40 text-working" : "border-ready/40 text-ready")}>
          {usedFallback ? "Heuristic inference" : "AI inference"}
        </span>
      </div>

      <div className="mt-4 card border-l-4 border-l-brand bg-brand/10 p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="text-brand">➜</span> This is the only setup step — pick which columns the dashboard should use.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-dim">
          Every <span className="font-bold text-ready">checked</span> column below becomes a data source for your
          dashboard. We&apos;ve <span className="font-bold text-ready">pre-checked the trustworthy ones</span> and{" "}
          <span className="font-bold text-diag">un-checked likely junk</span> (empty / duplicate columns). Use the{" "}
          <span className="font-bold text-ink">category cards</span> to batch-select a whole group, or toggle columns
          one at a time in the table — then press <span className="font-bold text-brand">Confirm &amp; build dashboard</span>.
        </p>
      </div>

      {entities && entities.related.length > 0 && (
        <div className="mt-4 card border-rent/30 bg-rent/5 p-3">
          <p className="text-xs text-rent">
            Detected {entities.related.length + 1} stacked tables in this sheet.
            Inventory rows: {entities.base.rowCount.toLocaleString()}.
          </p>
          <p className="mt-1 text-[11px] text-ink-dim">
            {entities.related.map((e) => `${e.label} (${e.rowCount.toLocaleString()})`).join(" · ")}
          </p>
        </div>
      )}

      {(inferenceNote || schema.warnings.length > 0) && (
        <div className="mt-3 card border-working/30 bg-working/5 p-3">
          {inferenceNote && <p className="text-xs text-working">{inferenceNote}</p>}
          {schema.warnings.map((w, i) => <p key={i} className="text-xs text-ink-dim">· {w}</p>)}
        </div>
      )}

      {conceptRows.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {conceptRows.map(([label, col]) => (
            <div key={label} className="card p-3">
              <p className="eyebrow">{label}</p>
              <p className="mt-1 truncate text-sm text-ink" title={col}>{col}</p>
            </div>
          ))}
        </div>
      )}

      {/* Batch-select cards — click a category to toggle every column in it. */}
      <p className="mt-6 eyebrow">Categories — click a card to select / deselect the whole group</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => {
          const total = cat.columns.length;
          const sel = cat.columns.filter((c) => !vetoed.has(c.name)).length;
          const all = sel === total, none = sel === 0;
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => toggleCategory(cat)}
              aria-pressed={all}
              className={cn(
                "card card-hover p-3 text-left transition-colors",
                all ? "border-ready/50 bg-ready/5" : none ? "border-line" : "border-working/50 bg-working/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow truncate text-ink">{cat.label}</p>
                <span className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] leading-none",
                  all ? "border-ready bg-ready/20 text-ready"
                    : none ? "border-line text-transparent" : "border-working text-working",
                )}>
                  {all ? "✓" : none ? "" : "–"}
                </span>
              </div>
              <p className={cn("mt-1 text-sm tabular-nums",
                all ? "text-ready" : none ? "text-ink-dim" : "text-working")}>
                {sel}/{total}
              </p>
              <p className="text-[10px] text-ink-faint">
                {all ? "all selected" : none ? "none selected" : "partial"}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow">Data sources — check the columns to include</p>
        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider">
          <button onClick={selectAll} className="text-ink-dim hover:text-ready">Select all</button>
          <span className="text-ink-faint">·</span>
          <button onClick={clearAll} className="text-ink-dim hover:text-diag">Clear all</button>
          <span className="text-ink-faint">·</span>
          <button onClick={resetSuggested} className="text-ink-dim hover:text-ink">Reset to suggested</button>
        </div>
      </div>

      <div className="mt-2 overflow-x-auto card">
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-line text-ink-dim">
              <th className="px-3 py-2 font-normal">Incl.</th>
              <th className="px-3 py-2 font-normal">Column</th>
              <th className="px-3 py-2 font-normal">Category</th>
              <th className="px-3 py-2 font-normal">Type</th>
              <th className="px-3 py-2 font-normal">Null %</th>
              <th className="px-3 py-2 font-normal">Role</th>
              <th className="px-3 py-2 font-normal">Trust</th>
              <th className="px-3 py-2 font-normal">Why</th>
            </tr>
          </thead>
          <tbody>
            {schema.columns.map((c: ColumnProfile) => {
              const out = vetoed.has(c.name);
              return (
                <tr key={c.name} className={cn("border-b border-line/50", out && "opacity-40")}>
                  <td className="px-3 py-1.5">
                    <input type="checkbox" checked={!out} onChange={() => toggle(c.name)} className="accent-brand" />
                  </td>
                  <td className="px-3 py-1.5 font-medium text-ink">{c.name}</td>
                  <td className="px-3 py-1.5 text-ink-dim">{categoryOf(c)}</td>
                  <td className="px-3 py-1.5 text-ink-dim">{c.detectedType}</td>
                  <td className={cn("px-3 py-1.5 tabular-nums", c.nullPercent >= 70 ? "text-diag" : "text-ink-dim")}>{c.nullPercent}%</td>
                  <td className="px-3 py-1.5 text-ink-dim">{ROLE_LABEL[c.role] ?? c.role}</td>
                  <td className="px-3 py-1.5">
                    <span className={cn("border px-1.5 py-0.5 text-[10px] uppercase", TRUST_STYLE[c.trust])}>
                      {c.trust.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-ink-faint">
                    <div className="max-w-[240px] truncate" title={c.reason}>{c.reason}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-panel/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <p className="text-xs text-ink-dim">
            <span className="font-bold text-ready">{keptCount}</span> of {schema.columns.length} columns selected
          </p>
          <button onClick={() => confirmSchema({ vetoedColumns: Array.from(vetoed) })}
            className="bg-brand px-5 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90">
            Confirm &amp; build dashboard →
          </button>
        </div>
      </div>
    </div>
  );
}
