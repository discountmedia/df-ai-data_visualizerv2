import type { UnitRecord, Row, SchemaProfile } from "@/lib/types";
import { toNumber, type PivotResult } from "@/lib/pivot";
import type { BarsDatum } from "../viz/CategoryBars";

/** Lead with the forklift's given name, then year/make/type, fuel, and last-4 serial. */
export function unitTitle(u: UnitRecord): string {
  const name = u.forkliftName ?? u.name;
  const spec = [u.year, u.make, u.type].filter(Boolean).join(" ");
  const tail = [u.fuel, u.serial4 ? `#${u.serial4}` : null].filter(Boolean).join(" · ");
  const head = name ? (spec ? `${name} · ${spec}` : name) : spec || u.serial4 || u.serial || "Unit";
  return tail ? `${head} · ${tail}` : head;
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
