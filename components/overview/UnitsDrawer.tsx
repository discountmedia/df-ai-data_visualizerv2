"use client";

import { useEffect, useMemo, useState } from "react";
import type { UnitRecord } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import { WorkPill, SalePill } from "@/components/ui/Pills";
import { Pager } from "@/components/ui/Pager";

const PAGE = 25;

/**
 * Full-screen drill-down: the actual units behind a clicked KPI card. Searchable
 * and paged 25-at-a-time so even "Total Fleet" stays usable. Read-only — this is
 * the audit trail for a headline number, nothing computes here.
 */
export function UnitsDrawer({ title, units, onClose }: { title: string; units: UnitRecord[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return units;
    return units.filter((u) =>
      [u.serial4, u.serial, u.forkliftName, u.name, u.make, u.model, u.type, u.year, u.location, u.customer]
        .filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
  }, [units, q]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = rows.slice(start, start + PAGE);

  return (
    <div className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <p className="eyebrow text-brand">{title}</p>
            <p className="mt-1 text-sm text-ink-dim">{rows.length.toLocaleString()} {rows.length === 1 ? "unit" : "units"}{q ? ` matching “${q}”` : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 border border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink"
          >
            ✕ Close
          </button>
        </div>

        <div className="relative my-3 w-full sm:w-80">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">⌕</span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search unit, serial, make, customer…"
            className="w-full border border-line bg-panel-2/60 py-1.5 pl-7 pr-7 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink">✕</button>
          )}
        </div>

        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr className="border-b border-line text-ink-dim">
                  <th className="px-3 py-2 font-normal">Serial</th>
                  <th className="px-3 py-2 font-normal">Unit</th>
                  <th className="px-3 py-2 font-normal">Year · Make · Type</th>
                  <th className="px-3 py-2 font-normal">Location</th>
                  <th className="px-3 py-2 font-normal">Stage</th>
                  <th className="px-3 py-2 font-normal">Sale</th>
                  <th className="px-3 py-2 text-right font-normal">Price</th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-ink-faint">No units match “{q}”.</td></tr>
                ) : (
                  shown.map((u) => (
                    <tr key={u.rowIndex} className="border-b border-line/40 hover:bg-panel-2">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-dim">{u.serial4 ? `#${u.serial4}` : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 font-bold text-ink">{u.forkliftName ?? u.name ?? "—"}</td>
                      <td className="px-3 py-2 text-ink-dim">{[u.year, u.make, u.type].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink-dim">{u.location ?? "—"}</td>
                      <td className="px-3 py-2"><WorkPill work={u.work} /></td>
                      <td className="px-3 py-2"><SalePill sale={u.sale} /></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-pif">{u.price != null ? fmtMoney(u.price) : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager page={clampedPage} pageCount={pageCount} start={start} shown={shown.length} total={rows.length} onPage={setPage} />
        </div>
      </div>
    </div>
  );
}
