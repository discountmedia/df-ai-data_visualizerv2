"use client";

import { useMemo, useState } from "react";
import { deriveMetrics } from "@/lib/deriveMetrics";
import { MetricCard } from "./MetricCard";
import { UnitsDrawer } from "./UnitsDrawer";
import { AlertBanner } from "../AlertBanner";
import { OverviewCharts } from "../charts/OverviewCharts";
import { AiAnalysisCard } from "../insights/AiAnalysisCard";
import { EmptyState } from "../states/States";
import { DistributionBar } from "../viz/DistributionBar";
import { fmt } from "@/lib/format";
import { locationBucket } from "@/lib/location";
import type { InsightsInput } from "@/lib/insightsClient";
import type { LocationSnapshot, UnitRecord, WorkBucket, SaleBucket } from "@/lib/types";

/**
 * The at-a-glance command center. Receives units already filtered by the global
 * location bar; `allLocations` (full, unfiltered) feeds the yard snapshot so it
 * always shows every yard.
 */
export function OverviewGrid({ units, allLocations, aiInput }: { units: UnitRecord[]; allLocations: LocationSnapshot[]; aiInput: InsightsInput }) {
  const m = useMemo(() => deriveMetrics(units), [units]);
  const [drill, setDrill] = useState<{ title: string; units: UnitRecord[] } | null>(null);
  if (units.length === 0) return <EmptyState title="No unit rows for this filter" />;

  // Each card drills into the exact units behind its number (same buckets the
  // metric counts — see deriveMetrics — so the table can never contradict the card).
  const open = (title: string, list: UnitRecord[]) => () => setDrill({ title, units: list });
  const byWork = (w: WorkBucket) => units.filter((u) => u.work === w);
  const bySale = (s: SaleBucket) => units.filter((u) => u.sale === s);
  const openWorkUnits = units.filter((u) => u.committed && (u.work === "working" || u.work === "needs_diagnosis"));
  // "Needs Diagnosis" is the act-first recon metric — only the 4 main yards run
  // recon, so exclude "Other"-location lifts from this card (and its drill-down).
  const needsDiagMain = units.filter((u) => u.work === "needs_diagnosis" && locationBucket(u.location) !== "Other");

  return (
    <>
      <div className="space-y-5 fade-up">
        <div>
          <p className="eyebrow text-brand">Overview</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Fleet at a glance</h1>
        </div>

        <AlertBanner openWorkOnSold={m.openWorkOnSold} />

        {/* Two labelled lenses — physical work stage, then commercial payment
            status — so the eye knows each row measures a different thing (and
            that neither is a strict partition of Total Fleet). */}
        <section>
          <p className="eyebrow mb-2 text-ink-faint">Work stage</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <MetricCard label="Total Fleet" metric={m.totalFleet} accent="ink" subtext="Every unit" onClick={open("Total Fleet", units)} />
            <MetricCard label="Ready to Sell" metric={m.ready} accent="ready" subtext="Fully prepped" onClick={open("Ready to Sell", byWork("ready"))} />
            <MetricCard label="Being Worked On" metric={m.working} accent="working" subtext="Service / body" onClick={open("Being Worked On", byWork("working"))} />
            <MetricCard label="Needs Diagnosis" metric={needsDiagMain.length} accent="diag" subtext="Act first · 4 main yards" onClick={open("Needs Diagnosis", needsDiagMain)} />
            <MetricCard label="On Rent" metric={m.onRent} accent="rent" subtext="Generating income" onClick={open("On Rent", byWork("on_rent"))} />
            {/* Sold is a win, not an alarm — neutral, so red stays reserved for act-now. */}
            <MetricCard label="Sold" metric={m.sold} accent="ink" subtext="Closed deals" onClick={open("Sold", byWork("sold"))} />
          </div>
        </section>

        <section>
          <p className="eyebrow mb-2 text-ink-faint">Payment status</p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Paid in Full" metric={m.paidInFull} accent="pif" subtext="Top tier" onClick={open("Paid in Full", bySale("paid_in_full"))} />
            <MetricCard label="Down Payment" metric={m.downPayment} accent="downpmt" subtext="Deposit recv'd" onClick={open("Down Payment", bySale("down_payment"))} />
            <MetricCard label="Govt PO's" metric={m.govtPo} accent="govt" subtext="Contract" onClick={open("Govt PO's", bySale("govt_po"))} />
            <MetricCard label="Open Work on Sold" metric={m.openWorkOnSold} accent="diag" subtext="Fix now" onClick={open("Open Work on Sold", openWorkUnits)} />
          </div>
        </section>

        {/* Yard snapshot sits directly under the KPIs (next to the location bar
            that introduced the same yards) so the "where is my inventory" story
            is contiguous instead of split across the whole page. */}
        <LocationsSnapshot locations={allLocations} />

        <OverviewCharts units={units} />

        {/* Opt-in narrative comes AFTER the deterministic facts, not wedged mid-scan. */}
        <AiAnalysisCard
          input={aiInput}
          blurb="AI analysis is off by default — click Run to have Claude read this fleet (work stage, payment mix, priority queue) and surface what needs attention."
        />
      </div>
      {drill && <UnitsDrawer title={drill.title} units={drill.units} onClose={() => setDrill(null)} />}
    </>
  );
}

const SEG: { key: keyof LocationSnapshot; cls: string; label: string }[] = [
  { key: "ready", cls: "bg-ready", label: "Ready" },
  { key: "working", cls: "bg-working", label: "Working" },
  { key: "needs_diagnosis", cls: "bg-diag", label: "Need Diag" },
  { key: "on_rent", cls: "bg-rent", label: "On Rent" },
];

function LocationsSnapshot({ locations }: { locations: LocationSnapshot[] }) {
  if (locations.length === 0) return null;
  return (
    <section>
      <h2 className="eyebrow mb-3">Locations — Snapshot</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {locations.slice(0, 12).map((l) => (
          <div key={l.name} className="card p-3">
            <div className="flex items-baseline justify-between">
              <span className="truncate text-sm font-bold text-ink">{l.name}</span>
              <span className="text-[13px] text-ink-faint">{fmt(l.total)} units</span>
            </div>
            <div className="mt-2">
              <DistributionBar segments={SEG.map((s) => ({ label: s.label, value: l[s.key] as number, cls: s.cls }))} legend />
            </div>
            {l.sold > 0 && <p className="mt-1 text-[12px] text-ink-faint">Sold: {fmt(l.sold)}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
