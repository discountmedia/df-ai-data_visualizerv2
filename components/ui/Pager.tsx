"use client";

import type { ReactNode } from "react";

/**
 * Shared pager for long lists (priority queue, sales leaderboard). Shows the
 * visible range + Prev/Next with disabled edges. Pure/presentational — the
 * parent owns the page state and slicing.
 */
export function Pager({ page, pageCount, start, shown, total, onPage }: {
  page: number;
  pageCount: number;
  start: number;
  shown: number;
  total: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line/50 px-4 py-3">
      <p className="text-[13px] text-ink-faint">
        {total === 0 ? "0" : `${(start + 1).toLocaleString()}–${(start + shown).toLocaleString()}`} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1">
        <PageBtn disabled={page === 0} onClick={() => onPage(page - 1)}>‹ Prev</PageBtn>
        <span className="px-2 text-[13px] tabular-nums text-ink-dim">Page {page + 1} / {pageCount}</span>
        <PageBtn disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>Next ›</PageBtn>
      </div>
    </div>
  );
}

function PageBtn({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="border border-line px-2.5 py-1 text-[13px] uppercase tracking-wider text-ink-dim transition-colors enabled:hover:border-brand enabled:hover:text-ink disabled:opacity-30"
    >
      {children}
    </button>
  );
}
