"use client";

import { useState } from "react";
import { fetchSummary, type SummarizeResult } from "@/lib/summarizeClient";

/** "Summarize this tab" button → grounded AI narrative + suggested questions. */
export function SummarizePanel({
  category, stats, siblings,
}: { category: string; stats: string[]; siblings?: string[] }) {
  const [res, setRes] = useState<SummarizeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const run = async () => {
    setLoading(true);
    setRes(await fetchSummary({ category, stats, siblings }));
    setLoading(false);
  };

  if (!res) {
    return (
      <button onClick={run} disabled={loading}
        className="bg-brand px-4 py-2 text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {loading ? "Analyzing…" : "✦ Summarize this tab"}
      </button>
    );
  }
  return (
    <div className="space-y-2">
      {res.note && <p className="text-[11px] text-working">{res.note}</p>}
      <p className="text-xs leading-relaxed text-ink-dim">
        <span className="font-bold text-brand">AI</span> {res.narrative}
      </p>
      {res.suggestedQuestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {res.suggestedQuestions.map((q, i) => (
            <span key={i} className="border border-line px-2 py-1 text-[10px] text-ink-dim">{q}</span>
          ))}
        </div>
      )}
      <button onClick={run} disabled={loading}
        className="text-[10px] uppercase tracking-wider text-ink-faint hover:text-ink">
        {loading ? "…" : "↻ regenerate"}
      </button>
    </div>
  );
}
