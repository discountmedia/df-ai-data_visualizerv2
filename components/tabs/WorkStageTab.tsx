"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import type { WorkBucket } from "@/lib/types";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { PriorityQueue } from "../priority/PriorityQueue";
import { TabAI } from "./TabAI";
import { computePivot } from "@/lib/pivot";
import { WORK_LABEL, WORK_HEX } from "@/lib/buckets";
import { fmtMoney } from "@/lib/format";
import { colName, toBars } from "./shared";

const WORK_ORDER: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];
const STACK: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent"];

export function WorkStageTab({ category, units, scoring, schema, entities, parsed }: TabContext) {
  const baseRows = entities?.rowsByEntity["base"] ?? parsed.rows;
  const servicedBy = colName(schema, /serviced\s*by/i);

  const inRecon = units.filter((u) => u.work === "working" || u.work === "needs_diagnosis").length;
  const committedOpen = units.filter((u) => u.committed && (u.work === "working" || u.work === "needs_diagnosis"));
  const committedOpenVal = committedOpen.reduce((s, u) => s + (u.price ?? 0), 0);
  const ready = units.filter((u) => u.work === "ready").length;

  // Work-stage mix (bucket colours match Overview).
  const mixData = useMemo(() => {
    const c = new Map<WorkBucket, number>();
    for (const u of units) c.set(u.work, (c.get(u.work) ?? 0) + 1);
    return WORK_ORDER.filter((b) => (c.get(b) ?? 0) > 0).map((b) => ({ name: WORK_LABEL[b], value: c.get(b)! }));
  }, [units]);
  const workColors = Object.fromEntries(WORK_ORDER.map((b) => [WORK_LABEL[b], WORK_HEX[b]]));

  // Backlog by location (stacked, sellable pool only).
  const byLoc = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const u of units) {
      if (!STACK.includes(u.work)) continue;
      const key = u.location ?? "Unassigned";
      const row = m.get(key) ?? {};
      row[WORK_LABEL[u.work]] = (row[WORK_LABEL[u.work]] ?? 0) + 1;
      m.set(key, row);
    }
    const data = [...m.entries()]
      .map(([name, vals]) => ({ name, ...vals }))
      .sort((a, b) => sum(b) - sum(a)).slice(0, 8);
    const series = STACK.map((b) => WORK_LABEL[b]).filter((l) => data.some((d) => (d as unknown as Record<string, number>)[l] > 0));
    return { data, series };
  }, [units]);

  // Workload by tech.
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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Work-Stage Mix" hint="live shop status" height={260}>
          <CategoryBars data={mixData} series={["value"]} layout="vertical" colors={workColors} />
        </ChartPanel>
        {byLoc.data.length > 0 && (
          <ChartPanel title="Backlog by Location" hint="sellable pool · stacked" height={260}>
            <CategoryBars data={byLoc.data} series={byLoc.series} layout="horizontal" stacked colors={workColors} legend />
          </ChartPanel>
        )}
      </div>

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

function sum(row: Record<string, unknown>): number {
  let s = 0;
  for (const [k, v] of Object.entries(row)) if (k !== "name" && typeof v === "number") s += v;
  return s;
}
