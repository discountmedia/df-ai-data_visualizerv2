import type {
  ScoringResult,
  UnitRecord,
  SalesSummary,
  InsightsResult,
  Insight,
  WorkBucket,
  SaleBucket,
} from "./types";
import { fmt, fmtMoney } from "./format";

/** Compact, already-aggregated snapshot sent to the model (and the fallback). */
export interface InsightsInput {
  fleet: { total: number; scored: number; actNow: number; high: number; medium: number; low: number };
  workMix: Record<string, number>;
  saleMix: Record<string, number>;
  moneyAtRisk: number | null;
  topPriority: Array<{
    rank: number;
    title: string;
    location: string | null;
    work: WorkBucket;
    sale: SaleBucket;
    score: number;
    tier: string;
    action: string;
  }>;
  locations: Array<{ name: string; total: number; needs_diagnosis: number; working: number; ready: number; on_rent: number }>;
  sales: { totalSold: number; unsignedCount: number; activeReps: number; totalSales: number | null } | null;
}

const STACK: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent"];

export function buildInsightsInput(
  scoring: ScoringResult,
  units: UnitRecord[],
  sales: SalesSummary | null
): InsightsInput {
  const workMix: Record<string, number> = {};
  const saleMix: Record<string, number> = {};
  for (const u of units) {
    workMix[u.work] = (workMix[u.work] ?? 0) + 1;
    if (u.sale !== "unknown") saleMix[u.sale] = (saleMix[u.sale] ?? 0) + 1;
  }

  let moneyAtRisk = 0;
  let sawPrice = false;
  for (const s of scoring.ranked) {
    if (s.tier === "act_now" && s.unit.committed && s.unit.price != null) {
      moneyAtRisk += s.unit.price;
      sawPrice = true;
    }
  }

  const byLoc = new Map<string, { name: string; total: number; needs_diagnosis: number; working: number; ready: number; on_rent: number }>();
  for (const u of units) {
    if (!STACK.includes(u.work)) continue;
    const key = u.location ?? "Unassigned";
    const row = byLoc.get(key) ?? { name: key, total: 0, needs_diagnosis: 0, working: 0, ready: 0, on_rent: 0 };
    row.total += 1;
    row[u.work as "needs_diagnosis" | "working" | "ready" | "on_rent"] += 1;
    byLoc.set(key, row);
  }
  const locations = Array.from(byLoc.values()).sort((a, b) => b.total - a.total).slice(0, 8);

  const topPriority = scoring.ranked.slice(0, 20).map((s, i) => ({
    rank: i + 1,
    title: [s.unit.make, s.unit.model, s.unit.type].filter(Boolean).join(" · ") || s.unit.name || "Unit",
    location: s.unit.location,
    work: s.unit.work,
    sale: s.unit.sale,
    score: s.score,
    tier: s.tier,
    action: s.action,
  }));

  return {
    fleet: {
      total: scoring.totalUnits,
      scored: scoring.scoredCount,
      actNow: scoring.tierCounts.act_now,
      high: scoring.tierCounts.high,
      medium: scoring.tierCounts.medium,
      low: scoring.tierCounts.low,
    },
    workMix,
    saleMix,
    moneyAtRisk: sawPrice ? Math.round(moneyAtRisk) : null,
    topPriority,
    locations,
    sales: sales
      ? {
          totalSold: sales.totalSold,
          unsignedCount: sales.unsignedCount,
          activeReps: sales.reps.filter((r) => r.unitsSold > 0).length,
          totalSales: sales.reps.reduce((s, r) => s + (r.totalSale ?? 0), 0) || null,
        }
      : null,
  };
}

export async function fetchInsights(input: InsightsInput): Promise<InsightsResult> {
  try {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 503 && data?.code === "NO_KEY") {
        return {
          ...heuristicInsights(input),
          source: "heuristic",
          note: "No ANTHROPIC_API_KEY set — these insights are rule-based. Set the key to enable the AI read.",
        };
      }
      throw new Error(data?.error || `Insight generation failed (${res.status}).`);
    }
    const data = (await res.json()) as {
      summary: string; insights: Insight[];
      second?: InsightsResult["second"]; secondError?: string;
    };
    if (!data.insights?.length && !data.summary) {
      return { ...heuristicInsights(input), source: "heuristic", note: "AI returned no insights — showing the rule-based read." };
    }
    return {
      summary: data.summary, insights: data.insights ?? [], source: "claude",
      second: data.second ?? null, secondError: data.secondError,
    };
  } catch (err) {
    return {
      ...heuristicInsights(input),
      source: "heuristic",
      note: (err instanceof Error ? err.message : "Insight request failed") + " — showing the rule-based read instead.",
    };
  }
}

/** Deterministic operational read used when AI is unavailable. */
export function heuristicInsights(input: InsightsInput): { summary: string; insights: Insight[] } {
  const insights: Insight[] = [];
  const { fleet, workMix, moneyAtRisk, locations, sales } = input;

  if (fleet.actNow > 0) {
    const risk = moneyAtRisk != null ? ` ${fmtMoney(moneyAtRisk)} is tied up in finished-but-undelivered revenue.` : "";
    insights.push({
      severity: "act",
      title: `${fmt(fleet.actNow)} units need action now`,
      body: `Committed-but-unfinished units lead the queue — a customer has paid or committed but the unit isn't deliverable.${risk} Work these before anything else.`,
    });
  }

  const diag = workMix.needs_diagnosis ?? 0;
  if (diag > 0) {
    const worst = [...locations].sort((a, b) => b.needs_diagnosis - a.needs_diagnosis)[0];
    const where = worst && worst.needs_diagnosis > 0 ? ` ${worst.name} has the deepest backlog (${fmt(worst.needs_diagnosis)}).` : "";
    insights.push({
      severity: "watch",
      title: `${fmt(diag)} units stuck at diagnosis`,
      body: `Nothing downstream can happen until these are triaged — they block work, rental, and sale.${where}`,
    });
  }

  if (sales && sales.unsignedCount > 0) {
    insights.push({
      severity: "watch",
      title: `${fmt(sales.unsignedCount)} committed deals unsigned`,
      body: `Down-payment / paid-in-full deals with no signature on file. Chase the paperwork before the deal slips (Govt POs and removed units excluded).`,
    });
  }

  const ready = workMix.ready ?? 0;
  if (ready > 0) {
    insights.push({
      severity: "info",
      title: `${fmt(ready)} units ready to sell`,
      body: `Fully prepped inventory available now. If they're aging, they're idle capital — prioritise them in sales outreach.`,
    });
  }

  if (sales && sales.activeReps > 0) {
    insights.push({
      severity: "info",
      title: `${fmt(sales.totalSold)} units sold across ${fmt(sales.activeReps)} active reps`,
      body: sales.totalSales != null ? `${fmtMoney(sales.totalSales)} in attributed sales to date.` : `Attribution is from the 'sold by' field on unit rows.`,
    });
  }

  const summary =
    fleet.scored === 0
      ? `No open work signals in this export — ${fmt(fleet.total)} units, nothing currently queued for action.`
      : `${fmt(fleet.scored)} of ${fmt(fleet.total)} units need attention${fleet.actNow > 0 ? `, ${fmt(fleet.actNow)} of them urgently` : ""}. ${moneyAtRisk != null && moneyAtRisk > 0 ? `${fmtMoney(moneyAtRisk)} in committed revenue is waiting on unfinished work.` : "The queue is led by committed-but-unfinished units."}`;

  return { summary, insights };
}
