"use client";

import type { SalesSummary } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import { SummarizePanel } from "../tabs/SummarizePanel";

/**
 * Opt-in, sales-focused AI read. Reuses the per-tab SummarizePanel (Claude only,
 * no fetch until the user clicks). Hands the model an already-aggregated stats
 * array — never raw rows or customer PII — honoring "AI only narrates."
 */
export function SalesAI({
  summary, activeReps, totalSaleVal, avgSale, signed, totalDeals, signRate,
}: {
  summary: SalesSummary;
  activeReps: number;
  totalSaleVal: number;
  avgSale: number | null;
  signed: number;
  totalDeals: number;
  signRate: number;
}) {
  const topRep = [...summary.reps].sort((a, b) => b.unitsSold - a.unitsSold)[0];
  const stats = [
    `Total units sold: ${summary.totalSold}`,
    `Reps active: ${activeReps} of ${summary.reps.length} on team`,
    `Total attributed sales: ${fmtMoney(totalSaleVal || null)}`,
    `Avg sale per unit: ${fmtMoney(avgSale)}`,
    `Signature rate: ${signRate}% (${signed} of ${totalDeals} attributed deals signed)`,
    `Unsigned committed deals to chase: ${summary.unsignedCount}`,
    `Emails sent (outreach proxy): ${summary.emailsAvailable ? summary.totalEmails : "n/a"}`,
    `Top rep by units: ${topRep ? `${topRep.name} (${topRep.unitsSold})` : "n/a"}`,
  ];
  return (
    <section className="card border-brand/30 bg-brand/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow text-brand">Ask AI · Sales Team</p>
        <span className="text-[10px] text-ink-faint">off by default · nothing sent until you click</span>
      </div>
      <div className="mt-3">
        <SummarizePanel category="Sales Team" stats={stats} siblings={["Overview", "Work Stage", "Location"]} />
      </div>
    </section>
  );
}
