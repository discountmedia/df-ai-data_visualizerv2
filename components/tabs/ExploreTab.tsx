"use client";

import { CategoryExplorer } from "../explore/CategoryExplorer";
import { resolveCategorySource } from "@/lib/categories";
import { TabHeader } from "./TabHeader";
import { SummarizePanel } from "./SummarizePanel";
import type { TabContext } from "./CategoryTab";

/** Fallback layout: AI summarize + the generic connection/pivot explorer. */
export function ExploreTab({ category, entities, schema, parsed }: TabContext) {
  const src = resolveCategorySource(category, entities, schema, parsed);
  return (
    <div className="space-y-4 fade-up">
      <TabHeader category={category} />
      {src.rows.length === 0 ? (
        <p className="text-xs text-ink-faint">No rows in the {category.label} table.</p>
      ) : (
        <>
          <section className="card border-brand/30 bg-brand/5 p-4">
            <p className="eyebrow text-brand mb-2">Ask AI · {category.label}</p>
            <SummarizePanel category={category.label}
              stats={[`${src.rows.length} rows`, `${src.columns.length} columns in scope`]} />
          </section>
          <CategoryExplorer
            label={category.label}
            sourceKey={src.sourceKey}
            rows={src.rows}
            columns={src.columns}
            defaultDimension={src.defaultDimension}
          />
        </>
      )}
    </div>
  );
}
