"use client";

import { useMemo } from "react";
import type { UnitRecord, ScoringResult, WorkBucket } from "@/lib/types";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { PriorityQueue } from "../priority/PriorityQueue";
import { ReadinessLegend } from "../ReadinessLegend";
import { WORK_LABEL, WORK_HEX } from "@/lib/buckets";

const ORDER: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];
const FUNNEL: WorkBucket[] = ["needs_diagnosis", "working", "ready"];

export function WorkStageView({ units, scoring }: { units: UnitRecord[]; scoring: ScoringResult }) {
  const counts = useMemo(() => {
    const c = new Map<WorkBucket, number>();
    for (const u of units) c.set(u.work, (c.get(u.work) ?? 0) + 1);
    return c;
  }, [units]);

  const inRecon = (counts.get("working") ?? 0) + (counts.get("needs_diagnosis") ?? 0);
  const ready = counts.get("ready") ?? 0;
  const onRent = counts.get("on_rent") ?? 0;
  const committedOpen = units.filter((u) => u.committed && (u.work === "working" || u.work === "needs_diagnosis"));
  const committedOpenVal = committedOpen.reduce((s, u) => s + (u.price ?? 0), 0);

  const mixData = ORDER.filter((b) => (counts.get(b) ?? 0) > 0).map((b) => ({ name: WORK_LABEL[b], value: counts.get(b)! }));
  const workColors = Object.fromEntries(ORDER.map((b) => [WORK_LABEL[b], WORK_HEX[b]]));
  const funnelData = FUNNEL.map((b) => ({ name: WORK_LABEL[b], value: counts.get(b) ?? 0 }));

  return (
    <div className="space-y-6 fade-up">
      <div>
        <p className="eyebrow text-brand">Work Stage</p>
        <h1 className="mt-1 text-xl font-bold text-ink">Where every unit is in the recon pipeline</h1>
      </div>

      <StatCards cols={4} items={[
        { label: "In Recon Now", value: inRecon, accent: "working", sub: "being worked + needs diagnosis" },
        { label: "Ready to Sell", value: ready, accent: "ready", sub: "diagnosed, serviced, signed off" },
        { label: "On Rent", value: onRent, accent: "rent", sub: "generating rental income" },
        { label: "$ Behind the Shop", value: committedOpenVal || null, money: true, accent: "pif", sub: `${committedOpen.length} committed but unfinished` },
      ]} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Work-Stage Mix" hint="every unit, by stage" height={260}>
          <CategoryBars data={mixData} series={["value"]} layout="vertical" colors={workColors} />
        </ChartPanel>
        <ChartPanel title="Recon Pipeline" hint="needs diag → being worked → ready" height={260}>
          <CategoryBars data={funnelData} series={["value"]} layout="vertical" colors={workColors} />
        </ChartPanel>
      </div>

      <ReadinessLegend scoring={scoring} />

      <div>
        <p className="eyebrow mb-2">Priority Queue — what to work next</p>
        <PriorityQueue scoring={scoring} />
      </div>
    </div>
  );
}
