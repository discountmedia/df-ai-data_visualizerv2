"use client";

import { useMemo } from "react";
import { deriveMetrics } from "@/lib/deriveMetrics";
import { MetricCard } from "./MetricCard";
import { AlertBanner } from "../AlertBanner";
import { OverviewCharts } from "../charts/OverviewCharts";
import { EmptyState } from "../states/States";
import { DistributionBar } from "../viz/DistributionBar";
import { fmt } from "@/lib/format";
import type { LocationSnapshot, UnitRecord } from "@/lib/types";

/**
 * The at-a-glance command center. Receives units already filtered by the global
 * location bar; `allLocations` (full, unfiltered) feeds the yard snapshot so it
 * always shows every yard.
 */
export function OverviewGrid({ units, allLocations }: { units: UnitRecord[]; allLocations: LocationSnapshot[] }) {
  const m = useMemo(() => deriveMetrics(units), [units]);
  if (units.length === 0) return <EmptyState title="No unit rows for this filter" />;

  return (
    <div className="space-y-5 fade-up">
      <AlertBanner openWorkOnSold={m.openWorkOnSold} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Fleet" metric={m.totalFleet} accent="ink" />
        <MetricCard label="Ready to Sell" metric={m.ready} accent="ready" subtext="Fully prepped" />
        <MetricCard label="Being Worked On" metric={m.working} accent="working" subtext="Service / body" />
        <MetricCard label="Needs Diagnosis" metric={m.needsDiagnosis} accent="diag" subtext="Act first" />
        <MetricCard label="On Rent" metric={m.onRent} accent="rent" subtext="Generating income" />
        <MetricCard label="Sold" metric={m.sold} accent="diag" subtext="Closed deals" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Paid in Full" metric={m.paidInFull} accent="pif" subtext="Top tier" />
        <MetricCard label="Down Payment" metric={m.downPayment} accent="downpmt" subtext="Deposit recv'd" />
        <MetricCard label="Govt PO's" metric={m.govtPo} accent="govt" subtext="Contract" />
        <MetricCard label="Open Work on Sold" metric={m.openWorkOnSold} accent="diag" subtext="Fix now" />
      </div>

      <OverviewCharts units={units} />

      <LocationsSnapshot locations={allLocations} />
    </div>
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
            {l.sold > 0 && <p className="mt-1 text-[10px] text-ink-faint">Sold: {fmt(l.sold)}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}
