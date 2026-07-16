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
  // Location keys off the dedicated "FOB State" column first (owner ask: bucket
  // by FOB state, not a looser city string — "Arlington, Virginia" must not fall
  // into DFW). Pinning it here also keeps it stable when the AI schema refine
  // would otherwise drift the location concept onto "FOB City and State"/"Warehouse".
  // locationBucket() still maps these states (and rep departments) into the yards.
  const locCol =
    findColumn(cols, [/^fob\s*state$/i, /\bfob\b[^a-z]*state/i]) ??
    usable(schema.conceptMap.location) ??
    findColumn(cols, [/^location$/i, /branch|yard|site/i]);
  const workCol = usable(schema.conceptMap.workStage);
  const saleCol = usable(schema.conceptMap.saleType) ?? findColumn(cols, [/^sold!?$/i, /sale\s*type/i]);
  const signedCol = usable(schema.conceptMap.signed) ?? findColumn(cols, [/pandadoc.*sign/i, /\bsigned\b/i]);

  const makeCol = findColumn(cols, [/^make$/i, /manufacturer/i]);
  const modelCol = findColumn(cols, [/check\s*in\s*model/i, /^model$/i]);
  const typeCol = findColumn(cols, [/^type$/i, /category/i]);
  const forkliftNameCol = findColumn(cols, [/forklift\s*name/i]);
  const serial4Col = findColumn(cols, [/serial\s*4/i, /last\s*4/i]);
  const yearCol = findColumn(cols, [/^year$/i]);
  const fuelCol = findColumn(cols, [/^fuel\s*type$/i, /types?\s*of\s*electric/i, /invoice\s*fuel/i]);
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

  // Broker/measurement spec columns for the accordion drawer (display only).
  const hoursCol = findColumn(cols, [/^hours$/i]);
  const forkLengthCol = findColumn(cols, [/fork\s*length/i]);
  const mastCol = findColumn(cols, [/^mast$/i]);
  const tiresCol = findColumn(cols, [/^tires?$/i]);
  const loweredCol = findColumn(cols, [/lowered\s*height/i, /broker\s*lowered/i]);
  const raisedCol = findColumn(cols, [/raised\s*height/i, /broker\s*raise/i]);
  const warehouseCol = findColumn(cols, [/^warehouse$/i]);
  const attachCol = findColumn(cols, [/broker\s*attachments/i, /^attachments$/i, /attachments/i]);
  const productUrlCol = findColumn(cols, [/product\s*server\s*url/i, /product.*url/i]);
  const youtubeCol = findColumn(cols, [/youtubeurl/i, /youtube\s*video/i, /youtube/i]);

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

  // Last 4 alphanumerics of a serial — the short id shown in unit titles.
  const last4 = (serial: string | null): string | null => {
    if (!serial) return null;
    const alnum = serial.replace(/[^a-zA-Z0-9]/g, "");
    return alnum.length >= 4 ? alnum.slice(-4) : alnum || null;
  };

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
      forkliftName: cell(forkliftNameCol, r),
      serial,
      // Prefer a dedicated "Serial 4" column; otherwise fall back to the last 4
      // alphanumerics of the full serial so unit titles keep their #nnnn lead-in
      // (the PRO contract sends a full "Serial Number", no separate Serial 4).
      serial4: cell(serial4Col, r) ?? last4(serial),
      make: cell(makeCol, r),
      model: cell(modelCol, r),
      type: cell(typeCol, r),
      year: cell(yearCol, r),
      fuel: cell(fuelCol, r),
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
      specs: {
        hours: cell(hoursCol, r),
        forkLength: cell(forkLengthCol, r),
        mast: cell(mastCol, r),
        tires: cell(tiresCol, r),
        loweredHeight: cell(loweredCol, r),
        raisedHeight: cell(raisedCol, r),
        warehouse: cell(warehouseCol, r),
        attachments: cell(attachCol, r),
        productUrl: cell(productUrlCol, r),
        youtubeUrl: cell(youtubeCol, r),
      },
    };
  });
}
