import type { MetricValue } from "@/lib/types";

/**
 * The "act first" banner on Overview. When `onClick` is provided it becomes a
 * button that drills into the exact units behind the number (the same
 * "Open Work on Sold" population the KPI card opens).
 */
export function AlertBanner({ openWorkOnSold, onClick }: { openWorkOnSold: MetricValue; onClick?: () => void }) {
  if (!openWorkOnSold.available || (openWorkOnSold.value ?? 0) === 0) return null;
  const inner = (
    <>
      <p className="flex items-center gap-2 text-sm font-bold text-brand">
        <span aria-hidden="true">⚠</span>{openWorkOnSold.value} sold units still need work completed
        {onClick && <span aria-hidden="true" className="ml-auto text-ink-dim transition-colors group-hover:text-brand">→</span>}
      </p>
      <p className="mt-1 text-[13px] text-ink-dim">
        These are paid-in-full or contracted units that haven&apos;t been finished. These go first.
      </p>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="card card-hover group block w-full border-l-2 border-l-brand bg-brand/5 px-4 py-3 text-left transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand fade-up"
      >
        {inner}
      </button>
    );
  }
  return <div className="card border-l-2 border-l-brand bg-brand/5 px-4 py-3 fade-up">{inner}</div>;
}
