"use client";

import { useMemo, useState } from "react";
import { useDashboard } from "@/components/DashboardProvider";
import { FileUpload } from "@/components/FileUpload";
import { SchemaReview } from "@/components/SchemaReview";
import { Header, type Tab } from "@/components/Header";
import { OverviewGrid } from "@/components/overview/OverviewGrid";
import { SalesTeam } from "@/components/sales/SalesTeam";
import { LoadingState, ErrorState, EmptyState } from "@/components/states/States";
import { deriveSales } from "@/lib/deriveSales";

export default function Page() {
  const { phase, parsed, entities, schema, error, reset, loadSample } = useDashboard();
  const [tab, setTab] = useState<Tab>("overview");

  const salesSummary = useMemo(() => {
    if (!entities || !schema) return null;
    return deriveSales(entities, schema);
  }, [entities, schema]);

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
        onReset={reset}
      />
      <main className="mx-auto max-w-7xl px-5 py-6">
        {tab === "overview" && <OverviewGrid />}
        {tab === "sales" &&
          (salesSummary ? (
            <SalesTeam summary={salesSummary} />
          ) : (
            <EmptyState title="No sales data" />
          ))}
        {(tab === "priority" || tab === "all" || tab === "insights") && (
          <ComingSoon tab={tab} onSample={loadSample} />
        )}
      </main>
    </div>
  );
}

function ComingSoon({ tab, onSample }: { tab: Tab; onSample: () => void }) {
  const copy: Record<string, string> = {
    priority: "AI-scored priority queue — which units to work first — lands in the next slice.",
    all: "The sortable / filterable all-units table with status pills is next on the roadmap.",
    insights: "The AI Insights tab (with a visible 'how scores were calculated' panel) comes after scoring.",
  };
  return (
    <div className="py-20 text-center">
      <p className="eyebrow text-brand">Coming soon</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ink-dim">{copy[tab]}</p>
    </div>
  );
}
