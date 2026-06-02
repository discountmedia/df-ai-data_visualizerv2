"use client";

import { useMemo, useState } from "react";
import type { Category } from "@/lib/categories";
import type { EntitySet, SchemaProfile, ParsedFile } from "@/lib/types";
import { resolveCategorySource } from "@/lib/categories";
import { SummarizePanel } from "./SummarizePanel";
import { CategoryExplorer } from "../explore/CategoryExplorer";

/** Per-tab AI bar: "Summarize this tab" + a collapsible connection builder. */
export function TabAI({
  category, entities, schema, parsed, stats, siblings,
}: {
  category: Category;
  entities?: EntitySet;
  schema: SchemaProfile;
  parsed: ParsedFile;
  stats: string[];
  siblings?: string[];
}) {
  const [open, setOpen] = useState(false);
  const src = useMemo(
    () => resolveCategorySource(category, entities, schema, parsed),
    [category, entities, schema, parsed]
  );
  return (
    <section className="card border-brand/30 bg-brand/5 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow text-brand">Ask AI · {category.label}</p>
        {src.rows.length > 0 && (
          <button onClick={() => setOpen((o) => !o)}
            className="text-[11px] uppercase tracking-wider text-ink-dim hover:text-brand">
            {open ? "Hide connections" : "Find connections ↗"}
          </button>
        )}
      </div>
      <div className="mt-3"><SummarizePanel category={category.label} stats={stats} siblings={siblings} /></div>
      {open && src.rows.length > 0 && (
        <div className="mt-4 border-t border-line/50 pt-4">
          <CategoryExplorer
            label={category.label}
            sourceKey={src.sourceKey}
            rows={src.rows}
            columns={src.columns}
            defaultDimension={src.defaultDimension}
          />
        </div>
      )}
    </section>
  );
}
