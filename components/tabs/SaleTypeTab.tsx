"use client";

import { useMemo } from "react";
import type { TabContext } from "./CategoryTab";
import type { SaleBucket, WorkBucket } from "@/lib/types";
import { TabHeader } from "./TabHeader";
import { StatCards } from "../viz/StatCards";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { TabAI } from "./TabAI";
import { SALE_LABEL, WORK_LABEL, WORK_HEX } from "@/lib/buckets";
import { fmtMoney } from "@/lib/format";

const SALE_ORDER: SaleBucket[] = ["paid_in_full", "down_payment", "govt_po", "rental", "other"];
const WORK_ORDER: WorkBucket[] = ["needs_diagnosis", "working", "ready", "on_rent", "sold"];

export function SaleTypeTab({ category, units, entities, schema, parsed }: TabContext) {
  const committed = useMemo(() => units.filter((u) => u.committed), [units]);
  const committedVal = committed.reduce((s, u) => s + (u.price ?? 0), 0);
  const openOnCommitted = committed.filter((u) => u.work === "working" || u.work === "needs_diagnosis");
  const unsigned = committed.filter((u) => !u.signed);

  // Work stage on committed units, by sale type — unique to this tab. (Sale-type
  // mix lives on Overview; rep leaderboard + unsigned chase live on the Staff tab.)
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

  return (
    <div className="space-y-5 fade-up">
      <TabHeader category={category} />
      <StatCards cols={4} items={[
        { label: "Committed Units", value: committed.length, accent: "pif", sub: "paid / deposit / govt PO" },
        { label: "Committed Value", value: committedVal || null, money: true, accent: "ready", sub: "Σ final sale price" },
        { label: "Open Work on Committed", value: openOnCommitted.length, accent: "diag", sub: "promised, not finished" },
        { label: "Unsigned Commitments", value: unsigned.length, accent: "working", sub: "chase on the Staff tab" },
      ]} />

      {openBySale.data.length > 0 && (
        <ChartPanel title="Progress on Committed Units" hint="work stage × sale type · stacked" height={300}>
          <CategoryBars data={openBySale.data} series={openBySale.series} layout="horizontal" stacked colors={workColors} legend />
        </ChartPanel>
      )}

      <TabAI category={category} entities={entities} schema={schema} parsed={parsed}
        stats={[`Committed units: ${committed.length}`, `Committed value: ${fmtMoney(committedVal || null)}`, `Open work on committed: ${openOnCommitted.length}`, `Unsigned commitments: ${unsigned.length}`]} />
    </div>
  );
}
