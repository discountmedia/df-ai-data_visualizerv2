import Papa from "papaparse";
import type { ParsedFile, Row, CellValue, EntitySet } from "./types";

/**
 * Adapter for the PRO (FileMaker Pro Web Viewer) data contract.
 *
 * PRO pushes two HEADERLESS CSV strings — inventory and staff — where columns
 * are POSITIONAL and fixed (part of the contract; see the lead dev's
 * "Inventory Analysis: JavaScript for the FileMaker Web Viewer" guide). We map
 * each column by its index to the canonical name below, then build the same
 * `ParsedFile` shape the rest of the app already consumes, so every downstream
 * derive/score function keeps working unchanged.
 *
 * The staff table arrives as a flat 5-field table. We re-emit it under the
 * `Staff::` prefix so `detectEntities` splits it into a related entity (exactly
 * like the old stacked-table export did) and `deriveSales` finds the roster.
 *
 * All values are treated as strings per the contract; empty fields become null.
 * If FileMaker's export order ever changes, update these arrays to match — the
 * order is the only thing binding a column to its meaning.
 */

// Inventory columns, index [0]..[35], in FileMaker's fixed export order.
export const PRO_INVENTORY_COLUMNS = [
  "Record UUID",
  "Forklift Name",
  "Serial Number",
  "Year",
  "Make",
  "Type",
  "Check in model",
  "Capacity",
  "Fuel type",
  "Invoice Fuel",
  "FOB State",
  "Lift Location",
  "Checked In",
  "Diagnosed",
  "Serviced",
  "Auto body done",
  "final sign off acceptable",
  "final sign off video upload",
  "Pre Inspection DONE",
  "Freight status out",
  "Equipment on rent",
  "SOLD!",
  "Final sale price",
  "Sold To",
  "PandaDoc Signed",
  "Sales Names Sold by",
  "Mast",
  "Fork Length",
  "Lowered Height",
  "Raised Height",
  "Tires",
  "Hours",
  "INVOICE Attachments",
  "Product Server URL",
  "youtubeurl",
  "Photos Resized",
] as const;

// Staff columns, index [0]..[4], in FileMaker's fixed export order.
export const PRO_STAFF_FIELDS = ["NAME", "DEPARTMENT", "TITLE", "EMAIL", "DIRECT"] as const;
const STAFF_PREFIX = "Staff::";
export const PRO_STAFF_COLUMNS = PRO_STAFF_FIELDS.map((f) => `${STAFF_PREFIX}${f}`);

/** All-strings contract: trim, and treat an empty string as absent (null). */
function norm(v: unknown): CellValue {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Parse a headerless CSV string into a matrix of raw string cells. */
function parseHeaderless(csv: string): string[][] {
  const res = Papa.parse<string[]>(csv ?? "", {
    header: false,
    skipEmptyLines: "greedy",
  });
  return (res.data ?? []).filter((r) => Array.isArray(r));
}

/** Map a matrix onto a fixed positional column list, dropping all-empty rows. */
function toRows(matrix: string[][], columns: readonly string[]): Row[] {
  return matrix
    .map((cells) => {
      const row: Row = {};
      columns.forEach((col, i) => {
        row[col] = norm(cells[i]);
      });
      return row;
    })
    .filter((row) => columns.some((c) => row[c] != null));
}

/**
 * Turn the two PRO CSV blocks into a single ParsedFile: inventory rows keyed by
 * the canonical inventory columns, plus staff rows keyed under the `Staff::`
 * prefix so entity detection treats them as the roster (and never as inventory).
 */
export function parseProPayload(inventoryCsv: string, staffCsv: string): ParsedFile {
  const invRows = toRows(parseHeaderless(inventoryCsv), PRO_INVENTORY_COLUMNS);
  const staffRows = toRows(parseHeaderless(staffCsv), PRO_STAFF_COLUMNS);

  return {
    fileName: "PRO payload",
    sheetName: "PRO",
    sheetNames: ["PRO"],
    columns: [...PRO_INVENTORY_COLUMNS, ...PRO_STAFF_COLUMNS],
    rows: [...invRows, ...staffRows],
  };
}

/* ---------------------------------------------------------------------------
 * Dev-only: project the bundled test export back into the PRO CSV contract so
 * the real ingest path (bridge → parseProPayload → derive) can be exercised in
 * the browser without FileMaker. NOT used in production.
 * ------------------------------------------------------------------------- */

// The bundled test export names a few columns differently than the PRO contract;
// alias them so a simulated push still populates those fields. Everything else
// matches by its own contract name.
const SIMULATE_INV_ALIASES: Record<string, string[]> = {
  "Serial Number": ["Serial Number", "Serial 4", "Serial"],
};

function pickInv(row: Row, contractCol: string): string {
  const names = SIMULATE_INV_ALIASES[contractCol] ?? [contractCol];
  for (const n of names) {
    const v = row[n];
    if (v != null && v !== "") return String(v);
  }
  return "";
}

/** Build headerless CSV blocks from the merged bundled data (dev simulate only). */
export function toProPayloadCsv(
  parsed: ParsedFile,
  entities: EntitySet
): { inventoryCsvData: string; staffCsvData: string } {
  const baseRows = entities.rowsByEntity["base"] ?? [];
  const invMatrix = baseRows.map((r) => PRO_INVENTORY_COLUMNS.map((c) => pickInv(r, c)));

  const staffEntity = entities.related.find((e) => /staff/i.test(e.key));
  const staffRows = staffEntity ? entities.rowsByEntity[staffEntity.key] ?? [] : [];
  const findCol = (re: RegExp) => staffEntity?.columns.find((c) => re.test(c));
  const staffColMap: Record<(typeof PRO_STAFF_FIELDS)[number], string | undefined> = {
    NAME: findCol(/name/i),
    DEPARTMENT: findCol(/department|dept/i),
    TITLE: findCol(/title/i),
    EMAIL: findCol(/email/i),
    DIRECT: findCol(/direct|phone/i),
  };
  const staffMatrix = staffRows.map((r) =>
    PRO_STAFF_FIELDS.map((f) => {
      const c = staffColMap[f];
      return c && r[c] != null ? String(r[c]) : "";
    })
  );

  return {
    inventoryCsvData: Papa.unparse(invMatrix, { header: false }),
    staffCsvData: Papa.unparse(staffMatrix, { header: false }),
  };
}
