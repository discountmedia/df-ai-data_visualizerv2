/**
 * Client for the per-tab "Summarize this category" AI action. Mirrors the
 * insights/connect clients: posts a COMPACT snapshot (already-computed stats —
 * never raw rows) and falls back to a deterministic read when there's no key.
 */

export interface SummarizeRequest {
  category: string;
  /** Human-readable headline numbers, e.g. "Committed Units: 142". */
  stats: string[];
  /** Other tab names, so the model can suggest cross-tab questions. */
  siblings?: string[];
}

export interface SummarizeResult {
  narrative: string;
  suggestedQuestions: string[];
  source: "claude" | "heuristic";
  note?: string;
}

export async function fetchSummary(req: SummarizeRequest): Promise<SummarizeResult> {
  try {
    const res = await fetch("/api/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 503 && data?.code === "NO_KEY") {
        return { ...heuristicSummary(req), source: "heuristic", note: "No ANTHROPIC_API_KEY set — rule-based read. Add the key in Vercel for the AI analysis." };
      }
      throw new Error((data?.error as string) || `Summary failed (${res.status}).`);
    }
    const data = (await res.json()) as { narrative: string; suggestedQuestions: string[] };
    if (!data.narrative) return { ...heuristicSummary(req), source: "heuristic", note: "AI returned nothing — showing the rule-based read." };
    return { narrative: data.narrative, suggestedQuestions: data.suggestedQuestions ?? [], source: "claude" };
  } catch (err) {
    return {
      ...heuristicSummary(req),
      source: "heuristic",
      note: (err instanceof Error ? err.message : "Summary request failed") + " — showing the rule-based read.",
    };
  }
}

function heuristicSummary(req: SummarizeRequest): { narrative: string; suggestedQuestions: string[] } {
  const narrative = req.stats.length
    ? `${req.category}: ${req.stats.join("; ")}.`
    : `Explore the ${req.category} data using the connection builder below.`;
  const sib = req.siblings ?? [];
  const suggestedQuestions = [
    `How does ${req.category} break down by location?`,
    sib.includes("Staff") ? `Which salesperson leads in ${req.category}?` : `Which values dominate ${req.category}?`,
  ];
  return { narrative, suggestedQuestions };
}
