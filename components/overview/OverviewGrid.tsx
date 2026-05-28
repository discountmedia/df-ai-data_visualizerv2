"use client";

import { useMemo } from "react";
import { useDashboard } from "../DashboardProvider";
import { deriveMetrics } from "@/lib/deriveMetrics";
import { MetricCard } from "./MetricCard";
import { AlertBanner } from "../AlertBanner";
import { LocationBar } from "../LocationBar";
import { EmptyState } from "../states/States";
import { cn, fmt } from "@/lib/format";
import type { LocationSnapshot, Row } from "@/lib/types";

export function OverviewGrid() {
  const { parsed, entities, schema, overrides, locationFilter } = useDashboard();

  // Use only base (unit) rows — never the email/staff/round-robin rows.
  const baseRows: Row[] = entities?.rowsByEntity["base"] ?? parsed?.rows ?? [];

  const allMetrics = useMemo(() => {
    if (!schema) return null;
    return deriveMetrics(baseRows, schema, overrides);
  }, [baseRows, schema, overrides]);

  const filtered = useMemo(() => {
    if (!schema) return null;
    const locCol = schema.conceptMap.location;
    const rows =
      locationFilter === "ALL" || !locCol
        ? baseRows
        : baseRows.filter((r) => String(r[locCol] ?? "") === locationFilter);
    return deriveMetrics(rows, schema, overrides);
  }, [baseRows, schema, overrides, locationFilter]);

  if (!schema || !allMetrics || !filtered) return null;
  if (baseRows.length === 0) return <EmptyState title="No unit rows to display" />;

  return (
    <div className="space-y-5 fade-up">
      <LocationBar locations={allMetrics.locations} />
      <AlertBanner openWorkOnSold={filtered.openWorkOnSold} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard label="Total Fleet" metric={filtered.totalFleet} accent="ink" />
        <MetricCard label="Ready to Sell" metric={filtered.ready} accent="ready" subtext="Fully prepped" />
        <MetricCard label="Being Worked On" metric={filtered.working} accent="working" subtext="Service / body" />
        <MetricCard label="Needs Diagnosis" metric={filtered.needsDiagnosis} accent="diag" subtext="Act first" />
        <MetricCard label="On Rent" metric={filtered.onRent} accent="rent" subtext="Generating income" />
        <MetricCard label="Sold" metric={filtered.sold} accent="diag" subtext="Closed deals" />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Paid in Full" metric={filtered.paidInFull} accent="pif" subtext="Top tier" />
        <MetricCard label="Down Payment" metric={filtered.downPayment} accent="downpmt" subtext="Deposit recv'd" />
        <MetricCard label="Govt PO's" metric={filtered.govtPo} accent="govt" subtext="Contract" />
        <MetricCard label="Open Work on Sold" metric={filtered.openWorkOnSold} accent="diag" subtext="Fix now" />
      </div>

      <LocationsSnapshot locations={allMetrics.locations} />
    </div>
  );
}

const BAR_SEGMENTS: { key: keyof LocationSnapshot; cls: string }[] = [
  { key: "ready", cls: "bg-ready" },
  { key: "working", cls: "bg-working" },
  { key: "needs_diagnosis", cls: "bg-diag" },
  { key: "on_rent", cls: "bg-rent" },
];

function LocationsSnapshot({ locations }: { locations: LocationSnapshot[] }) {
  if (locations.length === 0) return null;
  return (
    <section>
      <p className="eyebrow mb-3">Locations — Snapshot</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {locations.slice(0, 12).map((l) => {
          const known = l.ready + l.working + l.needs_diagnosis + l.on_rent || 1;
          return (
            <div key={l.name} className="card p-3">
              <div className="flex items-baseline justify-between">
                <span className="truncate text-sm font-bold text-ink">{l.name}</span>
                <span className="text-[11px] text-ink-faint">{fmt(l.total)} units</span>
              </div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-sm">
                {BAR_SEGMENTS.map((s) => {
                  const val = l[s.key] as number;
                  if (!val) return null;
                  return <div key={s.key} className={s.cls} style={{ width: `${(val / known) * 100}%` }} />;
                })}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[11px]">
                <Stat label="Ready" value={l.ready} cls="text-ready" />
                <Stat label="Working" value={l.working} cls="text-working" />
                <Stat label="Need Diag" value={l.needs_diagnosis} cls="text-diag" />
                <Stat label="On Rent" value={l.on_rent} cls="text-rent" />
                <Stat label="Sold" value={l.sold} cls="text-ink-dim" />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div>
      <p className="text-ink-faint">{label}</p>
      <p className={cn("font-bold tabular-nums", cls)}>{fmt(value)}</p>
    </div>
  );
}
