import type {
  UnitRecord,
  ScoredUnit,
  ScoreFactor,
  ScoreWeights,
  ScoreRule,
  ScoringResult,
  PriorityTier,
} from "./types";

/**
 * Deterministic priority scorer. Answers ONE operational question: which units
 * should the yard work next? Per the operator's selection, the dominant driver
 * is COMMITTED-BUT-UNFINISHED — a customer has paid or committed but the unit
 * isn't deliverable, so revenue is stuck. Work-stage urgency orders the rest.
 *
 * Every point a unit earns is recorded as a ScoreFactor, so the Insights tab
 * can show exactly how each score was calculated. No AI, no randomness — same
 * input, same ranking, every time.
 */

export const DEFAULT_WEIGHTS: ScoreWeights = {
  committedUnfinished: 60,
  paidInFullBonus: 15,
  govtPoBonus: 5,
  committedUnknownWork: 25,
  needsDiagnosis: 30,
  beingWorked: 15,
};

/** Static description of each rule for the "how scores were calculated" panel. */
export function scoreRules(w: ScoreWeights): ScoreRule[] {
  return [
    {
      key: "committedUnfinished",
      label: "Committed but unfinished",
      points: w.committedUnfinished,
      when: "Customer has paid / put money down / contracted, and the unit is still being worked on or needs diagnosis. Revenue is stuck until it's finished. (Primary driver.)",
    },
    {
      key: "paidInFullBonus",
      label: "Paid-in-full surcharge",
      points: w.paidInFullBonus,
      when: "Added to a committed-but-unfinished unit when it's paid in full — the most money at risk and the customer is waiting on a unit they fully own.",
    },
    {
      key: "govtPoBonus",
      label: "Govt PO surcharge",
      points: w.govtPoBonus,
      when: "Added to a committed-but-unfinished unit on a government PO — contractual delivery obligations.",
    },
    {
      key: "committedUnknownWork",
      label: "Committed, work status unknown",
      points: w.committedUnknownWork,
      when: "Money is committed but the unit has no readable work stage — can't confirm it's deliverable. Verify before promising a date.",
    },
    {
      key: "needsDiagnosis",
      label: "Needs diagnosis (uncommitted)",
      points: w.needsDiagnosis,
      when: "Not yet committed, but blocked in 'needs diagnosis' — nothing downstream can happen until it's triaged.",
    },
    {
      key: "beingWorked",
      label: "Being worked on (uncommitted)",
      points: w.beingWorked,
      when: "Not yet committed, but mid-flight in service/body — push it to Ready so it can sell.",
    },
  ];
}

const ACT_NOW = 60;
const HIGH = 30;
const MEDIUM = 15;

/** Minimum score for each tier — exposed so the legend stays in sync. */
export const TIER_MIN: Record<"act_now" | "high" | "medium", number> = { act_now: ACT_NOW, high: HIGH, medium: MEDIUM };

function tierOf(score: number): PriorityTier {
  if (score >= ACT_NOW) return "act_now";
  if (score >= HIGH) return "high";
  if (score >= MEDIUM) return "medium";
  return "low";
}

function scoreOne(unit: UnitRecord, w: ScoreWeights): { factors: ScoreFactor[]; action: string } {
  const factors: ScoreFactor[] = [];
  const unfinished = unit.work === "working" || unit.work === "needs_diagnosis";
  let action = "Monitor — no open work signal.";

  if (unit.committed && unfinished) {
    factors.push({
      key: "committedUnfinished",
      label: "Committed but unfinished",
      points: w.committedUnfinished,
      detail: `${saleLabel(unit.saleRaw)} deal still ${unit.work === "needs_diagnosis" ? "awaiting diagnosis" : "being worked on"} — not deliverable yet.`,
    });
    if (unit.sale === "paid_in_full") {
      factors.push({
        key: "paidInFullBonus",
        label: "Paid-in-full surcharge",
        points: w.paidInFullBonus,
        detail: "Paid in full — customer owns it and is waiting.",
      });
    }
    if (unit.sale === "govt_po") {
      factors.push({
        key: "govtPoBonus",
        label: "Govt PO surcharge",
        points: w.govtPoBonus,
        detail: "Government PO — contractual delivery obligation.",
      });
    }
    action =
      unit.work === "needs_diagnosis"
        ? "Diagnose now — paid/committed unit is blocked at triage."
        : "Finish work — paid/committed unit isn't deliverable.";
  } else if (unit.committed && unit.work === "unknown") {
    factors.push({
      key: "committedUnknownWork",
      label: "Committed, work status unknown",
      points: w.committedUnknownWork,
      detail: `${saleLabel(unit.saleRaw)} deal with no readable work stage — confirm it's deliverable.`,
    });
    action = "Confirm work status — committed deal, stage unknown.";
  } else if (!unit.committed && unit.work === "needs_diagnosis") {
    factors.push({
      key: "needsDiagnosis",
      label: "Needs diagnosis",
      points: w.needsDiagnosis,
      detail: "Blocked at triage — can't be worked, rented, or sold until diagnosed.",
    });
    action = "Diagnose — unblock downstream work.";
  } else if (!unit.committed && unit.work === "working") {
    factors.push({
      key: "beingWorked",
      label: "Being worked on",
      points: w.beingWorked,
      detail: "Mid-flight in service/body — push toward Ready.",
    });
    action = "Push to Ready — work in progress.";
  }

  return { factors, action };
}

function saleLabel(raw: string | null): string {
  return raw ? raw.trim() : "Committed";
}

export function scoreUnits(units: UnitRecord[], weights: ScoreWeights = DEFAULT_WEIGHTS): ScoringResult {
  const ranked: ScoredUnit[] = [];
  const tierCounts: Record<PriorityTier, number> = { act_now: 0, high: 0, medium: 0, low: 0 };

  for (const unit of units) {
    const { factors, action } = scoreOne(unit, weights);
    const raw = factors.reduce((s, f) => s + f.points, 0);
    if (raw <= 0) continue;
    const score = Math.min(100, raw);
    const tier = tierOf(score);
    tierCounts[tier]++;
    ranked.push({ unit, score, tier, factors, action });
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      (b.unit.price ?? 0) - (a.unit.price ?? 0) ||
      a.unit.id.localeCompare(b.unit.id)
  );

  return {
    ranked,
    weights,
    rules: scoreRules(weights),
    tierCounts,
    scoredCount: ranked.length,
    totalUnits: units.length,
    methodology: [
      "Priority answers one question: which units should the yard work next? Higher score = work sooner.",
      `Primary driver (your selection): committed-but-unfinished units score +${weights.committedUnfinished}. A paid/committed unit that isn't finished is stuck revenue — it goes first.`,
      `Paid-in-full adds +${weights.paidInFullBonus} and a Govt PO adds +${weights.govtPoBonus} on top, reflecting how much money is at risk and any contractual obligation.`,
      `Committed units with no readable work stage score +${weights.committedUnknownWork} — you can't promise a date until you confirm the unit is deliverable.`,
      `Uncommitted units are ordered by operational stage: needs-diagnosis +${weights.needsDiagnosis} (blocked at triage), being-worked-on +${weights.beingWorked} (push to Ready).`,
      `Tiers: Act Now ≥ ${ACT_NOW}, High ≥ ${HIGH}, Medium ≥ ${MEDIUM}, Low below that. Ready / on-rent / sold units with no open work don't enter the queue.`,
      "Scoring is fully deterministic: no unit is ranked by AI, and the same export always produces the same order.",
    ],
  };
}
