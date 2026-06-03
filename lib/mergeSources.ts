import type { ParsedFile, Row } from "./types";

const KEY = "Record UUID";

/**
 * Merge two exports into one dataset so the operator never has to combine them
 * by hand. `primary` is the rich per-unit inventory (CURATEDV2 — Forklift Name,
 * Serial 4, Mast, heights, media URLs, broker calcs…); `secondary` is the big
 * export that also carries the email / staff / round-robin entity rows
 * (CuratedFields-TEST) plus a few unit fields it uniquely has (Fuel type, Sales
 * Names Sold by, Notes…).
 *
 * Inventory rows join on `Record UUID`: primary wins on shared columns, secondary
 * fills any field it uniquely provides. The secondary's entity rows (no Record
 * UUID) pass through unchanged so the Sales views still get email/roster data.
 */
export function mergeSources(primary: ParsedFile, secondary: ParsedFile): ParsedFile {
  const secInvByKey = new Map<string, Row>();
  const secEntityRows: Row[] = [];
  for (const r of secondary.rows) {
    const k = r[KEY];
    if (k != null && k !== "") secInvByKey.set(String(k), r);
    else secEntityRows.push(r);
  }
  const secOnlyCols = secondary.columns.filter((c) => !primary.columns.includes(c));

  const mergedInv = primary.rows.map((r) => {
    const k = r[KEY];
    const sec = k != null ? secInvByKey.get(String(k)) : undefined;
    if (!sec) return r;
    const out: Row = { ...r };
    for (const c of secOnlyCols) if (out[c] == null && sec[c] != null) out[c] = sec[c];
    return out;
  });

  const columns = [...primary.columns];
  for (const c of secondary.columns) if (!columns.includes(c)) columns.push(c);

  return {
    fileName: `${primary.fileName} + ${secondary.fileName}`,
    sheetName: primary.sheetName,
    sheetNames: primary.sheetNames,
    rows: [...mergedInv, ...secEntityRows],
    columns,
  };
}
