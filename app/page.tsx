"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "@/components/DashboardProvider";
import { FileUpload } from "@/components/FileUpload";
import { SchemaReview } from "@/components/SchemaReview";
import { Header, type Tab } from "@/components/Header";
import { OverviewGrid } from "@/components/overview/OverviewGrid";
import { SalesTeam } from "@/components/sales/SalesTeam";
import { AllUnits } from "@/components/all/AllUnits";
import { PriorityQueue } from "@/components/priority/PriorityQueue";
import { InsightsTab } from "@/components/insights/InsightsTab";
import { LoadingState, ErrorState, EmptyState } from "@/components/states/States";
import { deriveSales } from "@/lib/deriveSales";
import { deriveUnits } from "@/lib/deriveUnits";
import { scoreUnits } from "@/lib/score";

export default function Page() {
  const { phase, parsed, entities, schema, overrides, error, reset } = useDashboard();
  const [tab, setTab] = useState<Tab>("overview");

  const salesSummary = useMemo(() => {
    if (!entities || !schema) return null;
    return deriveSales(entities, schema);
  }, [entities, schema]);

  const units = useMemo(() => {
    if (!entities || !schema) return [];
    return deriveUnits(entities, schema, overrides);
  }, [entities, schema, overrides]);

  const scoring = useMemo(() => scoreUnits(units), [units]);

  if (phase === "idle") return <FileUpload />;
  if (phase === "parsing") return <LoadingState label="Parsing spreadsheet…" />;
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

  return (
    <div className="min-h-screen">
      <Header
        fileName={parsed.fileName}
        unitCount={unitCount}
        source={schema.source}
        activeTab={tab}
        onTab={setTab}
        salesCount={salesSummary ? salesSummary.totalSold : null}
        priorityCount={scoring.scoredCount}
        onReset={reset}
      />
      <main className="mx-auto max-w-7xl px-5 py-6">
        {tab === "overview" && <OverviewGrid units={units} />}
        {tab === "sales" &&
          (salesSummary ? (
            <SalesTeam summary={salesSummary} />
          ) : (
            <EmptyState title="No sales data" />
          ))}
        {tab === "all" && <AllUnits units={units} />}
        {tab === "priority" && <PriorityQueue scoring={scoring} />}
        {tab === "insights" && <InsightsTab scoring={scoring} units={units} sales={salesSummary} />}
      </main>
    </div>
  );
}
