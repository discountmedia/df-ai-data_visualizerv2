"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { PriorityQueue } from "../priority/PriorityQueue";
import { TabAI } from "./TabAI";
import { computePivot } from "@/lib/pivot";
import { fmtMoney } from "@/lib/format";
import { colName, toBars } from "./shared";

export function WorkStageTab({ category, units, scoring, schema, entities, parsed }: TabContext) {
  const baseRows = entities?.rowsByEntity["base"] ?? parsed.rows;
  const servicedBy = colName(schema, /serviced\s*by/i);

  const inRecon = units.filter((u) => u.work === "working" || u.work === "needs_diagnosis").length;
  const committedOpen = units.filter((u) => u.committed && (u.work === "working" || u.work === "needs_diagnosis"));
  const committedOpenVal = committedOpen.reduce((s, u) => s + (u.price ?? 0), 0);
  const ready = units.filter((u) => u.work === "ready").length;

  // Service workload by tech — unique to this tab. (Work-stage mix lives on the
  // Overview; work-stage × location lives on the Location tab — no repeats.)
  const techBars = useMemo(() => {
    if (!servicedBy) return null;
    const res = computePivot(baseRows, { dimension: servicedBy, measure: { kind: "count" }, topN: 10 });
    return res.rows.length ? toBars(res) : null;
  }, [baseRows, servicedBy]);

  return (
    <div className="space-y-5 fade-up">
      <TabHeader category={category} />
      <StatCards cols={4} items={[
        { label: "In Recon Now", value: inRecon, accent: "working", sub: "being worked + needs diag" },
        { label: "Ready to Sell", value: ready, accent: "ready", sub: "fully prepped" },
        { label: "Sold, Open Work", value: committedOpen.length, accent: "diag", sub: "committed but unfinished" },
        { label: "$ Behind the Shop", value: committedOpenVal || null, money: true, accent: "pif", sub: "committed unfinished value" },
      ]} />

      {techBars && (
        <ChartPanel title="Service Workload by Tech" hint="units signed off, by 'Serviced by'" height={260}>
          <CategoryBars data={techBars.data} series={techBars.series} layout="vertical" />
        </ChartPanel>
      )}

      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={[`In recon now: ${inRecon}`, `Ready to sell: ${ready}`, `Sold with open work: ${committedOpen.length}`, `Value behind shop: ${fmtMoney(committedOpenVal || null)}`]} />

      <div>
        <p className="eyebrow mb-2">Priority Queue — what to work next</p>
        <PriorityQueue scoring={scoring} />
      </div>
    </div>
  );
}
