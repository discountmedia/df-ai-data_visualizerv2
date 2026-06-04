import type { ScoringResult, ScoredUnit } from "./types";

/** How many of the top deterministically-scored units to hand the model. */
export const AI_PRIORITY_CAP = 50;

interface UnitInput {
  ref: number; // unit.rowIndex — stable per base row
  unit: string;
  work: string;
  sale: string;
  committed: boolean;
  price: number | null;
  location: string | null;
  detScore: number;
}
export interface PrioritizeInput {
  units: UnitInput[];
  context: { actNow: number; queued: number };
}

export interface AiRankedUnit {
  scored: ScoredUnit;
  reason: string;
}
export interface PrioritizeResult {
  ranked: AiRankedUnit[];
  strategy: string;
  source: "claude" | "heuristic";
  note?: string;
}

function unitTitle(s: ScoredUnit): string {
  const u = s.unit;
  const lead = [u.serial4 ? `#${u.serial4}` : null, u.forkliftName ?? u.name].filter(Boolean).join(" ");
  const spec = [u.year, u.make, u.type].filter(Boolean).join(" ");
  return lead ? (spec ? `${lead} · ${spec}` : lead) : spec || "Unit";
}

export function buildPrioritizeInput(scoring: ScoringResult): { input: PrioritizeInput; pool: ScoredUnit[] } {
  const pool = scoring.ranked.slice(0, AI_PRIORITY_CAP);
  const input: PrioritizeInput = {
    units: pool.map((s) => ({
      ref: s.unit.rowIndex,
      unit: unitTitle(s),
      work: s.unit.work,
      sale: s.unit.sale,
      committed: s.unit.committed,
      price: s.unit.price,
      location: s.unit.location,
      detScore: s.score,
    })),
    context: { actNow: scoring.tierCounts.act_now, queued: scoring.scoredCount },
  };
  return { input, pool };
}

/** Order the pool by the model's ranking; drop unknown refs and append any the model missed. */
function applyOrder(pool: ScoredUnit[], order: { ref: number; reason: string }[]): AiRankedUnit[] {
  const byRef = new Map(pool.map((s) => [s.unit.rowIndex, s]));
  const seen = new Set<number>();
  const ranked: AiRankedUnit[] = [];
  for (const o of order) {
    const scored = byRef.get(o.ref);
    if (scored && !seen.has(o.ref)) { ranked.push({ scored, reason: o.reason }); seen.add(o.ref); }
  }
  for (const s of pool) if (!seen.has(s.unit.rowIndex)) ranked.push({ scored: s, reason: "Kept in deterministic position — the model didn't rank this one." });
  return ranked;
}

function heuristic(pool: ScoredUnit[], note?: string): PrioritizeResult {
  return {
    ranked: pool.map((s) => ({ scored: s, reason: s.action })),
    strategy: "No AI available — showing the deterministic priority order (committed-but-unfinished and high-value units first).",
    source: "heuristic",
    note,
  };
}

export async function fetchPrioritized(input: PrioritizeInput, pool: ScoredUnit[]): Promise<PrioritizeResult> {
  try {
    const res = await fetch("/api/prioritize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({} as Record<string, unknown>));
      if (res.status === 503 && data?.code === "NO_KEY") {
        return heuristic(pool, "No ANTHROPIC_API_KEY set — this is the deterministic order. Add the key for the AI re-rank.");
      }
      throw new Error((data?.error as string) || `Prioritization failed (${res.status}).`);
    }
    const data = (await res.json()) as { strategy?: string; order?: { ref: number; reason: string }[] };
    const ranked = applyOrder(pool, data.order ?? []);
    if (ranked.length === 0) return heuristic(pool, "AI returned no ranking — showing the deterministic order.");
    return { ranked, strategy: data.strategy ?? "", source: "claude" };
  } catch (err) {
    return heuristic(pool, (err instanceof Error ? err.message : "AI request failed") + " — showing the deterministic order.");
  }
}
