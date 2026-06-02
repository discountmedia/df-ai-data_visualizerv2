import type { ColumnProfile, SchemaProfile, EntitySet, ParsedFile, Row } from "./types";

/**
 * Single source of truth for how columns group into categories. Extracted from
 * SchemaReview so the setup page and the dashboard tabs can never diverge.
 *
 * A category is either a base ROLE group (its `id` is the role, e.g. "work_stage",
 * rows come from the inventory "base" entity) or a stacked-table ENTITY group
 * (its `id` is the entity key, e.g. "email", rows come from that entity).
 */

export const ROLE_LABEL: Record<string, string> = {
  identifier: "ID", location: "Location", work_stage: "Work Stage", sale_type: "Sale Type",
  payment_status: "Payment", flag: "Flag", metric: "Metric", date: "Date", other: "Other",
};
// Base (un-prefixed) role categories appear in this order; entities follow.
export const ROLE_ORDER = [
  "identifier", "location", "work_stage", "sale_type",
  "payment_status", "metric", "flag", "date", "other",
];

const LABEL_TO_ROLE: Record<string, string> =
  Object.fromEntries(Object.entries(ROLE_LABEL).map(([role, label]) => [label, role]));

export interface Category {
  /** Role id ("work_stage") for base groups, entity key ("email") for entities. */
  id: string;
  label: string;
  kind: "role" | "entity";
  /** "base" for role groups, the entity key for entities. */
  sourceKey: string;
  columns: ColumnProfile[];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

/** The category LABEL a single column belongs to (entity prefix, else role). */
export function columnCategoryLabel(
  col: ColumnProfile,
  entities: EntitySet | undefined
): string {
  const ent = entities?.related.find((e) => e.columns.includes(col.name));
  return ent?.label ?? ROLE_LABEL[col.role] ?? col.role;
}

export function buildCategories(
  schema: SchemaProfile | undefined,
  entities: EntitySet | undefined
): Category[] {
  const cols = schema?.columns ?? [];
  const colEntity = new Map<string, { label: string; key: string }>();
  entities?.related.forEach((e) => e.columns.forEach((c) => colEntity.set(c, { label: e.label, key: e.key })));

  const groups = new Map<string, ColumnProfile[]>();
  for (const c of cols) {
    const cat = colEntity.get(c.name)?.label ?? ROLE_LABEL[c.role] ?? c.role;
    (groups.get(cat) ?? groups.set(cat, []).get(cat)!).push(c);
  }

  const ordered: Category[] = [];
  for (const role of ROLE_ORDER) {
    const label = ROLE_LABEL[role];
    if (groups.has(label)) {
      ordered.push({ id: role, label, kind: "role", sourceKey: "base", columns: groups.get(label)! });
      groups.delete(label);
    }
  }
  entities?.related.forEach((e) => {
    if (groups.has(e.label)) {
      ordered.push({ id: e.key, label: e.label, kind: "entity", sourceKey: e.key, columns: groups.get(e.label)! });
      groups.delete(e.label);
    }
  });
  for (const [label, columns] of groups) {
    ordered.push({ id: LABEL_TO_ROLE[label] ?? slug(label), label, kind: "role", sourceKey: "base", columns });
  }
  return ordered;
}

export interface CategorySource {
  sourceKey: string;
  rows: Row[];
  /** Selectable columns: ALL base columns for role groups (so connections can
   *  cross fields), the entity's own columns for entities. */
  columns: ColumnProfile[];
  defaultDimension?: string;
}

export function resolveCategorySource(
  cat: Category,
  entities: EntitySet | undefined,
  schema: SchemaProfile | undefined,
  parsed: ParsedFile | undefined
): CategorySource {
  if (cat.kind === "entity") {
    return {
      sourceKey: cat.sourceKey,
      rows: entities?.rowsByEntity[cat.sourceKey] ?? [],
      columns: cat.columns,
      defaultDimension: cat.columns[0]?.name,
    };
  }
  const baseCols = new Set(entities?.base.columns ?? parsed?.columns ?? []);
  return {
    sourceKey: "base",
    rows: entities?.rowsByEntity["base"] ?? parsed?.rows ?? [],
    columns: (schema?.columns ?? []).filter((c) => baseCols.has(c.name)),
    defaultDimension: cat.columns[0]?.name,
  };
}
