import type { Row, CellValue } from "./types";

/**
 * Deterministic cross-tab / pivot engine. Given a set of rows and a spec
 * (dimension × optional breakdown × measure), it groups and aggregates without
 * any AI — the AI layer only *chooses* a spec; the math lives here so it's
 * auditable and works offline. Powers the category "Explore / connect" panel.
 */

export type MeasureKind = "count" | "sum" | "avg";

export interface Measure {
  kind: MeasureKind;
  /** Required for sum/avg; ignored for count. */
  column?: string | null;
}

export interface PivotSpec {
  /** Entity key the rows came from (informational, e.g. "base", "email"). */
  source?: string;
  /** Column whose values become the rows of the cross-tab. */
  dimension: string;
  /** Optional second column whose values become the series (grouped bars). */
  breakdown?: string | null;
  measure: Measure;
  /** Keep only the top-N dimension values by total (default 12). */
  topN?: number;
  title?: string;
}

export interface PivotRow {
  key: string;
  total: number;
  values: Record<string, number>;
}

export interface PivotResult {
  spec: PivotSpec;
  /** Series labels (breakdown values); ["value"] when there's no breakdown. */
  series: string[];
  rows: PivotRow[];
  measureLabel: string;
  grandTotal: number;
  /** Rows that had a usable dimension value. */
  consideredRows: number;
  note?: string;
}

const NO_BREAKDOWN = "value";
const MAX_SERIES = 6;

/** Coerce messy cell values ("$1,234", "12.5", 7) to a number, else NaN. */
export function toNumber(v: CellValue): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return NaN;
  if (v == null) return NaN;
  const cleaned = String(v).replace(/[^0-9.\-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return NaN;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

/** A display label for a categorical cell, or null when it's empty. */
function label(v: CellValue): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function measureLabel(m: Measure): string {
  if (m.kind === "count") return "Count";
  const col = m.column ?? "value";
  return m.kind === "sum" ? `Σ ${col}` : `Avg ${col}`;
}

interface Cell {
  n: number;        // rows in this cell (for count)
  sum: number;      // Σ numeric measure
  numN: number;     // rows with a usable numeric measure (for avg)
}

export function computePivot(rows: Row[], spec: PivotSpec): PivotResult {
  const { dimension, breakdown, measure } = spec;
  const topN = spec.topN ?? 12;
  const wantsNumber = measure.kind !== "count";
  const measureCol = measure.column ?? null;

  // dimKey -> seriesKey -> Cell
  const acc = new Map<string, Map<string, Cell>>();
  const seriesTotals = new Map<string, number>();
  let consideredRows = 0;

  const finalCell = (c: Cell): number =>
    measure.kind === "count" ? c.n : measure.kind === "sum" ? c.sum : c.numN > 0 ? c.sum / c.numN : 0;

  for (const r of rows) {
    const dim = label(r[dimension]);
    if (dim == null) continue;
    const ser = breakdown ? label(r[breakdown]) ?? "—" : NO_BREAKDOWN;
    consideredRows++;

    let bySeries = acc.get(dim);
    if (!bySeries) acc.set(dim, (bySeries = new Map()));
    let cell = bySeries.get(ser);
    if (!cell) bySeries.set(ser, (cell = { n: 0, sum: 0, numN: 0 }));

    cell.n += 1;
    if (wantsNumber && measureCol) {
      const num = toNumber(r[measureCol]);
      if (!Number.isNaN(num)) { cell.sum += num; cell.numN += 1; }
    }
  }

  // Rank dimension rows by their aggregated total.
  const dimRows: PivotRow[] = [];
  for (const [dim, bySeries] of acc) {
    const values: Record<string, number> = {};
    let total = 0, totalSum = 0, totalNumN = 0, totalN = 0;
    for (const [ser, cell] of bySeries) {
      values[ser] = finalCell(cell);
      totalSum += cell.sum; totalNumN += cell.numN; totalN += cell.n;
      seriesTotals.set(ser, (seriesTotals.get(ser) ?? 0) + finalCell(cell));
    }
    total = measure.kind === "count" ? totalN : measure.kind === "sum" ? totalSum : totalNumN > 0 ? totalSum / totalNumN : 0;
    dimRows.push({ key: dim, total, values });
  }
  dimRows.sort((a, b) => b.total - a.total);
  const kept = dimRows.slice(0, topN);

  // Pick the most significant series, fold the rest into "Other".
  let series: string[];
  if (!breakdown) {
    series = [NO_BREAKDOWN];
  } else {
    const ranked = [...seriesTotals.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    if (ranked.length > MAX_SERIES) {
      const top = ranked.slice(0, MAX_SERIES);
      const topSet = new Set(top);
      for (const row of kept) {
        let other = 0;
        for (const [s, v] of Object.entries(row.values)) if (!topSet.has(s)) { other += v; delete row.values[s]; }
        if (other > 0) row.values["Other"] = (row.values["Other"] ?? 0) + other;
      }
      series = [...top, "Other"];
    } else {
      series = ranked;
    }
  }

  const grandTotal = kept.reduce((s, r) => s + r.total, 0);
  return {
    spec,
    series,
    rows: kept,
    measureLabel: measureLabel(measure),
    grandTotal,
    consideredRows,
    note: dimRows.length > kept.length ? `Showing top ${kept.length} of ${dimRows.length} ${dimension} values.` : undefined,
  };
}
