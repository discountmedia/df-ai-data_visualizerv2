import type { CellValue, SchemaProfile, WorkBucket, SaleBucket } from "./types";

/**
 * Shared derivation primitives. Bucketing and numeric/boolean coercion live
 * HERE and nowhere else, so every view (Overview metrics, charts, All-Units,
 * Priority, Sales) classifies the same raw value identically. Previously these
 * were copy-pasted across deriveUnits / deriveMetrics / deriveSales / profile
 * with subtle drift, which let the Overview counts contradict the other tabs.
 *
 * Resolution order is always: the inferred value-map first (Claude/heuristic),
 * then a regex fallback for raw values the map never covered (the value-maps
 * only carry ~8 sampled values per column, so real exports always have a tail).
 */

export function bucketWorkByPattern(raw: string): WorkBucket {
  const s = raw.toLowerCase();
  if (/ready|complete|done|prepped|diagnosed|serviced/.test(s)) return "ready";
  if (/diag.*need|need.*diag|broken|inop/.test(s)) return "needs_diagnosis";
  if (/rent/.test(s)) return "on_rent";
  if (/sold/.test(s)) return "sold";
  if (/work|recon|prep|repair|service|body|progress/.test(s)) return "working";
  return "unknown";
}

export function bucketSaleByPattern(raw: string): SaleBucket {
  const s = raw.toLowerCase();
  if (/paid in full|^pif|paid/.test(s)) return "paid_in_full";
  if (/down|deposit|dp\b/.test(s)) return "down_payment";
  if (/govt|government|\bpo\b|purchase order/.test(s)) return "govt_po";
  if (/rent/.test(s)) return "rental";
  return "other";
}

export function resolveWork(raw: string, schema: SchemaProfile): WorkBucket {
  return schema.workStageValueMap[raw.toLowerCase()] ?? bucketWorkByPattern(raw);
}

export function resolveSale(raw: string, schema: SchemaProfile): SaleBucket {
  return schema.saleTypeValueMap[raw.toLowerCase()] ?? bucketSaleByPattern(raw);
}

export const COMMITTED_SALES: ReadonlySet<SaleBucket> = new Set<SaleBucket>([
  "paid_in_full",
  "down_payment",
  "govt_po",
]);

export function isCommittedSale(sale: SaleBucket): boolean {
  return COMMITTED_SALES.has(sale);
}

/** "Has a real value" — null AND empty-string both count as not-signed/absent. */
export function isSigned(cell: CellValue): boolean {
  return cell != null && cell !== "";
}

/** Parse a numeric cell. Returns null (not 0) for non-numeric text like "N/A". */
export function toNum(v: CellValue): number | null {
  if (v === null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
