"use client";

import { useEffect, useMemo } from "react";
import { useDashboard } from "@/components/DashboardProvider";
import { SchemaReview } from "@/components/SchemaReview";
import { Header } from "@/components/Header";
import { LocationBar } from "@/components/LocationBar";
import { OverviewGrid } from "@/components/overview/OverviewGrid";
import { InsightsTab } from "@/components/insights/InsightsTab";
import { CategoryTab } from "@/components/tabs/CategoryTab";
import { LoadingState, ErrorState, EmptyState } from "@/components/states/States";
import { deriveSales } from "@/lib/deriveSales";
import { deriveUnits } from "@/lib/deriveUnits";
import { deriveMetrics } from "@/lib/deriveMetrics";
import { scoreUnits } from "@/lib/score";
import { buildCategories } from "@/lib/categories";
import { orderCategories } from "@/lib/categoryConfig";

export default function Page() {
  const { phase, parsed, entities, schema, overrides, error, reset, activeTab, setTab, locationFilter, loadAutoData } = useDashboard();

  // No upload splash — land straight in the bundled test data (live, the backend feeds this).
  useEffect(() => {
    if (phase === "idle") loadAutoData();
  }, [phase, loadAutoData]);

  const salesSummary = useMemo(
    () => (entities && schema ? deriveSales(entities, schema) : null),
    [entities, schema]
  );
  const allUnits = useMemo(
    () => (entities && schema ? deriveUnits(entities, schema, overrides) : []),
    [entities, schema, overrides]
  );
  // Global location filter — drives the Overview AND every category tab.
  const units = useMemo(
    () => (locationFilter === "ALL" ? allUnits : allUnits.filter((u) => (u.location ?? "Unassigned") === locationFilter)),
    [allUnits, locationFilter]
  );
  const scoring = useMemo(() => scoreUnits(units), [units]);
  const metrics = useMemo(() => deriveMetrics(units), [units]);
  // Full (unfiltered) location list so the filter bar + yard snapshot always show every yard.
  const allLocations = useMemo(() => deriveMetrics(allUnits).locations, [allUnits]);
  const categories = useMemo(() => orderCategories(buildCategories(schema, entities)), [schema, entities]);

  if (phase === "idle") return <LoadingState label="Loading inventory…" />;
  if (phase === "parsing") return <LoadingState label="Parsing inventory export…" />;
  if (phase === "inferring") return <LoadingState label="Inferring schema with AI…" />;
  if (phase === "error")
    return (
      <div className="px-5 py-16">
        <ErrorState message={error ?? "Something went wrong."} onRetry={reset} />
      </div>
    );
  if (phase === "review") return <SchemaReview />;

  // ready
  if (!parsed || !schema) return null;
  const unitCount = entities?.base.rowCount ?? parsed.rows.length;
  const current = activeTab || "overview";
  const tabs = [
    { id: "overview", label: "Overview", count: unitCount },
    ...categories.map((c) => ({ id: `cat:${c.id}`, label: c.label, count: c.columns.length })),
  ];
  const activeCat = current.startsWith("cat:") ? categories.find((c) => `cat:${c.id}` === current) : null;

  const onAnalyze = () => {
    setTab("overview");
    setTimeout(() => document.getElementById("ai-insights")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  return (
    <div className="min-h-screen">
      <Header
        fileName={parsed.fileName}
        unitCount={unitCount}
        source={schema.source}
        tabs={tabs}
        activeTab={current}
        onTab={setTab}
        onReset={reset}
        onAnalyze={onAnalyze}
      />
      {allLocations.length > 0 && (
        <div className="border-b border-line bg-ground/60">
          <div className="mx-auto max-w-7xl px-5">
            <LocationBar locations={allLocations} />
          </div>
        </div>
      )}
      <main className="mx-auto max-w-7xl px-5 py-6">
        {activeCat ? (
          <CategoryTab
            category={activeCat}
            units={units}
            sales={salesSummary}
            scoring={scoring}
            metrics={metrics}
            entities={entities}
            schema={schema}
            parsed={parsed}
          />
        ) : (
          <div className="space-y-8 fade-up">
            {units.length ? <OverviewGrid units={units} allLocations={allLocations} /> : <EmptyState title="No unit rows for this filter" />}
            <div id="ai-insights">
              <InsightsTab scoring={scoring} units={units} sales={salesSummary} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
