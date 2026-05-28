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

export function SchemaReview() {
  const { schema, parsed, entities, usedFallback, inferenceNote, confirmSchema } = useDashboard();
  const [vetoed, setVetoed] = useState<Set<string>>(() => {
    const s = new Set<string>();
    schema?.columns.forEach((c) => { if (c.trust === "deprecated" || c.trust === "duplicate") s.add(c.name); });
    return s;
  });

  const concept = schema?.conceptMap ?? {};
  const conceptRows = useMemo(() =>
    ([["Unit name", concept.unitName], ["Serial", concept.serial], ["Location", concept.location],
      ["Work stage", concept.workStage], ["Sale type", concept.saleType], ["Payment status", concept.paymentStatus]]
      .filter(([, v]) => v) as [string, string][]), [concept]);

  if (!schema || !parsed) return null;
  const toggle = (name: string) => setVetoed((prev) => {
    const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next;
  });

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-brand">Step 1 · Inferred Schema</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Review the structure before scoring</h1>
        </div>
        <span className={cn("border px-2 py-1 text-[10px] uppercase tracking-wider",
          usedFallback ? "border-working/40 text-working" : "border-ready/40 text-ready")}>
          {usedFallback ? "Heuristic inference" : "AI inference"}
        </span>
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

      <div className="mt-6 overflow-x-auto card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-line text-ink-dim">
              <th className="px-3 py-2 font-normal">Keep</th>
              <th className="px-3 py-2 font-normal">Column</th>
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
                  <td className="px-3 py-2"><input type="checkbox" checked={!out} onChange={() => toggle(c.name)} className="accent-brand" /></td>
                  <td className="px-3 py-2 font-bold text-ink">{c.name}</td>
                  <td className="px-3 py-2 text-ink-dim">{c.detectedType}</td>
                  <td className={cn("px-3 py-2", c.nullPercent >= 70 ? "text-diag" : "text-ink-dim")}>{c.nullPercent}%</td>
                  <td className="px-3 py-2 text-ink-dim">{ROLE_LABEL[c.role] ?? c.role}</td>
                  <td className="px-3 py-2">
                    <span className={cn("border px-1.5 py-0.5 text-[10px] uppercase", TRUST_STYLE[c.trust])}>
                      {c.trust.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink-faint">{c.reason}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <p className="text-xs text-ink-faint">{schema.columns.length - vetoed.size} of {schema.columns.length} columns kept</p>
        <button onClick={() => confirmSchema({ vetoedColumns: Array.from(vetoed) })}
          className="bg-brand px-5 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-90">
          Confirm & build dashboard →
        </button>
      </div>
    </div>
  );
}
