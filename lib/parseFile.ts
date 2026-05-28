import * as XLSX from "xlsx";
import type { ParsedFile, Row, CellValue } from "./types";

export async function parseSpreadsheet(file: File): Promise<ParsedFile> {
  if (!file) throw new Error("No file provided.");
  const buf = await file.arrayBuffer().catch(() => {
    throw new Error("Could not read the file. It may be corrupt or empty.");
  });
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "array", cellDates: true });
  } catch {
    throw new Error("Could not parse this file. Supported formats: .xlsx, .xls, .csv.");
  }
  const sheetNames = wb.SheetNames ?? [];
  if (sheetNames.length === 0) throw new Error("The workbook has no sheets.");
  let sheetName = sheetNames[0];
  let rawRows: Record<string, unknown>[] = [];
  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null, raw: true });
    if (data.length > 0) { sheetName = name; rawRows = data; break; }
  }
  if (rawRows.length === 0) throw new Error("No data rows were found in the file.");
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of rawRows) for (const k of Object.keys(r)) {
    if (!seen.has(k)) { seen.add(k); columns.push(k); }
  }
  const rows: Row[] = rawRows.map((r) => {
    const out: Row = {};
    for (const col of columns) out[col] = normalizeCell(r[col]);
    return out;
  });
  return { fileName: file.name, sheetName, sheetNames, rows, columns };
}

function normalizeCell(v: unknown): CellValue {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") { const t = v.trim(); return t === "" ? null : t; }
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean") return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
