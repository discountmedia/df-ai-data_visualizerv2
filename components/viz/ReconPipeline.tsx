"use client";

import type { WorkBucket } from "@/lib/types";
import { WORK_LABEL, WORK_HEX } from "@/lib/buckets";
import { cn } from "@/lib/format";

/**
 * The recon pipeline as a progress story, not a flat bar chart. Reads left→right
 * as the journey a unit takes to revenue: intake → shop → sale-ready → deployed.
 * The single "journey bar" shows where the whole fleet sits on that path; the
 * stage rows show the pile-up (and flag the bottleneck holding units back).
 */

const STAGES: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];

const STAGE_NOTE: Record<string, string> = {
  needs_diagnosis: "intake — not yet assessed",
  working: "in the shop",
  ready: "diagnosed, serviced, signed off",
  on_rent: "deployed — earning",
  sold: "closed",
};

export function ReconPipeline({ counts }: { counts: Map<WorkBucket, number> }) {
  const get = (b: WorkBucket) => counts.get(b) ?? 0;
  const total = STAGES.reduce((s, b) => s + get(b), 0) || 1;
  const max = Math.max(...STAGES.map(get), 1);
  const ready = get("ready");
  const inRecon = get("needs_diagnosis") + get("working");
  // The bottleneck is whichever pre-ready stage is holding the most units.
  const bottleneck: WorkBucket = get("needs_diagnosis") >= get("working") ? "needs_diagnosis" : "working";
  const pct = (v: number) => Math.round((v / total) * 100);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="eyebrow">Recon Pipeline</p>
        <p className="text-[11px] text-ink-faint">
          {total.toLocaleString()} units · intake → sale-ready → deployed
        </p>
      </div>

      {/* Journey bar — the whole fleet's position on the path to revenue. */}
      <div className="mt-3 flex h-3 overflow-hidden rounded-sm bg-panel-2">
        {STAGES.map((b) => {
          const v = get(b);
          if (!v) return null;
          return (
            <div
              key={b}
              style={{ width: `${(v / total) * 100}%`, backgroundColor: WORK_HEX[b] }}
              title={`${WORK_LABEL[b]}: ${v.toLocaleString()}`}
            />
          );
        })}
      </div>

      {/* Per-stage pile-up. */}
      <div className="mt-4 space-y-2.5">
        {STAGES.map((b) => {
          const v = get(b);
          return (
            <div key={b} className="flex items-center gap-3">
              <div className="w-28 shrink-0 text-right sm:w-32">
                <p className="text-xs font-bold text-ink">{WORK_LABEL[b]}</p>
                <p className="hidden text-[10px] leading-tight text-ink-faint sm:block">{STAGE_NOTE[b]}</p>
              </div>
              <div className="relative h-6 flex-1 overflow-hidden rounded-sm bg-panel-2">
                <div
                  className="h-full rounded-sm transition-[width] duration-500"
                  style={{ width: `${(v / max) * 100}%`, backgroundColor: WORK_HEX[b], opacity: 0.85 }}
                />
                {b === bottleneck && v > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold uppercase tracking-wider text-ink">
                    ◂ bottleneck
                  </span>
                )}
              </div>
              <div className="w-16 shrink-0 text-right sm:w-20">
                <span className="font-display text-lg leading-none tabular-nums text-ink">{v.toLocaleString()}</span>
                <span className="ml-1 text-[10px] text-ink-faint">{pct(v)}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Headline progress metrics. */}
      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-line/50 pt-3">
        <Metric label="Sale-ready" value={`${pct(ready)}%`} sub={`${ready.toLocaleString()} units`} accent="text-ready" />
        <Metric label="Still in recon" value={`${pct(inRecon)}%`} sub={`${inRecon.toLocaleString()} units`} accent="text-working" />
        <Metric label="Bottleneck" value={WORK_LABEL[bottleneck]} sub={`${get(bottleneck).toLocaleString()} waiting`} accent="text-diag" />
      </div>
    </section>
  );
}

function Metric({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-1 font-display text-xl leading-none tabular-nums sm:text-2xl", accent)}>{value}</p>
      <p className="mt-1 text-[10px] text-ink-faint">{sub}</p>
    </div>
  );
}
