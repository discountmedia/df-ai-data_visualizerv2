import type {
  Row,
  EntitySet,
  SchemaProfile,
  SchemaOverrides,
  UnitRecord,
  WorkBucket,
  SaleBucket,
} from "./types";
import { findColumn } from "./entities";
import { resolveWork, resolveSale, isCommittedSale, isSigned, toNum } from "./bucketize";

/**
 * Flattens the base (inventory) rows into schema-resolved UnitRecords. Columns
 * are resolved from the inferred conceptMap plus the same structural patterns
 * deriveSales uses — never hardcoded export names — and vetoed columns are
 * honoured so a column the operator removed in review stops driving anything.
 * Bucketing/coercion go through lib/bucketize so every view agrees.
 *
 * This is the single source of truth for "what is one unit" across the
 * Overview metrics, charts, All-Units table, and the priority scorer.
 */

export function deriveUnits(
  entities: EntitySet,
  schema: SchemaProfile,
  overrides: SchemaOverrides
): UnitRecord[] {
  const vetoed = new Set(overrides.vetoedColumns);
  const baseRows = entities.rowsByEntity["base"] ?? [];
  // Only resolve against columns the operator kept.
  const cols = entities.base.columns.filter((c) => !vetoed.has(c));
  const usable = (col?: string) => (col && !vetoed.has(col) ? col : undefined);

  const nameCol = usable(schema.conceptMap.unitName) ?? findColumn(cols, [/^name$/i, /unit\s*name/i]);
  const serialCol = usable(schema.conceptMap.serial) ?? findColumn(cols, [/serial/i, /\bvin\b/i, /asset/i]);
  const locCol = usable(schema.conceptMap.location) ?? findColumn(cols, [/^location$/i, /branch|yard|site/i]);
  const workCol = usable(schema.conceptMap.workStage);
  const saleCol = usable(schema.conceptMap.saleType) ?? findColumn(cols, [/^sold!?$/i, /sale\s*type/i]);
  const signedCol = usable(schema.conceptMap.signed) ?? findColumn(cols, [/pandadoc.*sign/i, /\bsigned\b/i]);

  const makeCol = findColumn(cols, [/^make$/i, /manufacturer/i]);
  const modelCol = findColumn(cols, [/check\s*in\s*model/i, /^model$/i]);
  const typeCol = findColumn(cols, [/^type$/i, /category/i]);
  // Require the lbs token to be co-located with a capacity-ish word so we don't
  // bind to an unrelated "...lbs" column (e.g. "Total lbs shipped").
  const capCol = findColumn(cols, [
    /cap.*lbs|capacity/i,
    /(cap|capacity|rated|load|rating)\s*\(?\s*lbs?|lbs?.*(cap|capacity|rating)/i,
  ]);
  const soldByCol = findColumn(cols, [/sold\s*by/i, /sales.*sold/i]);
  const priceCol = findColumn(cols, [
    /^final\s*sale\s*price$/i,
    /final\s*sale\s*price(?!.*(differential|6))/i,
    /sold\s*price/i,
  ]);
  const customerCol = findColumn(cols, [/^sold\s*to$/i, /sold\s*to(?!6)/i, /customer/i]);

  // Curated recon checkpoints — work stage is spread across these (the recon
  // pipeline), NOT a single status column. When present they drive the work
  // bucket directly, which is far more accurate than mapping one column's values.
  const diagCol = findColumn(cols, [/^diagnosed$/i]);
  const servCol = findColumn(cols, [/^serviced$/i]);
  const signoffCol = findColumn(cols, [/final\s*sign\s*off\s*acceptable/i]);
  const rentCol = findColumn(cols, [/equipment\s*on\s*rent/i]);
  const soldCol = findColumn(cols, [/^sold!?$/i]);
  const curated = !!(diagCol || servCol || signoffCol);

  const cell = (col: string | undefined, r: Row): string | null =>
    col && r[col] != null && r[col] !== "" ? String(r[col]) : null;

  // Work bucket from the recon checkpoints: on-rent > sold/removed > needs-diag
  // (no/incomplete diagnosis) > ready (serviced + sign-off ok) > working.
  const curatedWork = (r: Row): WorkBucket | null => {
    if (!curated) return null;
    if (cell(rentCol, r)) return "on_rent";
    const sold = cell(soldCol, r);
    if (sold && /removed/i.test(sold)) return "sold";
    const diag = cell(diagCol, r);
    if (!diag || /needed/i.test(diag)) return "needs_diagnosis";
    const serv = cell(servCol, r);
    const signoff = cell(signoffCol, r);
    const serviced = !!serv && /^serviced$/i.test(serv);
    const signoffBad = !!signoff && /needs/i.test(signoff);
    return serviced && !signoffBad ? "ready" : "working";
  };
  // Sale/commitment bucket straight from SOLD!.
  const curatedSale = (r: Row): SaleBucket | null => {
    const s = cell(soldCol, r);
    if (s == null) return null;
    if (/none/i.test(s)) return "unknown";
    if (/paid\s*in\s*full/i.test(s)) return "paid_in_full";
    if (/down\s*payment/i.test(s)) return "down_payment";
    if (/govt|government|\bpo\b/i.test(s)) return "govt_po";
    return "other";
  };

  return baseRows.map((r, i) => {
    const workRaw = workCol ? cell(workCol, r) : null;
    const saleRaw = saleCol ? cell(saleCol, r) : null;
    const work: WorkBucket = curatedWork(r) ?? (workRaw ? resolveWork(workRaw, schema) : "unknown");
    const sale: SaleBucket = curatedSale(r) ?? (saleRaw ? resolveSale(saleRaw, schema) : "unknown");
    const serial = cell(serialCol, r);
    const name = cell(nameCol, r);
    return {
      id: serial ?? name ?? `row-${i}`,
      rowIndex: i,
      name,
      serial,
      make: cell(makeCol, r),
      model: cell(modelCol, r),
      type: cell(typeCol, r),
      location: cell(locCol, r),
      capacity: capCol ? toNum(r[capCol]) : null,
      work,
      workRaw,
      sale,
      saleRaw,
      committed: isCommittedSale(sale),
      signed: signedCol ? isSigned(r[signedCol]) : false,
      soldBy: cell(soldByCol, r),
      price: priceCol ? toNum(r[priceCol]) : null,
      customer: cell(customerCol, r),
    };
  });
}
