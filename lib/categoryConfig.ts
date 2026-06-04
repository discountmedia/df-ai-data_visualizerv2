import type { Category } from "./categories";

/**
 * Forklift-specific tuning registry. Maps a category (by role id / entity key)
 * to the hand-tuned tab layout it should render and where it sits in the tab bar.
 * Anything unmapped falls back to the generic "explore" layout, so the dashboard
 * never breaks on an unexpected sheet.
 */

export type CategoryLayout =
  | "workStage" | "saleType" | "location" | "metric" | "staff" | "other" | "explore";

export interface CategoryView {
  layout: CategoryLayout;
  blurb: string;
  /** Lower = earlier in the tab bar (Overview is pinned first, separately). */
  order: number;
}

const VIEWS: Record<string, CategoryView> = {
  work_stage: { layout: "workStage", blurb: "Where every unit sits in the service pipeline.", order: 1 },
  sale_type:  { layout: "saleType",  blurb: "Committed deals, the signature chase list, and rep revenue.", order: 2 },
  location:   { layout: "location",  blurb: "Fleet split and readiness by yard (FOB State).", order: 3 },
  metric:     { layout: "metric",    blurb: "Pricing realism and fleet-value health.", order: 4 },
  staff:      { layout: "staff",     blurb: "Rep leaderboard, email activity, and lead routing.", order: 5 },
  other:      { layout: "other",     blurb: "Fleet composition — make, type, and merchandising.", order: 6 },
  // Thin base roles get the explorer, parked after the rich tabs + entities.
  identifier: { layout: "explore", blurb: "Unit IDs and given forklift names.", order: 80 },
  flag:       { layout: "explore", blurb: "Signature & completion flags.", order: 81 },
  date:       { layout: "explore", blurb: "Date columns — explore over time.", order: 82 },
};

const ENTITY_ORDER = 50; // stacked-table entities (Email, Round Robin, …) after rich tabs
const DEFAULT_ORDER = 90;

export function resolveView(cat: Category): CategoryView {
  const v = VIEWS[cat.id];
  if (v) return v;
  if (cat.kind === "entity") return { layout: "explore", blurb: `Explore the ${cat.label} table.`, order: ENTITY_ORDER };
  return { layout: "explore", blurb: `Explore ${cat.label}.`, order: DEFAULT_ORDER };
}

/** Categories sorted into the workflow-priority tab order. */
export function orderCategories(cats: Category[]): Category[] {
  return [...cats].sort((a, b) => {
    const d = resolveView(a).order - resolveView(b).order;
    return d !== 0 ? d : a.label.localeCompare(b.label);
  });
}
