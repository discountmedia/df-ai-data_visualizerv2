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
  const [loading, setLoading] = useState(false);
  // Opt-in: nothing is sent to any model until the operator clicks Run (nonce > 0).
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (nonce === 0) return;
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
    // Re-runs only on explicit Run/Regenerate — never automatically on filter change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

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
              className={cn(
                "px-3 py-1 text-[11px] uppercase tracking-wider transition-opacity disabled:opacity-40",
                nonce === 0
                  ? "bg-brand font-bold text-white hover:opacity-90"
                  : "border border-line text-ink-dim hover:border-brand hover:text-ink"
              )}
            >
              {loading ? "Reading…" : nonce === 0 ? "⚡ Run AI Analysis" : "Regenerate"}
            </button>
          </div>
        </div>

        {loading && !result ? (
          <p className="mt-3 text-sm text-ink-faint">Reading the fleet…</p>
        ) : !result ? (
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            AI analysis is <span className="text-ink">off by default</span>. Click{" "}
            <span className="text-brand">Run AI Analysis</span> to have Claude, Grok &amp; GPT read this fleet
            and surface what needs attention. Nothing is sent to any model until you ask.
          </p>
        ) : (
          (() => {
            const reads = [
              { key: "claude", label: "Claude", sub: "primary read", accent: "ready" as const, summary: result.summary, insights: result.insights, note: result.note },
              ...(result.others ?? []).map((o) => ({
                key: o.source, label: o.source === "grok" ? "Grok" : "GPT",
                sub: `2nd opinion · ${o.model}`, accent: "rent" as const,
                summary: o.summary, insights: o.insights, note: undefined as string | undefined,
              })),
            ];
            const cols = reads.length >= 3 ? "lg:grid-cols-3" : reads.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-1";
            const errs = result.othersErrors ? Object.entries(result.othersErrors) : [];
            return (
              <>
                <div className={cn("mt-4 grid grid-cols-1 gap-4", cols)}>
                  {reads.map((r) => (
                    <ReadColumn key={r.key} label={r.label} sub={r.sub} accent={r.accent} summary={r.summary} insights={r.insights} note={r.note} />
                  ))}
                </div>
                {reads.length > 1 && (
                  <p className="mt-3 text-[11px] text-ink-faint">
                    {reads.length} independent reads — where they diverge, look closer. That&apos;s the signal.
                  </p>
                )}
                {errs.length > 0 && (
                  <p className="mt-1 text-[10px] text-ink-faint">Unavailable: {errs.map(([k, v]) => `${k} — ${v}`).join(" · ")}</p>
                )}
              </>
            );
          })()
        )}
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

function ReadColumn({
  label, sub, accent, summary, insights, note,
}: {
  label: string; sub: string; accent: "ready" | "rent";
  summary: string; insights: Insight[]; note?: string;
}) {
  return (
    <div className="border border-line bg-panel-2/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow text-ink">{label}</p>
        <span className={cn("border px-1.5 py-0.5 text-[9px] uppercase tracking-wider",
          accent === "rent" ? "border-rent/40 text-rent" : "border-ready/40 text-ready")}>
          {sub}
        </span>
      </div>
      {summary && <p className="mt-2 text-sm leading-relaxed text-ink">{summary}</p>}
      {note && <p className="mt-1 text-[10px] text-ink-faint">{note}</p>}
      <div className="mt-3 space-y-2">
        {insights.map((ins, i) => <InsightCard key={i} insight={ins} />)}
        {insights.length === 0 && <p className="text-[11px] text-ink-faint">No specific insights.</p>}
      </div>
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
