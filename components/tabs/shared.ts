import type { UnitRecord, Row, SchemaProfile } from "@/lib/types";
import { toNumber, type PivotResult } from "@/lib/pivot";
import type { BarsDatum } from "../viz/CategoryBars";

/** Lead with the unit's given forklift name (e.g. "Bella") when present. */
export function unitTitle(u: UnitRecord): string {
  const desc = [u.make, u.model, u.type].filter(Boolean).join(" · ");
  return u.name ? (desc ? `${u.name} · ${desc}` : u.name) : desc || u.serial || "Unit";
}

/** PivotResult → { data, series } ready for <CategoryBars>. */
export function toBars(res: PivotResult): { data: BarsDatum[]; series: string[] } {
  return { data: res.rows.map((r) => ({ name: r.key, ...r.values })), series: res.series };
}

/** Resolve a real column name by trying regexes in order (hand-tuned, but tolerant). */
export function colName(schema: SchemaProfile, ...res: RegExp[]): string | undefined {
  for (const re of res) {
    const hit = schema.columns.find((c) => re.test(c.name));
    if (hit) return hit.name;
  }
  return undefined;
}

/** How many rows have a usable numeric value in `col` (for gating sparse charts). */
export function numericCount(rows: Row[], col?: string): number {
  if (!col) return 0;
  let n = 0;
  for (const r of rows) if (!Number.isNaN(toNumber(r[col]))) n++;
  return n;
}

/** How many rows have a non-empty value in `col`. */
export function populated(rows: Row[], col?: string): number {
  if (!col) return 0;
  let n = 0;
  for (const r of rows) if (r[col] != null && r[col] !== "") n++;
  return n;
}
