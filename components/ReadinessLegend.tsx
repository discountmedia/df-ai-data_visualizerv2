"use client";

import { useState } from "react";
import type { ScoringResult, PriorityTier } from "@/lib/types";
import { TIER_MIN } from "@/lib/score";
import { cn, fmt } from "@/lib/format";

const TIER: Record<PriorityTier, { label: string; dot: string; text: string; min: string; plain: string }> = {
  act_now: {
    label: "Act Now", dot: "bg-brand", text: "text-brand", min: `${TIER_MIN.act_now}+`,
    plain: "A customer has already paid or committed, but the unit isn't finished. Their money is stuck and they're waiting. Work these first.",
  },
  high: {
    label: "High", dot: "bg-diag", text: "text-diag", min: `${TIER_MIN.high}–${TIER_MIN.act_now - 1}`,
    plain: "Units blocked at diagnosis (nothing can happen until they're triaged), or committed deals whose work status can't be confirmed.",
  },
  medium: {
    label: "Medium", dot: "bg-working", text: "text-working", min: `${TIER_MIN.medium}–${TIER_MIN.high - 1}`,
    plain: "Units mid-service or mid-body work that aren't sold yet — push them to Ready so they can sell.",
  },
  low: {
    label: "Low", dot: "bg-rent", text: "text-rent", min: `1–${TIER_MIN.medium - 1}`,
    plain: "Minor open-work signals. Get to them after the above.",
  },
};
const TIERS: PriorityTier[] = ["act_now", "high", "medium", "low"];

/**
 * Plain-language explainer for the work-priority ("readiness") queue. The goal is
 * that any yard or sales manager can read it once and trust the ranking.
 */
export function ReadinessLegend({ scoring }: { scoring: ScoringResult }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="card p-5">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <div>
          <h2 className="text-base font-bold text-ink">How the priority list is built</h2>
          <p className="mt-1 text-[13px] text-ink-dim">
            One question: <span className="font-semibold text-ink">which units should the yard work next?</span> Read this once and the ranking will make sense.
          </p>
        </div>
        <span className="shrink-0 text-ink-dim">{open ? "▾ Hide" : "▸ Show"}</span>
      </button>

      {open && (
        <div className="mt-5 space-y-6">
          {/* The idea */}
          <div className="rounded-md border border-line bg-panel-2/50 p-4">
            <p className="text-[13px] leading-relaxed text-ink">
              Every unit earns <span className="font-semibold">points</span> for being a blocker or for tying up money. We add the points
              up, sort highest-first, and split the list into four bands. There is <span className="font-semibold">no AI and no guesswork</span> —
              the same export always produces the same order, and every unit shows exactly why it scored what it did (click any unit in the
              queue). Units that are <span className="text-ready">Ready</span>, <span className="text-rent">On Rent</span>, or already gone
              don't appear — there's nothing to work.
            </p>
          </div>

          {/* The four bands */}
          <div>
            <p className="text-[13px] font-semibold text-ink">The four bands (and what they mean)</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TIERS.map((t) => (
                <div key={t} className="rounded-md border border-line p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className={cn("inline-block h-2.5 w-2.5 rounded-full", TIER[t].dot)} />
                      <span className={cn("text-sm font-bold", TIER[t].text)}>{TIER[t].label}</span>
                    </span>
                    <span className="flex items-center gap-2 text-[12px] text-ink-faint">
                      <span>score {TIER[t].min}</span>
                      <span className="tabular-nums font-semibold text-ink">{fmt(scoring.tierCounts[t])} units</span>
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{TIER[t].plain}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The exact rules */}
          <div>
            <p className="text-[13px] font-semibold text-ink">Exactly how the points are earned</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-ink-dim">
                    <th className="py-2 pr-3 font-medium">What triggers it</th>
                    <th className="w-20 py-2 px-3 text-right font-medium">Points</th>
                    <th className="py-2 pl-3 font-medium">Why it matters</th>
                  </tr>
                </thead>
                <tbody>
                  {scoring.rules.map((r) => (
                    <tr key={r.key} className="border-b border-line/50 align-top">
                      <td className="py-2.5 pr-3 font-semibold text-ink">{r.label}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ready">+{r.points}</td>
                      <td className="py-2.5 pl-3 leading-relaxed text-ink-dim">{r.when}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-faint">
              A unit can stack rules (e.g. <span className="text-ink-dim">committed-but-unfinished +60</span> <span className="text-ink-faint">and</span>{" "}
              <span className="text-ink-dim">paid-in-full +15</span> = 75 → Act&nbsp;Now). Scores cap at 100. <span className="font-semibold text-ink-dim">Tie-break:</span> within a
              band, the unit with more money on the line (higher sale price) ranks first.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
