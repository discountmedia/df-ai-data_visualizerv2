"use client";

import { useEffect, useRef, useState } from "react";
import type { PrioritizeResult } from "@/lib/prioritizeClient";
import { fmtMoney } from "@/lib/format";
import { WorkPill, SalePill } from "@/components/ui/Pills";
import { Pager } from "@/components/ui/Pager";

const PAGE = 25;

/**
 * Opt-in AI re-ranking of the work queue. The owner explicitly chose to let the
 * model decide priority order here (the deterministic queue remains the default).
 * Read-only: every unit's data is real; AI only chooses the ORDER and the reason.
 */
export function AiPriorityDrawer({ result, loading, onClose, onRegenerate }:
  { result: PrioritizeResult | null; loading: boolean; onClose: () => void; onRegenerate: () => void }) {
  const [page, setPage] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    return () => triggerRef.current?.focus?.();
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !dialog) return;
      const f = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )).filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0], last = f[f.length - 1], a = document.activeElement as HTMLElement | null;
      if (e.shiftKey) { if (a === first || !dialog.contains(a)) { e.preventDefault(); last.focus(); } }
      else if (a === last || !dialog.contains(a)) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ranked = result?.ranked ?? [];
  const pageCount = Math.max(1, Math.ceil(ranked.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = ranked.slice(start, start + PAGE);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-50 bg-ground/95 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ai-priority-title">
      <div className="mx-auto flex h-full max-w-5xl flex-col px-5 py-5">
        <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div className="min-w-0">
            <p id="ai-priority-title" className="eyebrow text-brand">✦ AI Smart Priority</p>
            <p className="mt-1 text-sm text-ink-dim">
              {loading && !result ? "Claude is re-ranking the queue…" : `${ranked.length} units re-ranked${result ? (result.source === "claude" ? " · Claude" : " · rule-based") : ""}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {result && (
              <button onClick={onRegenerate} disabled={loading}
                className="border border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink disabled:opacity-40">
                {loading ? "…" : "↻ Re-run"}
              </button>
            )}
            <button onClick={onClose}
              className="border border-line px-3 py-1.5 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink">
              ✕ Close
            </button>
          </div>
        </div>

        {result?.note && <p className="mt-3 text-[11px] text-working">{result.note}</p>}
        {result?.strategy && (
          <p className="mt-3 text-sm leading-relaxed text-ink"><span className="font-bold text-brand">Strategy</span> — {result.strategy}</p>
        )}

        {loading && !result ? (
          <p className="mt-6 text-sm text-ink-faint">Reading the queue and deciding what to work first…</p>
        ) : (
          <div className="card mt-3 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-panel">
                  <tr className="border-b border-line text-ink-dim">
                    <th scope="col" className="px-3 py-2 font-normal">#</th>
                    <th scope="col" className="px-3 py-2 font-normal">Unit</th>
                    <th scope="col" className="px-3 py-2 font-normal">Why AI ranked it here</th>
                    <th scope="col" className="px-3 py-2 font-normal">Stage</th>
                    <th scope="col" className="px-3 py-2 font-normal">Sale</th>
                    <th scope="col" className="px-3 py-2 text-right font-normal">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r, i) => {
                    const u = r.scored.unit;
                    const title = [u.serial4 ? `#${u.serial4}` : null, u.forkliftName ?? u.name].filter(Boolean).join(" ") || "Unit";
                    const spec = [u.year, u.make, u.type].filter(Boolean).join(" · ");
                    return (
                      <tr key={u.rowIndex} className="border-b border-line/40 align-top hover:bg-panel-2">
                        <td className="px-3 py-2 tabular-nums text-ink-faint">{start + i + 1}</td>
                        <td className="px-3 py-2">
                          <span className="font-bold text-ink">{title}</span>
                          {(spec || u.location) && <span className="block text-[10px] text-ink-faint">{[spec, u.location].filter(Boolean).join(" · ")}</span>}
                        </td>
                        <td className="px-3 py-2 text-ink-dim">{r.reason}</td>
                        <td className="px-3 py-2"><WorkPill work={u.work} /></td>
                        <td className="px-3 py-2"><SalePill sale={u.sale} /></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-pif">{u.price != null ? fmtMoney(u.price) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager page={clampedPage} pageCount={pageCount} start={start} shown={shown.length} total={ranked.length} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
