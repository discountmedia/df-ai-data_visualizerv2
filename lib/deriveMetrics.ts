import type {
  UnitRecord, OverviewMetrics, MetricValue, WorkBucket, SaleBucket, LocationSnapshot,
} from "./types";

/**
 * Overview metrics are derived from the SAME UnitRecords that feed the charts,
 * All-Units table, and the priority scorer (see lib/deriveUnits). Deriving from
 * one source guarantees the metric cards can't contradict the views beside them
 * — a unit is bucketed exactly once, in deriveUnits, via lib/bucketize.
 */

const NA: MetricValue = { value: null, available: false };
const v = (n: number): MetricValue => ({ value: n, available: true });

export function deriveMetrics(units: UnitRecord[]): OverviewMetrics {
  const work: Record<WorkBucket, number> = { ready: 0, working: 0, needs_diagnosis: 0, on_rent: 0, sold: 0, unknown: 0 };
  const sale: Record<SaleBucket, number> = { paid_in_full: 0, down_payment: 0, govt_po: 0, rental: 0, other: 0, unknown: 0 };
  const locMap = new Map<string, LocationSnapshot>();
  let openWorkOnSold = 0;
  let hasWork = false, hasSale = false, hasLoc = false;

  for (const u of units) {
    work[u.work]++; sale[u.sale]++;
    if (u.workRaw != null) hasWork = true;
    if (u.saleRaw != null) hasSale = true;
    const hasOpenWork = u.work === "working" || u.work === "needs_diagnosis";
    if (u.committed && hasOpenWork) openWorkOnSold++;
    const key = u.location ?? "Unassigned";
    if (u.location != null) hasLoc = true;
    const snap = locMap.get(key) ?? { name: key, total: 0, ready: 0, working: 0, needs_diagnosis: 0, on_rent: 0, sold: 0 };
    snap.total++; if (u.work !== "unknown") snap[u.work]++; locMap.set(key, snap);
  }

  const locations = hasLoc ? Array.from(locMap.values()).sort((a, b) => b.total - a.total) : [];
  return {
    totalFleet: units.length,
    ready: hasWork ? v(work.ready) : NA,
    working: hasWork ? v(work.working) : NA,
    needsDiagnosis: hasWork ? v(work.needs_diagnosis) : NA,
    onRent: hasWork ? v(work.on_rent) : NA,
    sold: hasWork ? v(work.sold) : NA,
    paidInFull: hasSale ? v(sale.paid_in_full) : NA,
    downPayment: hasSale ? v(sale.down_payment) : NA,
    govtPo: hasSale ? v(sale.govt_po) : NA,
    openWorkOnSold: hasWork && hasSale ? v(openWorkOnSold) : NA,
    locations,
  };
}
