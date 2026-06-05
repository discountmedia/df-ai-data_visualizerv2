"use client";

import type { InsightsResult, Insight, InsightSeverity } from "@/lib/types";
import { cn } from "@/lib/format";

/**
 * Shared presentational renderer for an AI insights result — the narrative line
 * plus the severity-tagged insight cards. Reused by the per-tab AiAnalysisCard
 * and the company-wide AiAnalysisModal so they stay visually identical.
 */

const SEVERITY: Record<InsightSeverity, { dot: string }> = {
  act: { dot: "bg-brand" },
  watch: { dot: "bg-working" },
  info: { dot: "bg-rent" },
};

export function SourceBadge({ source }: { source: InsightsResult["source"] }) {
  return (
    <span
      className={cn(
        "border px-2 py-0.5 text-[12px] uppercase tracking-wider",
        source === "claude" ? "border-ready/40 text-ready" : "border-working/40 text-working"
      )}
    >
      {source === "claude" ? "AI" : "rule-based"}
    </span>
  );
}

export function AiInsightsBody({ result, loading }: { result: InsightsResult | null; loading: boolean }) {
  if (loading && !result) return <p className="text-sm text-ink-dim">Reading the fleet…</p>;
  if (!result) return null;
  return (
    <div>
      {result.summary && <p className="text-sm leading-relaxed text-ink">{result.summary}</p>}
      {result.note && <p className="mt-1.5 text-[13px] text-ink-faint">{result.note}</p>}
      {result.insights.length > 0 && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {result.insights.map((ins, i) => (
            <InsightCard key={i} insight={ins} />
          ))}
        </div>
      )}
      {result.insights.length === 0 && !result.summary && (
        <p className="mt-2 text-[13px] text-ink-faint">No specific insights.</p>
      )}
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const s = SEVERITY[insight.severity];
  return (
    <div className="border border-line bg-panel-2 p-3">
      <p className="flex items-center gap-2 text-sm font-bold text-ink">
        <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full", s.dot)} aria-hidden="true" />
        {insight.title}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{insight.body}</p>
    </div>
  );
}
