import type {
  Row, SchemaProfile, SchemaOverrides, OverviewMetrics, MetricValue,
  WorkBucket, SaleBucket, LocationSnapshot,
} from "./types";

const NA: MetricValue = { value: null, available: false };
const v = (n: number): MetricValue => ({ value: n, available: true });

export function deriveMetrics(rows: Row[], schema: SchemaProfile, overrides: SchemaOverrides): OverviewMetrics {
  const vetoed = new Set(overrides.vetoedColumns);
  const usable = (col?: string) => (col && !vetoed.has(col) ? col : undefined);
  const workCol = usable(schema.conceptMap.workStage);
  const saleCol = usable(schema.conceptMap.saleType);
  const locCol = usable(schema.conceptMap.location);

  const workOf = (r: Row): WorkBucket => {
    if (!workCol) return "unknown";
    const raw = r[workCol]; if (raw === null) return "unknown";
    return schema.workStageValueMap[String(raw).toLowerCase()] ?? "unknown";
  };
  const saleOf = (r: Row): SaleBucket => {
    if (!saleCol) return "unknown";
    const raw = r[saleCol]; if (raw === null) return "unknown";
    return schema.saleTypeValueMap[String(raw).toLowerCase()] ?? "unknown";
  };

  const work: Record<WorkBucket, number> = { ready: 0, working: 0, needs_diagnosis: 0, on_rent: 0, sold: 0, unknown: 0 };
  const sale: Record<SaleBucket, number> = { paid_in_full: 0, down_payment: 0, govt_po: 0, rental: 0, other: 0, unknown: 0 };
  const locMap = new Map<string, LocationSnapshot>();
  let openWorkOnSold = 0;

  for (const r of rows) {
    const wb = workOf(r); const sb = saleOf(r);
    work[wb]++; sale[sb]++;
    const isCommitted = sb === "paid_in_full" || sb === "down_payment" || sb === "govt_po";
    const hasOpenWork = wb === "working" || wb === "needs_diagnosis";
    if (isCommitted && hasOpenWork) openWorkOnSold++;
    if (locCol) {
      const key = r[locCol] === null ? "Unassigned" : String(r[locCol]);
      const snap = locMap.get(key) ?? { name: key, total: 0, ready: 0, working: 0, needs_diagnosis: 0, on_rent: 0, sold: 0 };
      snap.total++; if (wb !== "unknown") snap[wb]++; locMap.set(key, snap);
    }
  }
  const locations = Array.from(locMap.values()).sort((a, b) => b.total - a.total);
  return {
    totalFleet: rows.length,
    ready: workCol ? v(work.ready) : NA,
    working: workCol ? v(work.working) : NA,
    needsDiagnosis: workCol ? v(work.needs_diagnosis) : NA,
    onRent: workCol ? v(work.on_rent) : NA,
    sold: workCol ? v(work.sold) : NA,
    paidInFull: saleCol ? v(sale.paid_in_full) : NA,
    downPayment: saleCol ? v(sale.down_payment) : NA,
    govtPo: saleCol ? v(sale.govt_po) : NA,
    openWorkOnSold: workCol && saleCol ? v(openWorkOnSold) : NA,
    locations,
  };
}
