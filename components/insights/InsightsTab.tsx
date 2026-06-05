"use client";

import type { ScoringResult, PriorityTier } from "@/lib/types";
import { TIER_LABEL, TIER_PILL } from "@/lib/buckets";
import { cn, fmt } from "@/lib/format";

const TIERS: PriorityTier[] = ["act_now", "high", "medium", "low"];

/**
 * Deterministic "how the priority queue was scored" explainer. The AI read now
 * lives in the opt-in AiAnalysisCard (per tab) + AiAnalysisModal (header button);
 * this card is the audit trail for the scoring engine — no AI, same every time.
 */
export function InsightsTab({ scoring }: { scoring: ScoringResult }) {
  return (
    <section className="card p-4 fade-up">
      <h2 className="eyebrow">How Scores Were Calculated</h2>
      <p className="mt-1 text-[13px] text-ink-faint">
        Priority is computed deterministically — no AI ranks any unit. Same export, same order, every time.
      </p>

      <div className="mt-3 space-y-1.5">
        {scoring.methodology.map((m, i) => (
          <p key={i} className="text-[13px] leading-relaxed text-ink-dim">· {m}</p>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-y border-line text-ink-dim">
              <th className="px-3 py-2 font-normal">Rule</th>
              <th className="w-16 px-3 py-2 text-right font-normal">Points</th>
              <th className="px-3 py-2 font-normal">When it fires</th>
            </tr>
          </thead>
          <tbody>
            {scoring.rules.map((r) => (
              <tr key={r.key} className="border-b border-line/50 align-top">
                <td className="px-3 py-2 font-bold text-ink">{r.label}</td>
                <td className="px-3 py-2 text-right font-bold tabular-nums text-ready">+{r.points}</td>
                <td className="px-3 py-2 text-ink-dim">{r.when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <h3 className="eyebrow mb-2">Queue by tier</h3>
        <TierBar scoring={scoring} />
        <div className="mt-2 flex flex-wrap gap-3 text-[13px]">
          {TIERS.map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className={cn("inline-block border px-1.5 py-0.5 text-[12px] uppercase", TIER_PILL[t])}>{TIER_LABEL[t]}</span>
              <span className="tabular-nums text-ink-dim">{fmt(scoring.tierCounts[t])}</span>
            </span>
          ))}
          <span className="ml-auto text-ink-faint">{fmt(scoring.scoredCount)} of {fmt(scoring.totalUnits)} units queued</span>
        </div>
      </div>
    </section>
  );
}

const TIER_FILL: Record<PriorityTier, string> = {
  act_now: "bg-brand",
  high: "bg-diag",
  medium: "bg-working",
  low: "bg-ink-faint",
};

function TierBar({ scoring }: { scoring: ScoringResult }) {
  const total = scoring.scoredCount || 1;
  return (
    <div className="flex h-2 overflow-hidden rounded-sm bg-panel-2">
      {TIERS.map((t) => {
        const v = scoring.tierCounts[t];
        if (!v) return null;
        return <div key={t} className={TIER_FILL[t]} style={{ width: `${(v / total) * 100}%` }} title={`${TIER_LABEL[t]}: ${v}`} />;
      })}
    </div>
  );
}
