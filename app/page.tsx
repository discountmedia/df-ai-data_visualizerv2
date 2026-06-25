"use client";

import { useEffect, useMemo, useState } from "react";
import { useDashboard } from "@/components/DashboardProvider";
import { SchemaReview } from "@/components/SchemaReview";
import { Header } from "@/components/Header";
import { LocationBar } from "@/components/LocationBar";
import { OverviewGrid } from "@/components/overview/OverviewGrid";
import { InsightsTab } from "@/components/insights/InsightsTab";
import { AiAnalysisModal } from "@/components/insights/AiAnalysisModal";
import { SalesTeam } from "@/components/sales/SalesTeam";
import { SalesNumbersView } from "@/components/financials/SalesNumbersView";
import { WorkStageView } from "@/components/tabs/WorkStageView";
import { OctaneView } from "@/components/tabs/OctaneView";
import { MediaView } from "@/components/media/MediaView";
import { AdminUploads } from "@/components/admin/AdminUploads";
import { LoadingState, ErrorState, EmptyState } from "@/components/states/States";
import { deriveSales } from "@/lib/deriveSales";
import { deriveUnits } from "@/lib/deriveUnits";
import { deriveMedia, isListable } from "@/lib/deriveMedia";
import { scoreUnits } from "@/lib/score";
import { buildInsightsInput } from "@/lib/insightsClient";
import { splitOctaneUnits } from "@/lib/octane";
import { locationBucket, bucketedLocations } from "@/lib/location";
import { FINANCIALS_ENABLED } from "@/lib/features";

export default function Page() {
  const {
    phase, parsed, entities, schema, overrides, error, reset,
    activeTab, setTab, locationFilter, loadAutoData, schemaRefining, financials, media,
  } = useDashboard();

  // The header "AI Analysis" button opens a company-wide AI read in a modal popup
  // (overall: all locations + work stage + sales + OCTANE). Per-tab AI lives in
  // each tab's own AiAnalysisCard.
  const [overallAi, setOverallAi] = useState(false);

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
  // Work Stage now spans every yard incl. "Other" (owner ask) — it shares the
  // same location-filtered population + scoring as Overview.
  const allLocBuckets = useMemo(() => bucketedLocations(df), [df]);
  const filterBar = allLocBuckets;
  const overviewSnapshot = useMemo(() => bucketedLocations(dfFiltered), [dfFiltered]);
  // Listable DF inventory across the full (unfiltered) fleet — the stable Media
  // tab badge (matches the tab's "Listable Inventory" headline). The coverage
  // cards + by-yard bars re-derive from the location filter inside MediaView.
  const mediaAll = useMemo(() => deriveMedia(df.filter(isListable)), [df]);
  // Per-tab AI input for Overview (scoped to the current location filter).
  const overviewInput = useMemo(() => buildInsightsInput(scoring, dfFiltered, salesSummary), [scoring, dfFiltered, salesSummary]);
  // Company-wide AI input for the header modal — unfiltered DF fleet (every yard)
  // plus the OCTANE count, so the read spans all four tabs' worth of data.
  const overallScoring = useMemo(() => scoreUnits(df), [df]);
  const overallInput = useMemo(
    () => buildInsightsInput(overallScoring, df, salesSummary, { octaneCount: octane.length }),
    [overallScoring, df, salesSummary, octane.length]
  );

  if (phase === "idle" || phase === "parsing") return <LoadingState label="Loading inventory…" />;
  if (phase === "inferring") return <LoadingState label="Inferring schema with AI…" />;
  if (phase === "error")
    return <div className="px-5 py-16"><ErrorState message={error ?? "Something went wrong."} onRetry={reset} /></div>;
  if (phase === "review") return <SchemaReview />;
  if (!parsed || !schema) return null;

  const tabs = [
    { id: "overview", label: "Overview", count: df.length },
    { id: "workstage", label: "Work Stage", count: overallScoring.scoredCount },
    { id: "sales", label: "Sales Team", count: salesSummary ? salesSummary.totalSold : null },
    { id: "media", label: "Media", count: mediaAll.total },
    // Financials tab is hidden until the owner gives the go-ahead (see lib/features.ts).
    ...(FINANCIALS_ENABLED ? [{ id: "financials", label: "Financials", count: financials?.available ? financials.gpCount : null }] : []),
    { id: "octane", label: "OCTANE", count: octane.length },
    // Temporary admin tab for manual CSV uploads. Goes away once FileMaker Pro
    // pushes a JSON payload to the backend directly.
    { id: "admin", label: "Admin", count: null },
  ];
  // The location filter applies to Overview, Work Stage, Sales Team, Media, and
  // OCTANE. Financials is company-wide and Admin isn't location-scoped, so hide
  // the bar there rather than leave a dead control.
  const showLocationBar = filterBar.length > 0 && current !== "financials" && current !== "admin";
  // Header button → open the company-wide AI read in a modal (runs immediately).
  // Stays on the current tab; the popup overlays everything.
  const onAnalyze = () => setOverallAi(true);

  return (
    <div className="min-h-screen">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-brand-strong focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        Skip to content
      </a>
      <Header
        tabs={tabs}
        activeTab={current}
        onTab={setTab}
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
            {dfFiltered.length ? <OverviewGrid units={dfFiltered} allLocations={overviewSnapshot} aiInput={overviewInput} /> : <EmptyState title="No units for this filter" />}
            <InsightsTab scoring={scoring} />
          </div>
        )}
        {current === "workstage" && <WorkStageView units={dfFiltered} scoring={scoring} />}
        {current === "sales" && (salesSummary ? <SalesTeam summary={salesSummary} locationFilter={locationFilter} /> : <EmptyState title="No sales data" />)}
        {current === "media" && <MediaView units={dfFiltered} production={media} />}
        {FINANCIALS_ENABLED && current === "financials" && <SalesNumbersView financials={financials} />}
        {current === "octane" && <OctaneView units={octaneFiltered} />}
        {current === "admin" && <AdminUploads />}
      </main>
      {overallAi && (
        <AiAnalysisModal title="Fleet-wide AI Analysis" input={overallInput} onClose={() => setOverallAi(false)} />
      )}
    </div>
  );
}
