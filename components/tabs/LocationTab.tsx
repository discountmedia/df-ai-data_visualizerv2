"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import type { WorkBucket, LocationSnapshot } from "@/lib/types";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { DistributionBar } from "../viz/DistributionBar";
import { TabAI } from "./TabAI";
import { WORK_LABEL, WORK_HEX } from "@/lib/buckets";
import { fmt } from "@/lib/format";

const STACK: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent"];

export function LocationTab({ category, units, metrics, entities, schema, parsed }: TabContext) {
  const located = units.filter((u) => u.location);
  const byLoc = useMemo(() => {
    const m = new Map<string, number>();
    for (const u of units) { const k = u.location ?? "Unassigned"; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [units]);

  const sellable = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const u of units) {
      if (!STACK.includes(u.work)) continue;
      const key = u.location ?? "Unassigned";
      const row = m.get(key) ?? {};
      row[WORK_LABEL[u.work]] = (row[WORK_LABEL[u.work]] ?? 0) + 1;
      m.set(key, row);
    }
    const data = byLoc.filter((l) => m.has(l.name)).slice(0, 8).map((l) => ({ name: l.name, ...m.get(l.name)! }));
    const series = STACK.map((b) => WORK_LABEL[b]).filter((l) => data.some((d) => (d as unknown as Record<string, number>)[l] > 0));
    return { data, series };
  }, [units, byLoc]);

  const avgPrice = useMemo(() => {
    const sum = new Map<string, number>(); const cnt = new Map<string, number>();
    for (const u of units) {
      if (u.price == null) continue;
      const k = u.location ?? "Unassigned";
      sum.set(k, (sum.get(k) ?? 0) + u.price); cnt.set(k, (cnt.get(k) ?? 0) + 1);
    }
    return [...sum.entries()].map(([name, s]) => ({ name, value: Math.round(s / (cnt.get(name) || 1)) }))
      .sort((a, b) => b.value - a.value).slice(0, 10);
  }, [units]);

  const distinct = new Set(located.map((u) => u.location)).size;
  const top = byLoc[0];
  const workColors = Object.fromEntries(STACK.map((b) => [WORK_LABEL[b], WORK_HEX[b]]));

  return (
    <div className="space-y-5 fade-up">
      <TabHeader category={category} />
      <StatCards cols={3} items={[
        { label: "Units Located", value: located.length, accent: "ink", sub: `${fmt(units.length - located.length)} unassigned` },
        { label: "Locations", value: distinct, accent: "rent", sub: "yards / FOB" },
        { label: "Top Location", value: top ? `${top.name}` : "—", accent: "ready", sub: top ? `${fmt(top.value)} units` : "" },
      ]} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Units in Stock by Location" hint="unit count" height={300}>
          <CategoryBars data={byLoc.slice(0, 12)} series={["value"]} layout="vertical" />
        </ChartPanel>
        {sellable.data.length > 0 && (
          <ChartPanel title="Sellable vs In-Work by Location" hint="stacked · excludes sold" height={300}>
            <CategoryBars data={sellable.data} series={sellable.series} layout="vertical" stacked colors={workColors} legend />
          </ChartPanel>
        )}
      </div>

      {avgPrice.length > 0 && (
        <ChartPanel title="Average Sale Price by Location" hint="sold units" height={260}>
          <CategoryBars data={avgPrice} series={["value"]} layout="vertical" money />
        </ChartPanel>
      )}

      {metrics.locations.length > 0 && <LocationsSnapshot locations={metrics.locations} />}

      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={[`Units located: ${located.length}`, `Distinct locations: ${distinct}`, top ? `Top: ${top.name} (${top.value} units)` : "No location data"]} />
    </div>
  );
}

const SEG: { key: keyof LocationSnapshot; cls: string; label: string }[] = [
  { key: "ready", cls: "bg-ready", label: "Ready" },
  { key: "working", cls: "bg-working", label: "Working" },
  { key: "needs_diagnosis", cls: "bg-diag", label: "Needs Diag" },
  { key: "on_rent", cls: "bg-rent", label: "On Rent" },
];

function LocationsSnapshot({ locations }: { locations: LocationSnapshot[] }) {
  return (
    <section>
      <p className="eyebrow mb-3">Locations — Snapshot</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {locations.slice(0, 12).map((l) => (
          <div key={l.name} className="card p-3">
            <div className="flex items-baseline justify-between">
              <span className="truncate text-sm font-bold text-ink">{l.name}</span>
              <span className="text-[11px] text-ink-faint">{fmt(l.total)} units</span>
            </div>
            <div className="mt-2">
              <DistributionBar segments={SEG.map((s) => ({ label: s.label, value: l[s.key] as number, cls: s.cls }))} legend />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
