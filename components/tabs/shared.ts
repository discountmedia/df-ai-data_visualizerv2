import type { UnitRecord, Row, SchemaProfile } from "@/lib/types";
import { toNumber, type PivotResult } from "@/lib/pivot";
import type { BarsDatum } from "../viz/CategoryBars";

/** Lead with the last-4 serial then the forklift name, e.g. "#030H Sofia · 2026 Yale Pneumatic". */
export function unitTitle(u: UnitRecord): string {
  const lead = [u.serial4 ? `#${u.serial4}` : null, u.forkliftName ?? u.name].filter(Boolean).join(" ");
  const spec = [u.year, u.make, u.type].filter(Boolean).join(" ");
  const head = lead ? (spec ? `${lead} · ${spec}` : lead) : spec || u.serial || "Unit";
  return u.fuel ? `${head} · ${u.fuel}` : head;
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
