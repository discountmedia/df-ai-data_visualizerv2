import type { ReactNode } from "react";
import type { Category } from "@/lib/categories";
import { resolveView } from "@/lib/categoryConfig";

/** Title + blurb row at the top of every category tab. */
export function TabHeader({ category, right }: { category: Category; right?: ReactNode }) {
  const { blurb } = resolveView(category);
  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <p className="eyebrow text-brand">{category.label}</p>
        <h1 className="mt-0.5 text-lg font-bold text-ink">{blurb}</h1>
      </div>
      {right}
    </div>
  );
}
