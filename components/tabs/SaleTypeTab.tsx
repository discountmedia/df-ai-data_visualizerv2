"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import type { SaleBucket, WorkBucket, SalesRep } from "@/lib/types";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { Leaderboard, type ColDef } from "../viz/Leaderboard";
import { TabAI } from "./TabAI";
import { unitTitle } from "./shared";
import { SALE_LABEL, SALE_HEX, WORK_LABEL, WORK_HEX } from "@/lib/buckets";
import { fmt, fmtMoney } from "@/lib/format";

const SALE_ORDER: SaleBucket[] = ["paid_in_full", "down_payment", "govt_po", "rental", "other"];
const WORK_ORDER: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];

export function SaleTypeTab({ category, units, sales, entities, schema, parsed }: TabContext) {
  const committed = useMemo(() => units.filter((u) => u.committed), [units]);
  const committedVal = committed.reduce((s, u) => s + (u.price ?? 0), 0);
  const openOnCommitted = committed.filter((u) => u.work === "working" || u.work === "needs_diagnosis");
  const unsigned = useMemo(() => committed.filter((u) => !u.signed), [committed]);

  // Commitment mix donut.
  const mix = useMemo(() => {
    const c = new Map<SaleBucket, number>();
    for (const u of committed) c.set(u.sale, (c.get(u.sale) ?? 0) + 1);
    return SALE_ORDER.filter((b) => (c.get(b) ?? 0) > 0).map((b) => ({ name: SALE_LABEL[b], value: c.get(b)!, fill: SALE_HEX[b] }));
  }, [committed]);

  // Work stage on committed units, by sale type (stacked).
  const openBySale = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    for (const u of committed) {
      if (u.work === "unknown") continue;
      const key = SALE_LABEL[u.sale];
      const row = m.get(key) ?? {};
      row[WORK_LABEL[u.work]] = (row[WORK_LABEL[u.work]] ?? 0) + 1;
      m.set(key, row);
    }
    const data = SALE_ORDER.map((b) => SALE_LABEL[b]).filter((l) => m.has(l)).map((l) => ({ name: l, ...m.get(l)! }));
    const series = WORK_ORDER.map((b) => WORK_LABEL[b]).filter((l) => data.some((d) => (d as unknown as Record<string, number>)[l] > 0));
    return { data, series };
  }, [committed]);
  const workColors = Object.fromEntries(WORK_ORDER.map((b) => [WORK_LABEL[b], WORK_HEX[b]]));

  const repCols: ColDef<SalesRep>[] = [
    { key: "name", label: "Rep", render: (r) => <span className="font-bold text-ink">{r.name}</span> },
    { key: "unitsSold", label: "Units", numeric: true, sortVal: (r) => r.unitsSold },
    { key: "totalSale", label: "Total $", numeric: true, sortVal: (r) => r.totalSale ?? 0, render: (r) => <span className="text-pif">{fmtMoney(r.totalSale)}</span> },
    { key: "avgSale", label: "Avg $", numeric: true, sortVal: (r) => r.avgSale ?? 0, render: (r) => fmtMoney(r.avgSale) },
    { key: "unsignedDocs", label: "Unsigned", numeric: true, sortVal: (r) => r.unsignedDocs },
  ];
  const reps = (sales?.reps ?? []).filter((r) => r.unitsSold > 0);

  return (
    <div className="space-y-5 fade-up">
      <TabHeader category={category} />
      <StatCards cols={4} items={[
        { label: "Committed Units", value: committed.length, accent: "pif", sub: "paid / deposit / govt PO" },
        { label: "Committed Value", value: committedVal || null, money: true, accent: "ready", sub: "Σ final sale price" },
        { label: "Open Work on Committed", value: openOnCommitted.length, accent: "diag", sub: "promised, not finished" },
        { label: "Unsigned Commitments", value: unsigned.length, accent: "working", sub: "chase the paperwork" },
      ]} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel title="Commitment Mix" hint="committed units by sale type" height={270}>
          <CategoryBars data={mix.map((m) => ({ name: m.name, value: m.value }))} series={["value"]}
            layout="vertical" colors={Object.fromEntries(mix.map((m) => [m.name, m.fill]))} />
        </ChartPanel>
        {openBySale.data.length > 0 && (
          <ChartPanel title="Progress on Committed Units" hint="work stage × sale type" height={270}>
            <CategoryBars data={openBySale.data} series={openBySale.series} layout="horizontal" stacked colors={workColors} legend />
          </ChartPanel>
        )}
      </div>

      {reps.length > 0 && (
        <section className="card p-4">
          <p className="eyebrow mb-2">Sold Revenue by Salesperson</p>
          <Leaderboard columns={repCols} rows={reps} rowKey={(r) => r.name} initialSort={{ key: "totalSale", asc: false }} maxRows={15} />
        </section>
      )}

      {unsigned.length > 0 && (
        <section className="card border-working/30 p-4">
          <p className="eyebrow text-working">Unsigned Commitments — Chase These ({fmt(unsigned.length)})</p>
          <div className="mt-3 space-y-1.5">
            {unsigned.slice(0, 40).map((u) => (
              <div key={u.rowIndex} className="flex items-center justify-between gap-3 border-b border-line/40 pb-1.5 text-[11px]">
                <span className="truncate text-ink">{unitTitle(u)}</span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-ink-dim">{u.soldBy ?? "—"}</span>
                  <span className="text-ink-faint">{u.customer ?? ""}</span>
                  <span className="w-16 text-right tabular-nums text-pif">{fmtMoney(u.price)}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={[`Committed units: ${committed.length}`, `Committed value: ${fmtMoney(committedVal || null)}`, `Open work on committed: ${openOnCommitted.length}`, `Unsigned commitments: ${unsigned.length}`]} />
    </div>
  );
}
