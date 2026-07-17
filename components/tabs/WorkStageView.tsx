"use client";

import { useMemo, useState } from "react";
import type { UnitRecord, ScoringResult, WorkBucket } from "@/lib/types";
import { StatCards } from "../viz/StatCards";
import { ReconPipeline } from "../viz/ReconPipeline";
import { PriorityQueue } from "../priority/PriorityQueue";
import { ReadinessLegend } from "../ReadinessLegend";
import { UnitsDrawer } from "../overview/UnitsDrawer";
import { AiAnalysisCard } from "../insights/AiAnalysisCard";
import { EmptyState } from "../states/States";
import { buildInsightsInput } from "@/lib/insightsClient";

export function WorkStageView({ units, scoring }: { units: UnitRecord[]; scoring: ScoringResult }) {
  const counts = useMemo(() => {
    const c = new Map<WorkBucket, number>();
    for (const u of units) c.set(u.work, (c.get(u.work) ?? 0) + 1);
    return c;
  }, [units]);
  const [drill, setDrill] = useState<{ title: string; units: UnitRecord[] } | null>(null);
  const aiInput = useMemo(() => buildInsightsInput(scoring, units, null), [scoring, units]);

  if (units.length === 0) {
    return (
      <EmptyState
        title="No units in the service pipeline for this view"
        hint="No units match the current location filter."
      />
    );
  }

  const inServiceUnits = units.filter((u) => u.work === "working" || u.work === "needs_diagnosis");
  const readyUnits = units.filter((u) => u.work === "ready");
  const onRentUnits = units.filter((u) => u.work === "on_rent");
  const committedOpen = units.filter((u) => u.committed && (u.work === "working" || u.work === "needs_diagnosis"));
  const committedOpenVal = committedOpen.reduce((s, u) => s + (u.price ?? 0), 0);
  const open = (title: string, list: UnitRecord[]) => () => setDrill({ title, units: list });

  return (
    <>
      <div className="space-y-6 fade-up">
        <div>
          <p className="eyebrow text-brand">Work Stage</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Where every unit is in the service pipeline</h1>
        </div>

        <StatCards cols={4} items={[
          { label: "In Service Now", value: inServiceUnits.length, accent: "working", sub: "being worked + needs diagnosis", onClick: open("In Service Now", inServiceUnits) },
          { label: "Ready to Sell", value: readyUnits.length, accent: "ready", sub: "diagnosed, serviced, signed off", onClick: open("Ready to Sell", readyUnits) },
          { label: "On Rent", value: onRentUnits.length, accent: "rent", sub: "generating rental income", onClick: open("On Rent", onRentUnits) },
          { label: "$ Behind the Shop", value: committedOpenVal || null, money: true, accent: "pif", sub: `${committedOpen.length} committed but unfinished`, onClick: open("Behind the Shop — committed but unfinished", committedOpen) },
        ]} />

        <ReconPipeline counts={counts} />

        {/* Queue first (the actionable thing), THEN the scoring explainer, THEN
            the opt-in AI read — so the data story reads uninterrupted. */}
        <div>
          <p className="eyebrow mb-2">Priority Queue — what to work next</p>
          <PriorityQueue scoring={scoring} />
        </div>

        <ReadinessLegend scoring={scoring} />

        <AiAnalysisCard
          input={aiInput}
          blurb="AI analysis is off by default — click Run to have Claude read the service pipeline + priority queue and flag what to work next."
        />
      </div>
      {drill && <UnitsDrawer title={drill.title} units={drill.units} onClose={() => setDrill(null)} />}
    </>
  );
}
