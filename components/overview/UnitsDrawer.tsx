"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { UnitRecord } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import { WorkPill, SalePill } from "@/components/ui/Pills";
import { Pager } from "@/components/ui/Pager";
import { SortHeader } from "@/components/ui/SortHeader";

const PAGE = 25;
type SortKey = "serial" | "unit" | "spec" | "location" | "stage" | "sale" | "price";
const sortText = (u: UnitRecord, k: SortKey): string => {
  switch (k) {
    case "serial": return u.serial4 ?? "";
    case "unit": return u.forkliftName ?? u.name ?? "";
    case "spec": return [u.year, u.make, u.type].filter(Boolean).join(" ");
    case "location": return u.location ?? "";
    case "stage": return u.work;
    default: return u.sale;
  }
};

/**
 * Full-screen drill-down: the actual units behind a clicked KPI card. Searchable
 * and paged 25-at-a-time so even "Total Fleet" stays usable. Read-only — this is
 * the audit trail for a headline number, nothing computes here.
 */
export function UnitsDrawer({ title, units, onClose }: { title: string; units: UnitRecord[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [asc, setAsc] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => setPage(0), [q, sortKey, asc]);
  // Capture the opener (e.g. the MetricCard button) once on mount and return
  // focus to it on unmount, so closing doesn't dump the user at the top of the
  // document (WCAG 2.4.3).
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    return () => triggerRef.current?.focus?.();
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !dialog) return;
      // Trap Tab/Shift+Tab inside the dialog so focus can't reach the
      // visually-hidden background page (WCAG 2.4.3 / 2.1.2).
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (focusable.length === 0) { e.preventDefault(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !dialog.contains(active)) { e.preventDefault(); last.focus(); }
      } else if (active === last || !dialog.contains(active)) {
        e.preventDefault(); first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = !needle ? units : units.filter((u) =>
      [u.serial4, u.serial, u.forkliftName, u.name, u.make, u.model, u.type, u.year, u.location, u.customer]
        .filter(Boolean).join(" ").toLowerCase().includes(needle)
    );
    if (!sortKey) return filtered; // no active sort → preserve the order passed in
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) =>
      sortKey === "price"
        ? ((a.price ?? -Infinity) - (b.price ?? -Infinity)) * dir
        : sortText(a, sortKey).localeCompare(sortText(b, sortKey)) * dir
    );
  }, [units, q, sortKey, asc]);

  const onSort = (k: SortKey) => {
    if (k === sortKey) setAsc((v) => !v);
    else { setSortKey(k); setAsc(k === "price" ? false : true); } // text asc, price desc by default
  };

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = rows.slice(start, start + PAGE);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="units-drawer-title">
      <div className="mx-auto flex h-full max-w-6xl flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div>
            <p id="units-drawer-title" className="eyebrow text-brand">{title}</p>
            <p className="mt-1 text-sm text-ink-dim">{rows.length.toLocaleString()} {rows.length === 1 ? "unit" : "units"}{q ? ` matching “${q}”` : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 border border-line px-3 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink"
          >
            ✕ Close
          </button>
        </div>

        <div className="relative my-3 w-full sm:w-80">
          <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">⌕</span>
          <input
            autoFocus
            aria-label="Search units"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search unit, serial, make, customer…"
            className="w-full border border-line bg-panel-2 py-1.5 pl-7 pr-7 text-[13px] text-ink placeholder:text-ink-dim focus:border-brand"
          />
          {q && (
            <button onClick={() => setQ("")} aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint hover:text-ink">✕</button>
          )}
        </div>

        <div className="card flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-[13px]">
              <thead className="sticky top-0 z-10 bg-panel">
                <tr className="border-b border-line text-ink-dim">
                  <SortHeader label="Serial" k="serial" cur={sortKey} asc={asc} onSort={onSort} />
                  <SortHeader label="Unit" k="unit" cur={sortKey} asc={asc} onSort={onSort} />
                  <SortHeader label="Year · Make · Type" k="spec" cur={sortKey} asc={asc} onSort={onSort} />
                  <SortHeader label="Location" k="location" cur={sortKey} asc={asc} onSort={onSort} />
                  <SortHeader label="Stage" k="stage" cur={sortKey} asc={asc} onSort={onSort} />
                  <SortHeader label="Sale" k="sale" cur={sortKey} asc={asc} onSort={onSort} />
                  <SortHeader label="Price" k="price" cur={sortKey} asc={asc} onSort={onSort} num />
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
