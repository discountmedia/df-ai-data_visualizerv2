import type { Row, CellValue } from "./types";

/**
 * A deliberately MESSY, MULTI-TABLE sample mirroring the real export: inventory
 * unit rows + a Staff:: roster + email:: rows (different grains, stacked). Lets
 * you exercise schema inference, the veto flow, the grain-aware overview, and
 * the Sales Team tab without the real file or an API key.
 */

const LOCATIONS = ["DFW", "Denver", "Phoenix", "Las Vegas", "dfw ", "PHX"];
const NAMES = ["Ruth", "Tillie", "Madelynn", "Melanie", "Hayley", "Lilah", "Judy", "Sheree", "Jaelyn", "Kaia"];
const MAKES = ["Yale", "Hyster", "Toyota", "Crown", "Clark"];
const TYPES = ["Pneumatic - Sit Down", "Electric - Stand-up Reach Narrow Aisle", "Cushion - Sit Down", "Electric - Pallet Jack"];
const WORK = ["Ready", "ready", "Being Worked On", "needs diagnosis", "Needs Diag", "On Rent", "Sold", "in service", null, "recon"];
const SALE = ["Paid in Full", "PIF", "Down Payment", "down pmt", "Govt PO", "Rental", null, "paid", "Removed from Inventory"];

// Sales reps (name + trailing employee id, like the real "Sales Names Sold by").
const REPS = [
  { padded: "Ross Kohlmeier           1108", user: "rossk", dept: "DENVER SALES", title: "Equipment Matchmaker" },
  { padded: "Conner Coleman        1312", user: "connerc", dept: "DFW", title: "Sales" },
  { padded: "Keith Batchelor           1414", user: "keithb", dept: "DFW", title: "Sales Manager" },
  { padded: "Michael Zellner           1211", user: "michaelz", dept: "VEGAS", title: "Sales" },
  { padded: "Dan Levine                  1127", user: "dan", dept: "DENVER SALES", title: "Procurement Coordinator" },
  { padded: "Jackie Muse                  1124", user: "jackie", dept: "PHOENIX", title: "Sales" },
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

export function makeSampleData(nUnits = 175, nEmails = 400): { rows: Row[]; columns: string[] } {
  const rows: Row[] = [];

  // --- Inventory (unit grain) ---
  for (let i = 0; i < nUnits; i++) {
    const sale = pick(SALE, i);
    const isSold = sale != null && sale !== "Rental";
    const rep = REPS[i % REPS.length];
    rows.push({
      Name: pick(NAMES, i) + (i >= NAMES.length ? ` ${i}` : ""),
      "Serial #": (1000 + i * 7).toString(36).toUpperCase().slice(-4),
      Make: pick(MAKES, i),
      Type: pick(TYPES, i),
      "Cap (lbs)": pick([3000, 4000, 5000, 6000, 10000, 12000], i),
      Location: pick(LOCATIONS, i),
      "Sale Type": sale,
      "Work Status": pick(WORK, i),
      Invoiced: i % 4 === 0 ? "Pending" : "Yes",
      // sales-relevant fields:
      "Sold By": isSold ? rep.padded : null,
      "Final Sale Price": isSold ? 8000 + (i % 12) * 2500 : null,
      "PandaDoc Signed": isSold && i % 7 !== 0 ? "PandaDoc Signed" : null,
      "Sold To": isSold ? `Customer ${i}` : null,
      "first leads": pick(["DiscountForkliftQuote", "123Forklift - 3rd Party Lead", "Call-In", "Repeat Customer", null], i),
      "Old Tag ID": i % 23 === 0 ? `T-${i}` : null, // deprecated
      Branch: pick(LOCATIONS, i), // duplicate of Location
    });
  }

  // --- Staff:: roster (dimension) ---
  for (const r of REPS) {
    rows.push({
      "Staff::NAME": r.padded,
      "Staff::USERNAME": r.user,
      "Staff::DEPARTMENT": r.dept,
      "Staff::TITLE": r.title,
    });
  }

  // --- email:: rows (activity proxy) ---
  for (let i = 0; i < nEmails; i++) {
    // weight emails unevenly across reps
    const idx = i % 9 < 4 ? 0 : i % 9 < 6 ? 1 : i % 9 < 7 ? 4 : (i % REPS.length);
    rows.push({
      "email::email_id": 100000 + i,
      "email::staff_user": REPS[idx].user,
    });
  }

  // --- round_robin:: snapshot (single live record) ---
  rows.push({
    "round_robin::round_robin_walk_in_denver": "Jackie Muse                  1124",
    "round_robin::round_robin_walk_in_dfw": "Keith Batchelor           1414",
    "round_robin::round_robin_walk_in_phoenix": "Joel Goodell                1322",
    "round_robin::round_robin_walk_in_vegas": "Michael Zellner           1211",
    "round_robin::round_robin_call_in": "Dan Levine                  1127",
    "round_robin::round_robin_date": "2026-05-28 15:43:57",
  });

  // Normalize to a union schema with null fill (mirrors parseFile output).
  const columns: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) if (!seen.has(k)) { seen.add(k); columns.push(k); }
  const normalized: Row[] = rows.map((r) => {
    const out: Row = {};
    for (const c of columns) out[c] = (r[c] ?? null) as CellValue;
    return out;
  });

  return { rows: normalized, columns };
}
