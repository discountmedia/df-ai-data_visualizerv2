"use client";

import { useMemo } from "react";
import type { UnitRecord, ScoringResult, WorkBucket } from "@/lib/types";
import { StatCards } from "../viz/StatCards";
import { ReconPipeline } from "../viz/ReconPipeline";
import { PriorityQueue } from "../priority/PriorityQueue";
import { ReadinessLegend } from "../ReadinessLegend";
import { EmptyState } from "../states/States";

export function WorkStageView({ units, scoring }: { units: UnitRecord[]; scoring: ScoringResult }) {
  const counts = useMemo(() => {
    const c = new Map<WorkBucket, number>();
    for (const u of units) c.set(u.work, (c.get(u.work) ?? 0) + 1);
    return c;
  }, [units]);

  if (units.length === 0) {
    return (
      <EmptyState
        title="No units in the service pipeline for this view"
        hint="Work Stage covers the 4 main yards (Denver / Las Vegas / Phoenix / DFW). Other locations aren't part of the service pipeline."
      />
    );
  }

  const inRecon = (counts.get("working") ?? 0) + (counts.get("needs_diagnosis") ?? 0);
  const ready = counts.get("ready") ?? 0;
  const onRent = counts.get("on_rent") ?? 0;
  const committedOpen = units.filter((u) => u.committed && (u.work === "working" || u.work === "needs_diagnosis"));
  const committedOpenVal = committedOpen.reduce((s, u) => s + (u.price ?? 0), 0);

  return (
    <div className="space-y-6 fade-up">
      <div>
        <p className="eyebrow text-brand">Work Stage</p>
        <h1 className="mt-1 text-xl font-bold text-ink">Where every unit is in the service pipeline</h1>
      </div>

      <StatCards cols={4} items={[
        { label: "In Service Now", value: inRecon, accent: "working", sub: "being worked + needs diagnosis" },
        { label: "Ready to Sell", value: ready, accent: "ready", sub: "diagnosed, serviced, signed off" },
        { label: "On Rent", value: onRent, accent: "rent", sub: "generating rental income" },
        { label: "$ Behind the Shop", value: committedOpenVal || null, money: true, accent: "pif", sub: `${committedOpen.length} committed but unfinished` },
      ]} />

      <ReconPipeline counts={counts} />

      <ReadinessLegend scoring={scoring} />

      <div>
        <p className="eyebrow mb-2">Priority Queue — what to work next</p>
        <PriorityQueue scoring={scoring} />
      </div>
    </div>
  );
}
