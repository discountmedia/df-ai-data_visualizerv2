import { cn, fmt } from "@/lib/format";

export interface Segment { label: string; value: number; cls: string }

/** Pure-CSS proportional stacked bar (no recharts) + optional inline legend. */
export function DistributionBar({
  segments, total, legend,
}: { segments: Segment[]; total?: number; legend?: boolean }) {
  const sum = (total ?? segments.reduce((s, x) => s + x.value, 0)) || 1;
  return (
    <div>
      <div className="flex h-2 overflow-hidden rounded-sm bg-line/40">
        {segments.map((s) =>
          s.value > 0 ? (
            <div key={s.label} className={s.cls} style={{ width: `${(s.value / sum) * 100}%` }} title={`${s.label}: ${fmt(s.value)}`} />
          ) : null
        )}
      </div>
      {legend && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
          {segments.map((s) => (
            <span key={s.label} className="flex items-center gap-1 text-ink-dim">
              <span className={cn("inline-block h-2 w-2", s.cls)} />{s.label}
              <span className="tabular-nums text-ink">{fmt(s.value)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
