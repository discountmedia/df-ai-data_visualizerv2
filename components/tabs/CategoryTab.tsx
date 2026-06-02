"use client";

import type { Category } from "@/lib/categories";
import type {
  UnitRecord, SalesSummary, ScoringResult, OverviewMetrics, EntitySet, SchemaProfile, ParsedFile,
} from "@/lib/types";
import { resolveView } from "@/lib/categoryConfig";
import { ExploreTab } from "./ExploreTab";
import { WorkStageTab } from "./WorkStageTab";
import { SaleTypeTab } from "./SaleTypeTab";
import { LocationTab } from "./LocationTab";
import { MetricTab } from "./MetricTab";
import { StaffTab } from "./StaffTab";
import { OtherTab } from "./OtherTab";

/** Everything a tab might need; computed once in page.tsx and passed down. */
export interface TabContext {
  category: Category;
  units: UnitRecord[];
  sales: SalesSummary | null;
  scoring: ScoringResult;
  metrics: OverviewMetrics;
  entities?: EntitySet;
  schema: SchemaProfile;
  parsed: ParsedFile;
}

export function CategoryTab(ctx: TabContext) {
  switch (resolveView(ctx.category).layout) {
    case "workStage": return <WorkStageTab {...ctx} />;
    case "saleType": return <SaleTypeTab {...ctx} />;
    case "location": return <LocationTab {...ctx} />;
    case "metric": return <MetricTab {...ctx} />;
    case "staff": return <StaffTab {...ctx} />;
    case "other": return <OtherTab {...ctx} />;
    default: return <ExploreTab {...ctx} />;
  }
}
