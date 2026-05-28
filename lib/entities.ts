import type { ParsedFile, Row, EntitySet, EntityTable } from "./types";

/**
 * Many real exports are several tables stacked in one sheet (FileMaker-style
 * "portal" dumps), where related rows use a `prefix::field` naming convention
 * and the parent rows leave those columns blank. We partition the sheet into
 * entities STRUCTURALLY — by the `::` prefix, never by hardcoded names — so the
 * unit views read base rows and the sales views can read the email /
 * round-robin / staff slices.
 */

const PREFIX_RE = /^(.+?)::/;

function prettyLabel(key: string): string {
  if (key === "base") return "Inventory";
  return key
    .replace(/[_:]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function detectEntities(parsed: ParsedFile): EntitySet {
  const groups = new Map<string, string[]>();
  const baseCols: string[] = [];

  for (const col of parsed.columns) {
    const m = col.match(PREFIX_RE);
    if (m) {
      const p = m[1].trim();
      if (!groups.has(p)) groups.set(p, []);
      groups.get(p)!.push(col);
    } else {
      baseCols.push(col);
    }
  }

  const rowsByEntity: Record<string, Row[]> = {};
  const belongs = (r: Row, cols: string[]) =>
    cols.some((c) => r[c] != null && r[c] !== ""); // != null covers undefined too

  rowsByEntity["base"] = parsed.rows.filter((r) => belongs(r, baseCols));
  const base: EntityTable = {
    key: "base",
    label: prettyLabel("base"),
    columns: baseCols,
    rowCount: rowsByEntity["base"].length,
  };

  const related: EntityTable[] = [];
  for (const [key, cols] of groups) {
    const rows = parsed.rows.filter((r) => belongs(r, cols));
    rowsByEntity[key] = rows;
    related.push({ key, label: prettyLabel(key), columns: cols, rowCount: rows.length });
  }
  related.sort((a, b) => b.rowCount - a.rowCount);

  return { base, related, rowsByEntity };
}

/** Find a column within an entity whose name matches any of the given patterns. */
export function findColumn(
  columns: string[],
  patterns: RegExp[]
): string | undefined {
  for (const re of patterns) {
    const hit = columns.find((c) => re.test(c));
    if (hit) return hit;
  }
  return undefined;
}
