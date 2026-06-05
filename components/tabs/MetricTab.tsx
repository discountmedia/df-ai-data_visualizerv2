"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { ScatterPanel } from "../viz/ScatterPanel";
import { TabAI } from "./TabAI";
import { computePivot, toNumber } from "@/lib/pivot";
import { colName, toBars, numericCount } from "./shared";
import { fmtMoney } from "@/lib/format";

const CAP_CLASSES: { label: string; max: number }[] = [
  { label: "<5k lbs", max: 5000 }, { label: "5k", max: 6000 }, { label: "6k", max: 8000 },
  { label: "8k", max: 10000 }, { label: "10k+", max: Infinity },
];

export function MetricTab({ category, units, schema, entities, parsed }: TabContext) {
  const baseRows = entities?.rowsByEntity["base"] ?? parsed.rows;
  const priceCol = colName(schema, /^final\s*sale\s*price$/i, /final\s*sale\s*price/i, /sold\s*price/i);
  const retailCol = colName(schema, /retail\s*price/i, /list\s*price/i);
  const yearCol = colName(schema, /^year$/i, /model\s*year/i);
  const hoursCol = colName(schema, /^hours?$/i, /meter/i);
  const makeCol = colName(schema, /^make$/i);
  const typeCol = colName(schema, /^type$/i);

  const priced = units.filter((u) => u.price != null);
  const avgPrice = priced.length ? Math.round(priced.reduce((s, u) => s + (u.price ?? 0), 0) / priced.length) : null;

  // Avg discount = mean(retail - final) per row where both numeric.
  const discount = useMemo(() => {
    if (!priceCol || !retailCol) return { avg: null as number | null, byMake: [] as { name: string; value: number }[] };
    let dSum = 0, dN = 0;
    const mk = new Map<string, { s: number; n: number }>();
    for (const r of baseRows) {
      const f = toNumber(r[priceCol]); const ret = toNumber(r[retailCol]);
      if (Number.isNaN(f) || Number.isNaN(ret) || ret <= 0) continue;
      const d = ret - f; dSum += d; dN += 1;
      const make = makeCol && r[makeCol] ? String(r[makeCol]) : null;
      if (make) { const g = mk.get(make) ?? { s: 0, n: 0 }; g.s += d; g.n += 1; mk.set(make, g); }
    }
    const byMake = [...mk.entries()].filter(([, g]) => g.n >= 2)
      .map(([name, g]) => ({ name, value: Math.round(g.s / g.n) }))
      .sort((a, b) => b.value - a.value).slice(0, 10);
    return { avg: dN ? Math.round(dSum / dN) : null, byMake };
  }, [baseRows, priceCol, retailCol, makeCol]);

  // Median age from Year.
  const medianAge = useMemo(() => {
    if (!yearCol) return null;
    const years = baseRows.map((r) => toNumber(r[yearCol])).filter((y) => !Number.isNaN(y) && y > 1950 && y <= 2026).sort((a, b) => a - b);
    if (!years.length) return null;
    const med = years[Math.floor(years.length / 2)];
    return 2026 - med;
  }, [baseRows, yearCol]);

  // Capacity class mix.
  const capData = useMemo(() => {
    const counts = new Array(CAP_CLASSES.length).fill(0);
    for (const u of units) {
      if (u.capacity == null) continue;
      const idx = CAP_CLASSES.findIndex((c) => u.capacity! < c.max);
      if (idx >= 0) counts[idx]++;
    }
    return CAP_CLASSES.map((c, i) => ({ name: c.label, value: counts[i] })).filter((d) => d.value > 0);
  }, [units]);

  // Avg price by year (bar — Year is sparse).
  const priceByYear = useMemo(() => {
    if (!yearCol || !priceCol || numericCount(baseRows, yearCol) < 5) return null;
    const res = computePivot(baseRows, { dimension: yearCol, measure: { kind: "avg", column: priceCol }, topN: 14 });
    const sorted = [...res.rows].sort((a, b) => Number(a.key) - Number(b.key));
    return sorted.length ? { data: sorted.map((r) => ({ name: r.key, value: Math.round(r.total) })), series: ["value"] } : null;
  }, [baseRows, yearCol, priceCol]);

  const hoursOk = hoursCol && priceCol && numericCount(baseRows, hoursCol) >= 5;

  return (
    <div className="space-y-5 fade-up">
      <TabHeader category={category} />
      <StatCards cols={4} items={[
        { label: "Units Priced", value: priced.length, accent: "ink", sub: `of ${units.length}` },
        { label: "Avg Sale Price", value: avgPrice, money: true, accent: "ready", sub: "final sale price" },
        { label: "Avg Discount", value: discount.avg, money: true, accent: "pif", sub: "off retail", available: discount.avg != null },
        { label: "Median Age", value: medianAge != null ? `${medianAge} yrs` : null, accent: "working", sub: "from model year", available: medianAge != null },
      ]} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {discount.byMake.length > 0 ? (
          <ChartPanel title="Avg Discount off Retail by Make" hint="where margin leaks" height={290}>
            <CategoryBars data={discount.byMake} series={["value"]} layout="vertical" money />
          </ChartPanel>
        ) : (
          <ChartPanel title="Avg Discount off Retail by Make" height={290}>
            <p className="text-[13px] text-ink-faint">Needs both Final and Retail price populated — not enough data in this file.</p>
          </ChartPanel>
        )}
        {hoursOk ? (
          <ChartPanel title="Sale Price vs Engine Hours" hint="wear-vs-price curve" height={290}>
            <ScatterPanel rows={baseRows} x={hoursCol!} y={priceCol!} colorBy={typeCol} money={{ y: true }} />
          </ChartPanel>
        ) : (
          <ChartPanel title="Sale Price vs Engine Hours" height={290}>
            <p className="text-[13px] text-ink-faint">Engine Hours column is sparse or absent in this file.</p>
          </ChartPanel>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {capData.length > 0 && (
          <ChartPanel title="Fleet by Capacity Class" hint="lbs rating" height={250}>
            <CategoryBars data={capData} series={["value"]} layout="horizontal" />
          </ChartPanel>
        )}
        {priceByYear && (
          <ChartPanel title="Avg Sale Price by Model Year" hint="depreciation curve" height={250}>
            <CategoryBars data={priceByYear.data} series={["value"]} layout="horizontal" money />
          </ChartPanel>
        )}
      </div>

      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={[
          `Units priced: ${priced.length} of ${units.length}`,
          `Avg sale price: ${fmtMoney(avgPrice)}`,
          discount.avg != null ? `Avg discount off retail: ${fmtMoney(discount.avg)}` : "Discount: not enough data",
          medianAge != null ? `Median fleet age: ${medianAge} yrs` : "Age: no year data",
        ]} />
    </div>
  );
}
