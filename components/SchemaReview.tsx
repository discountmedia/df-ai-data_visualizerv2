"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "./DashboardProvider";
import { CategoryExplorer } from "./explore/CategoryExplorer";
import { buildCategories, resolveCategorySource, columnCategoryLabel, ROLE_LABEL } from "@/lib/categories";
import { cn } from "@/lib/format";
import type { ColumnProfile, TrustLevel } from "@/lib/types";

const TRUST_STYLE: Record<TrustLevel, string> = {
  trusted: "text-ready border-ready/40",
  low_signal: "text-working border-working/40",
  deprecated: "text-diag border-diag/40",
  duplicate: "text-govt border-govt/40",
};

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
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const categoryOf = (c: ColumnProfile) => columnCategoryLabel(c, entities);

  // Grouped categories (shared with the dashboard tabs via lib/categories).
  const categories = useMemo(() => buildCategories(schema, entities), [schema, entities]);

  const concept = schema?.conceptMap ?? {};
  const conceptRows = useMemo(() =>
    ([["Unit name", concept.unitName], ["Serial", concept.serial], ["Location", concept.location],
      ["Work stage", concept.workStage], ["Sale type", concept.saleType], ["Payment status", concept.paymentStatus]]
      .filter(([, v]) => v) as [string, string][]), [concept]);

  // Source rows + selectable columns for the currently-open category's explorer.
  // Entity categories (Email / Staff / …) read that entity's own rows; base role
  // categories read inventory rows and expose ALL base columns so connections
  // can cross fields (e.g. salesman × make), not just the clicked role's columns.
  const activeData = useMemo(() => {
    if (!activeCategory) return null;
    const cat = categories.find((c) => c.label === activeCategory);
    if (!cat) return null;
    return { label: cat.label, ...resolveCategorySource(cat, entities, schema, parsed) };
  }, [activeCategory, categories, entities, schema, parsed]);

  if (!schema || !parsed) return null;

  const toggle = (name: string) => setVetoed((prev) => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
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

      {/* Explore cards — click a category to open its charts / connection builder. */}
      <p className="mt-6 eyebrow">Categories — click a card to explore its data &amp; find connections</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => {
          const total = cat.columns.length;
          const sel = cat.columns.filter((c) => !vetoed.has(c.name)).length;
          const all = sel === total, none = sel === 0;
          const open = activeCategory === cat.label;
          return (
            <button
              key={cat.label}
              type="button"
              onClick={() => setActiveCategory(open ? null : cat.label)}
              aria-expanded={open}
              className={cn(
                "card card-hover p-3 text-left transition-colors",
                open ? "border-brand bg-brand/10" : "border-line",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="eyebrow truncate text-ink">{cat.label}</p>
                <span className={cn("text-[11px] leading-none", open ? "text-brand" : "text-ink-faint")}>
                  {open ? "▾" : "▸"}
                </span>
              </div>
              <p className={cn("mt-1 text-sm tabular-nums",
                all ? "text-ready" : none ? "text-ink-dim" : "text-working")}>
                {sel}/{total} <span className="text-[10px] text-ink-faint">included</span>
              </p>
              <p className="text-[10px] text-ink-faint">{open ? "exploring ↓" : "click to explore"}</p>
            </button>
          );
        })}
      </div>

      {activeData && (
        <CategoryExplorer
          key={activeData.label}
          label={activeData.label}
          sourceKey={activeData.sourceKey}
          rows={activeData.rows}
          columns={activeData.columns}
          defaultDimension={activeData.defaultDimension}
          onClose={() => setActiveCategory(null)}
        />
      )}

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
