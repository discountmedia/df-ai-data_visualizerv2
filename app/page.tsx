"use client";

import { useEffect, useMemo } from "react";
import { useDashboard } from "@/components/DashboardProvider";
import { SchemaReview } from "@/components/SchemaReview";
import { Header } from "@/components/Header";
import { LocationBar } from "@/components/LocationBar";
import { OverviewGrid } from "@/components/overview/OverviewGrid";
import { InsightsTab } from "@/components/insights/InsightsTab";
import { SalesTeam } from "@/components/sales/SalesTeam";
import { SalesNumbersView } from "@/components/financials/SalesNumbersView";
import { WorkStageView } from "@/components/tabs/WorkStageView";
import { OctaneView } from "@/components/tabs/OctaneView";
import { LoadingState, ErrorState, EmptyState } from "@/components/states/States";
import { deriveSales } from "@/lib/deriveSales";
import { deriveUnits } from "@/lib/deriveUnits";
import { scoreUnits } from "@/lib/score";
import { splitOctaneUnits } from "@/lib/octane";
import { locationBucket, bucketedLocations } from "@/lib/location";
import { FINANCIALS_ENABLED } from "@/lib/features";

export default function Page() {
  const {
    phase, parsed, entities, schema, overrides, error, reset,
    activeTab, setTab, locationFilter, loadAutoData, schemaRefining, financials,
  } = useDashboard();

  // No upload splash — land straight in the bundled data (live, PRO pushes this).
  useEffect(() => {
    if (phase === "idle") loadAutoData();
  }, [phase, loadAutoData]);

  const salesSummary = useMemo(() => (entities && schema ? deriveSales(entities, schema) : null), [entities, schema]);
  const allUnits = useMemo(() => (entities && schema ? deriveUnits(entities, schema, overrides) : []), [entities, schema, overrides]);
  // OCTANE is a separate company — split it out so its units never blend into DF metrics.
  const { df, octane } = useMemo(() => splitOctaneUnits(allUnits), [allUnits]);
  const current = activeTab || "overview";

  // Global location filter (4 yards + Other) drives every tab.
  const byLoc = (units: typeof df) => (locationFilter === "ALL" ? units : units.filter((u) => locationBucket(u.location) === locationFilter));
  const dfFiltered = useMemo(() => byLoc(df), [df, locationFilter]);
  const octaneFiltered = useMemo(() => byLoc(octane), [octane, locationFilter]);
  const scoring = useMemo(() => scoreUnits(dfFiltered), [dfFiltered]);
  // Work Stage covers only the 4 main yards (Denver / Las Vegas / Phoenix / DFW);
  // misc/"Other" locations are excluded from the service pipeline + priority queue.
  const dfMain = useMemo(() => df.filter((u) => locationBucket(u.location) !== "Other"), [df]);
  const workStageUnits = useMemo(() => byLoc(dfMain), [dfMain, locationFilter]);
  const workStageScoring = useMemo(() => scoreUnits(workStageUnits), [workStageUnits]);
  // Unfiltered totals for the tab badges — keeps them from changing width (jumping)
  // every time you click a location. Work Stage badge counts main-yard units only.
  const scoringAll = useMemo(() => scoreUnits(dfMain), [dfMain]);
  const allLocBuckets = useMemo(() => bucketedLocations(df), [df]);
  // Work Stage covers only the 4 main yards — drop the dead "Other" pill there.
  const filterBar = current === "workstage" ? allLocBuckets.filter((l) => l.name !== "Other") : allLocBuckets;
  const overviewSnapshot = useMemo(() => bucketedLocations(dfFiltered), [dfFiltered]);

  if (phase === "idle" || phase === "parsing") return <LoadingState label="Loading inventory…" />;
  if (phase === "inferring") return <LoadingState label="Inferring schema with AI…" />;
  if (phase === "error")
    return <div className="px-5 py-16"><ErrorState message={error ?? "Something went wrong."} onRetry={reset} /></div>;
  if (phase === "review") return <SchemaReview />;
  if (!parsed || !schema) return null;

  const tabs = [
    { id: "overview", label: "Overview", count: df.length },
    { id: "workstage", label: "Work Stage", count: scoringAll.scoredCount },
    { id: "sales", label: "Sales Team", count: salesSummary ? salesSummary.totalSold : null },
    // Financials tab is hidden until the owner gives the go-ahead (see lib/features.ts).
    ...(FINANCIALS_ENABLED ? [{ id: "financials", label: "Financials", count: financials?.available ? financials.gpCount : null }] : []),
    { id: "octane", label: "OCTANE", count: octane.length },
  ];
  // The location filter doesn't apply to Sales Team or Financials (both are
  // company-wide), so hide the bar there rather than leave a dead control.
  const showLocationBar = filterBar.length > 0 && current !== "sales" && current !== "financials";
  const onAnalyze = () => {
    setTab("overview");
    const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(() => document.getElementById("ai-insights")?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" }), 60);
  };

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-strong focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <Header
        fileName={parsed.fileName}
        unitCount={df.length}
        source={schema.source}
        tabs={tabs}
        activeTab={current}
        onTab={setTab}
        onReset={reset}
        onAnalyze={onAnalyze}
        refining={schemaRefining}
      />
      {showLocationBar && (
        <div className="border-b border-line bg-ground/60">
          <div className="mx-auto max-w-7xl px-5">
            <LocationBar locations={filterBar} />
          </div>
        </div>
      )}
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl px-5 py-6 focus:outline-none">
        {current === "overview" && (
          <div className="space-y-8 fade-up">
            {dfFiltered.length ? <OverviewGrid units={dfFiltered} allLocations={overviewSnapshot} /> : <EmptyState title="No units for this filter" />}
            <div id="ai-insights"><InsightsTab scoring={scoring} units={dfFiltered} sales={salesSummary} /></div>
          </div>
        )}
        {current === "workstage" && <WorkStageView units={workStageUnits} scoring={workStageScoring} />}
        {current === "sales" && (salesSummary ? <SalesTeam summary={salesSummary} /> : <EmptyState title="No sales data" />)}
        {FINANCIALS_ENABLED && current === "financials" && <SalesNumbersView financials={financials} />}
        {current === "octane" && <OctaneView units={octaneFiltered} />}
      </main>
    </div>
  );
}
