"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScoringResult, UnitRecord, SalesSummary, InsightsResult, Insight, InsightSeverity } from "@/lib/types";
import { buildInsightsInput, fetchInsights } from "@/lib/insightsClient";
import { TIER_LABEL, TIER_PILL } from "@/lib/buckets";
import { cn, fmt } from "@/lib/format";
import type { PriorityTier } from "@/lib/types";

const SEVERITY: Record<InsightSeverity, { dot: string; label: string }> = {
  act: { dot: "bg-brand", label: "Act" },
  watch: { dot: "bg-working", label: "Watch" },
  info: { dot: "bg-rent", label: "Info" },
};

const TIERS: PriorityTier[] = ["act_now", "high", "medium", "low"];

export function InsightsTab({ scoring, units, sales }:
  { scoring: ScoringResult; units: UnitRecord[]; sales: SalesSummary | null }) {
  const input = useMemo(() => buildInsightsInput(scoring, units, sales), [scoring, units, sales]);
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInsights(input).then((r) => {
      if (!cancelled) {
        setResult(r);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [input, nonce]);

  return (
    <div className="space-y-5 fade-up">
      {/* AI narrative */}
      <section className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">AI Insights</p>
          <div className="flex items-center gap-2">
            {result && (
              <span
                className={cn(
                  "border px-2 py-0.5 text-[10px] uppercase tracking-wider",
                  result.source === "claude" ? "border-ready/40 text-ready" : "border-working/40 text-working"
                )}
              >
                {result.source === "claude" ? "AI" : "rule-based"}
              </span>
            )}
            <button
              onClick={() => setNonce((n) => n + 1)}
              disabled={loading}
              className="border border-line px-3 py-1 text-[11px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink disabled:opacity-40"
            >
              {loading ? "Reading…" : "Regenerate"}
            </button>
          </div>
        </div>

        {loading && !result ? (
          <p className="mt-3 text-sm text-ink-faint">Reading the fleet…</p>
        ) : result ? (
          <>
            {result.summary && <p className="mt-3 text-sm leading-relaxed text-ink">{result.summary}</p>}
            {result.note && <p className="mt-2 text-[11px] text-ink-faint">{result.note}</p>}
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {result.insights.map((ins, i) => (
                <InsightCard key={i} insight={ins} />
              ))}
            </div>
            {result.insights.length === 0 && (
              <p className="mt-3 text-[11px] text-ink-faint">No specific insights surfaced for this snapshot.</p>
            )}
          </>
        ) : null}
      </section>

      {/* Deterministic methodology */}
      <section className="card p-4">
        <p className="eyebrow">How Scores Were Calculated</p>
        <p className="mt-1 text-[11px] text-ink-faint">
          Priority is computed deterministically — no AI ranks any unit. Same export, same order, every time.
        </p>

        <div className="mt-3 space-y-1.5">
          {scoring.methodology.map((m, i) => (
            <p key={i} className="text-[11px] leading-relaxed text-ink-dim">· {m}</p>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
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
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-ready">+{r.points}</td>
                  <td className="px-3 py-2 text-ink-faint">{r.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Tier distribution */}
        <div className="mt-4">
          <p className="eyebrow mb-2">Queue by tier</p>
          <TierBar scoring={scoring} />
          <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
            {TIERS.map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className={cn("inline-block border px-1.5 py-0.5 text-[10px] uppercase", TIER_PILL[t])}>{TIER_LABEL[t]}</span>
                <span className="tabular-nums text-ink-dim">{fmt(scoring.tierCounts[t])}</span>
              </span>
            ))}
            <span className="ml-auto text-ink-faint">{fmt(scoring.scoredCount)} of {fmt(scoring.totalUnits)} units queued</span>
          </div>
        </div>
      </section>
    </div>
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

function InsightCard({ insight }: { insight: Insight }) {
  const s = SEVERITY[insight.severity];
  return (
    <div className="border border-line bg-panel-2 p-3">
      <p className="flex items-center gap-2 text-xs font-bold text-ink">
        <span className={cn("inline-block h-2 w-2 rounded-full", s.dot)} />
        {insight.title}
      </p>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-dim">{insight.body}</p>
    </div>
  );
}
