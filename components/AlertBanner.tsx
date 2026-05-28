import type { MetricValue } from "@/lib/types";

export function AlertBanner({ openWorkOnSold }: { openWorkOnSold: MetricValue }) {
  if (!openWorkOnSold.available || (openWorkOnSold.value ?? 0) === 0) return null;
  return (
    <div className="card border-l-2 border-l-brand bg-brand/5 px-4 py-3 fade-up">
      <p className="flex items-center gap-2 text-sm font-bold text-brand">
        <span>⚠</span>{openWorkOnSold.value} sold units still need work completed
      </p>
      <p className="mt-1 text-xs text-ink-dim">
        These are paid-in-full or contracted units that haven&apos;t been finished. These go first.
      </p>
    </div>
  );
}
