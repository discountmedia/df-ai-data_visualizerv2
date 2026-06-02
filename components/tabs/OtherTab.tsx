"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import type { UnitRecord, WorkBucket } from "@/lib/types";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { DonutChart } from "../viz/DonutChart";
import { TabAI } from "./TabAI";
import { WORK_LABEL, WORK_HEX } from "@/lib/buckets";

const WORK_ORDER: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];

function countBy(units: UnitRecord[], get: (u: UnitRecord) => string | null, topN = 10) {
  const m = new Map<string, number>();
  for (const u of units) { const k = get(u); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, topN).map(([name, value]) => ({ name, value }));
}

export function OtherTab({ category, units, entities, schema, parsed }: TabContext) {
  const makeData = useMemo(() => countBy(units, (u) => u.make, 10), [units]);
  const typeData = useMemo(() => countBy(units, (u) => u.type, 6), [units]);

  // Top makes × work-stage (stacked) — what's tied up in the shop, by brand.
  const makeStage = useMemo(() => {
    const tops = new Set(makeData.slice(0, 8).map((d) => d.name));
    const m = new Map<string, Record<string, number>>();
    for (const u of units) {
      if (!u.make || !tops.has(u.make) || u.work === "unknown") continue;
      const row = m.get(u.make) ?? {};
      row[WORK_LABEL[u.work]] = (row[WORK_LABEL[u.work]] ?? 0) + 1;
      m.set(u.make, row);
    }
    const data = makeData.filter((d) => m.has(d.name)).map((d) => ({ name: d.name, ...m.get(d.name)! }));
    const series = WORK_ORDER.map((b) => WORK_LABEL[b]).filter((l) => data.some((d) => (d as unknown as Record<string, number>)[l] > 0));
    return { data, series };
  }, [units, makeData]);

  const distinctMake = new Set(units.map((u) => u.make).filter(Boolean)).size;
  const distinctType = new Set(units.map((u) => u.type).filter(Boolean)).size;
  const needsDiag = units.filter((u) => u.work === "needs_diagnosis").length;
  const workColors = Object.fromEntries(WORK_ORDER.map((b) => [WORK_LABEL[b], WORK_HEX[b]]));

  return (
    <div className="space-y-5 fade-up">
      <TabHeader category={category} />
      <StatCards cols={3} items={[
        { label: "Total Units", value: units.length, accent: "ink", sub: "inventory rows" },
        { label: "Distinct Makes", value: distinctMake, accent: "rent", sub: `${distinctType} types` },
        { label: "Needs Diagnosis", value: needsDiag, accent: "diag", sub: "triage backlog" },
      ]} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Fleet by Make" hint="top 10 · unit count" height={280}>
          <CategoryBars data={makeData} series={["value"]} layout="vertical" />
        </ChartPanel>
        <ChartPanel title="Inventory by Type" hint="share of fleet" height={280}>
          <DonutChart data={typeData} />
        </ChartPanel>
      </div>

      {makeStage.data.length > 0 && (
        <ChartPanel title="Top Makes by Work Stage" hint="what's sellable vs in the shop, by brand" height={300}>
          <CategoryBars data={makeStage.data} series={makeStage.series} layout="vertical" stacked colors={workColors} legend />
        </ChartPanel>
      )}

      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={[`Total units: ${units.length}`, `Distinct makes: ${distinctMake}`, `Distinct types: ${distinctType}`, `Needs diagnosis: ${needsDiag}`]} />
    </div>
  );
}
