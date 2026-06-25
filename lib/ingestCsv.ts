import { createHash } from "node:crypto";
import * as XLSX from "xlsx";

/**
 * Pure, deterministic ingest of the admin's daily report (CSV or xlsx) into
 * normalized rows ready for upsert. Same file in -> same rows out, every time.
 *
 * The unique key is the inventory id parsed from the `Product Server URL`
 * column (e.g. https://.../inventory/8265 -> "8265"). Rows without a usable
 * URL/id can't be keyed, so they're skipped and reported in `skippedNoId`.
 */

export interface IngestedRow {
  inventory_id: string;
  data: Record<string, unknown>;
  content_hash: string;
}

export interface IngestResult {
  rows: IngestedRow[];
  /** Rows dropped because they had no inventory-URL id. */
  skippedNoId: number;
  /** Duplicate inventory_ids collapsed within this single file (last wins). */
  collapsedDupes: number;
  columns: string[];
}

const URL_COLUMN_CANDIDATES = [
  "Product Server URL",
  "product server url",
  "Product server URL",
];

function findUrlColumn(columns: string[]): string | null {
  for (const cand of URL_COLUMN_CANDIDATES) {
    const hit = columns.find((c) => c.trim().toLowerCase() === cand.toLowerCase());
    if (hit) return hit;
  }
  // Fall back to any column whose values look like the inventory URL.
  return columns.find((c) => /url/i.test(c)) ?? null;
}

function extractInventoryId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const m = value.match(/\/inventory\/(\d+)/i);
  return m ? m[1] : null;
}

/** Stable JSON (sorted keys) so the hash is order-independent. */
function stableStringify(obj: Record<string, unknown>): string {
  const keys = Object.keys(obj).sort();
  return JSON.stringify(obj, keys);
}

function hashRow(data: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(data)).digest("hex");
}

export function ingestReport(buffer: ArrayBuffer | Buffer): IngestResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  } catch {
    throw new Error("Could not parse the file. Supported formats: .csv, .xlsx, .xls.");
  }

  const sheetNames = wb.SheetNames ?? [];
  let raw: Record<string, unknown>[] = [];
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: null,
      raw: false, // keep everything as strings — avoids Excel's number coercion
    });
    if (data.length > 0) {
      raw = data;
      break;
    }
  }
  if (raw.length === 0) throw new Error("No data rows were found in the file.");

  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of raw)
    for (const k of Object.keys(r))
      if (!seen.has(k)) {
        seen.add(k);
        columns.push(k);
      }

  const urlCol = findUrlColumn(columns);
  if (!urlCol) {
    throw new Error(
      "Could not find a 'Product Server URL' column to derive the inventory id from."
    );
  }

  // Last occurrence of an inventory_id wins (and a single ON CONFLICT batch
  // can't touch the same key twice, so collapsing here is also required).
  const byId = new Map<string, Record<string, unknown>>();
  let skippedNoId = 0;
  let collapsedDupes = 0;

  for (const r of raw) {
    const id = extractInventoryId(r[urlCol]);
    if (!id) {
      skippedNoId++;
      continue;
    }
    if (byId.has(id)) collapsedDupes++;
    const clean: Record<string, unknown> = {};
    for (const col of columns) {
      const v = r[col];
      clean[col] = v === "" ? null : v;
    }
    byId.set(id, clean);
  }

  const rows: IngestedRow[] = [];
  for (const [inventory_id, data] of byId) {
    rows.push({ inventory_id, data, content_hash: hashRow(data) });
  }

  return { rows, skippedNoId, collapsedDupes, columns };
}
