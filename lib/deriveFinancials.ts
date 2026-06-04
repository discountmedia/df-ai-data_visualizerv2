import type { ParsedFile, Row, CellValue, FinancialUnit, FinancialSummary, FinancialBucket } from "./types";
import { locationBucket, LOCATION_BUCKETS } from "./location";
import { isOctane } from "./octane";

/**
 * Derives the "Sales Numbers" (gross-profit) view from the fullnew export. The
 * sheet is self-contained — make/type/year/location live next to the money
 * columns — so nothing is joined. Pure + deterministic.
 *
 * Two data-honesty rules learned from the real export:
 *  1. The five "KPI Forklift *" columns are CONSTANTS (the same company-wide
 *     total repeated on every row), so they're surfaced as-is, never summed.
 *  2. GP Month is unusable (one value); "Date paid" is the real time axis.
 * OCTANE rows are split out of the aggregates, matching the rest of the app.
 */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Parse a money cell that may be a number or a "$3,478.60" string. */
function money(v: CellValue): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function text(v: CellValue): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s || null;
}

function yearOf(v: CellValue): string | null {
  if (v == null || v === "") return null;
  const s = String(v);
  const m = s.match(/(\d{4})/);
  return m ? m[1] : null;
}

export function deriveFinancials(parsed: ParsedFile): FinancialSummary {
  const empty: FinancialSummary = {
    available: false, kpi: { cost: null, retail: null, partsBilled: null, paintBody: null, serviced: null },
    units: [], octaneCount: 0, soldCount: 0, gpCount: 0, totalRevenue: 0, totalCost: 0, totalGP: 0,
    marginPct: null, avgGP: null, totalCommission: 0, totalSpiff: 0, totalDownPayment: 0, underwaterCount: 0,
    byYear: [], byYard: [], gpDistribution: [], notes: ["No financial data found in this export."],
  };

  // Resolve real column names case-insensitively (the export mixes "Deposit date",
  // "DF input cost", "Final sale price", etc.).
  const byNorm = new Map<string, string>();
  for (const c of parsed.columns) if (!byNorm.has(norm(c))) byNorm.set(norm(c), c);
  const col = (name: string) => byNorm.get(norm(name));

  const C = {
    serial: col("Serial Number"), serial4: col("Serial 4"), make: col("Make"), type: col("Type"),
    year: col("Year"), fob: col("FOB State"),
    soldPrice: col("Gp TOTAL SOLD PRICE"), finalPrice: col("Final sale price"),
    differential: col("Final sale price Differential"), desired: col("Desired Price"), target: col("Target sale price"),
    cost: col("Gp Total Cost"), unitCost: col("Unit Cost"), dfInput: col("DF Input Cost"),
    commission: col("GP comission with spiff"), estW2: col("GP Estimator comission w2guys"),
    estSpiff: col("Gp estimator comissions with spiff"), estSpiffW2: col("Gp estimator comissions with spiff w2 guys"),
    estCost: col("GP estimator cost to customer"), spiff: col("SPIFF"),
    downPayment: col("Down payment Amount"), datePaid: col("Date paid"), depositDate: col("Deposit Date"),
    gpMonth: col("GP Month"),
    kCost: col("KPI Forklift Cost"), kRetail: col("KPI Forklift Retail"), kParts: col("KPI Forklift Parts Billed"),
    kPaint: col("KPI Forklift Paint and Body"), kServ: col("KPI Forklift Serviced"),
  };

  if (!C.soldPrice && !C.cost && !C.make) return empty;

  // Inventory/financial rows only (entity rows have no make/serial).
  const rows = parsed.rows.filter((r) =>
    (C.make && r[C.make] != null && r[C.make] !== "") ||
    (C.serial && r[C.serial] != null && r[C.serial] !== "")
  );
  if (rows.length === 0) return empty;

  const firstNum = (c: string | undefined): number | null => {
    if (!c) return null;
    for (const r of rows) { const n = money(r[c]); if (n != null) return n; }
    return null;
  };
  const kpi = {
    cost: firstNum(C.kCost), retail: firstNum(C.kRetail), partsBilled: firstNum(C.kParts),
    paintBody: firstNum(C.kPaint), serviced: firstNum(C.kServ),
  };

  const all: FinancialUnit[] = rows.map((r: Row, i) => {
    const soldPrice = money(C.soldPrice ? r[C.soldPrice] : null);
    const cost = money(C.cost ? r[C.cost] : null);
    const gp = soldPrice != null && cost != null ? soldPrice - cost : null;
    const make = text(C.make ? r[C.make] : null);
    return {
      rowIndex: i,
      serial4: text(C.serial4 ? r[C.serial4] : null),
      make, type: text(C.type ? r[C.type] : null), year: yearOf(C.year ? r[C.year] : null),
      location: text(C.fob ? r[C.fob] : null), isOctane: isOctane(make),
      soldPrice, finalPrice: money(C.finalPrice ? r[C.finalPrice] : null),
      differential: money(C.differential ? r[C.differential] : null),
      desiredPrice: money(C.desired ? r[C.desired] : null), targetPrice: money(C.target ? r[C.target] : null),
      cost, unitCost: money(C.unitCost ? r[C.unitCost] : null), dfInputCost: money(C.dfInput ? r[C.dfInput] : null),
      gp, margin: gp != null && soldPrice ? gp / soldPrice : null,
      commission: money(C.commission ? r[C.commission] : null),
      estCommissionW2: money(C.estW2 ? r[C.estW2] : null),
      estCommissionSpiff: money(C.estSpiff ? r[C.estSpiff] : null),
      estCommissionSpiffW2: money(C.estSpiffW2 ? r[C.estSpiffW2] : null),
      estCostToCustomer: money(C.estCost ? r[C.estCost] : null),
      spiff: money(C.spiff ? r[C.spiff] : null),
      downPayment: money(C.downPayment ? r[C.downPayment] : null),
      datePaid: text(C.datePaid ? r[C.datePaid] : null),
      depositDate: text(C.depositDate ? r[C.depositDate] : null),
      gpMonth: text(C.gpMonth ? r[C.gpMonth] : null),
    };
  });

  const units = all.filter((u) => !u.isOctane);
  const octaneCount = all.length - units.length;

  // A $0 (or negative) sold price with a real cost is a data artifact (cost
  // recorded, never a booked sale), not a unit sold below cost. Treat
  // soldPrice <= 0 as not-sold so these rows don't fabricate GP loss or inflate
  // the underwater count.
  const isSold = (u: FinancialUnit) => u.soldPrice != null && u.soldPrice > 0;
  const sold = units.filter(isSold);
  const computable = units.filter((u) => isSold(u) && u.cost != null);
  const totalRevenue = computable.reduce((s, u) => s + (u.soldPrice ?? 0), 0);
  const totalCost = computable.reduce((s, u) => s + (u.cost ?? 0), 0);
  const totalGP = totalRevenue - totalCost;
  const avgGP = computable.length ? Math.round(totalGP / computable.length) : null;

  // GP by Date-paid year (the only usable time axis).
  const yearMap = new Map<string, FinancialBucket>();
  for (const u of computable) {
    const y = yearOf(u.datePaid);
    if (!y) continue;
    const b = yearMap.get(y) ?? { label: y, count: 0, revenue: 0, gp: 0 };
    b.count += 1; b.revenue += u.soldPrice ?? 0; b.gp += u.gp ?? 0;
    yearMap.set(y, b);
  }
  const byYear = [...yearMap.values()].sort((a, b) => a.label.localeCompare(b.label));
  const datedGpCount = [...yearMap.values()].reduce((s, b) => s + b.count, 0);
  const undatedGpCount = computable.length - datedGpCount;

  // GP by yard (4 mains + Other).
  const yardMap = new Map<string, FinancialBucket>();
  for (const u of computable) {
    const k = locationBucket(u.location);
    const b = yardMap.get(k) ?? { label: k, count: 0, revenue: 0, gp: 0 };
    b.count += 1; b.revenue += u.soldPrice ?? 0; b.gp += u.gp ?? 0;
    yardMap.set(k, b);
  }
  const byYard = LOCATION_BUCKETS.map((k) => yardMap.get(k)).filter((b): b is FinancialBucket => !!b);

  // Per-unit GP distribution.
  const dist = [
    { label: "Loss", count: 0, test: (g: number) => g < 0 },
    { label: "$0–5k", count: 0, test: (g: number) => g >= 0 && g < 5000 },
    { label: "$5–10k", count: 0, test: (g: number) => g >= 5000 && g < 10000 },
    { label: "$10–25k", count: 0, test: (g: number) => g >= 10000 && g < 25000 },
    { label: "$25k+", count: 0, test: (g: number) => g >= 25000 },
  ];
  for (const u of computable) for (const d of dist) if (d.test(u.gp!)) { d.count += 1; break; }

  const notes: string[] = [];
  if (octaneCount > 0) notes.push(`${octaneCount} OCTANE rows excluded from these totals (tracked separately).`);
  notes.push("KPI cost/retail/parts/paint/serviced are company-wide totals from the sheet, shown as-is.");
  if (undatedGpCount > 0) notes.push(`${undatedGpCount} unit${undatedGpCount === 1 ? "" : "s"} omitted from the by-year chart (no Date paid), so the year bars sum to less than total Gross Profit.`);
  if (kpi.retail == null) notes.push("Some KPI totals weren't present in this export.");

  return {
    available: true, kpi, units, octaneCount,
    soldCount: sold.length, gpCount: computable.length,
    totalRevenue, totalCost, totalGP,
    marginPct: totalRevenue ? (totalGP / totalRevenue) * 100 : null,
    avgGP,
    // Commission/spiff/down-payment are only meaningful on SOLD units. Unsold rows
    // carry a projected/GP-derived "commission" that is <= 0 (down to -$30k); summing
    // over all units nets two unlike quantities into a meaningless figure.
    totalCommission: sold.reduce((s, u) => s + (u.commission ?? 0), 0),
    totalSpiff: sold.reduce((s, u) => s + (u.spiff ?? 0), 0),
    totalDownPayment: sold.reduce((s, u) => s + (u.downPayment ?? 0), 0),
    underwaterCount: computable.filter((u) => (u.gp ?? 0) < 0).length,
    byYear, byYard, gpDistribution: dist.map((d) => ({ label: d.label, count: d.count })),
    notes,
  };
}
