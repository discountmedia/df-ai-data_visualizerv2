"use client";

import { useEffect, useState } from "react";
import type { InsightsResult } from "@/lib/types";
import { fetchInsights, type InsightsInput } from "@/lib/insightsClient";
import { cn } from "@/lib/format";
import { AiInsightsBody, SourceBadge } from "./AiInsightsBody";

/**
 * Per-tab, opt-in AI card. Lives directly under a tab's KPI cards and above its
 * charts. Nothing is sent to any model until the operator clicks Run — then it
 * fetches a Claude read scoped to that tab's data and expands inline.
 */
export function AiAnalysisCard({
  input,
  title = "AI Analysis",
  blurb,
}: {
  input: InsightsInput;
  title?: string;
  blurb?: string;
}) {
  const [result, setResult] = useState<InsightsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0); // 0 = never run (opt-in)

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
    // Re-runs only on explicit Run/Regenerate — never automatically on data change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="eyebrow flex items-center gap-2">
          <span className="text-brand" aria-hidden="true">✦</span> {title}
        </h2>
        <div className="flex items-center gap-2">
          {result && <SourceBadge source={result.source} />}
          <button
            onClick={() => setNonce((n) => n + 1)}
            disabled={loading}
            className={cn(
              "px-3 py-1.5 text-[13px] uppercase tracking-wider transition-opacity disabled:opacity-40",
              nonce === 0
                ? "bg-brand-strong font-bold text-white hover:opacity-90"
                : "border border-line text-ink-dim hover:border-brand hover:text-ink"
            )}
          >
            {loading ? "Reading…" : nonce === 0 ? "⚡ Run AI Analysis" : "Regenerate"}
          </button>
        </div>
      </div>

      {!result && !loading ? (
        <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
          {blurb ?? "AI analysis is off by default — click Run to have Claude read this view and surface what needs attention."}{" "}
          Nothing is sent to any model until you ask.
        </p>
      ) : (
        <div className="mt-3">
          <AiInsightsBody result={result} loading={loading} />
        </div>
      )}
    </section>
  );
}
