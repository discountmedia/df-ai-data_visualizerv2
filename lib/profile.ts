import type {
  Row, CellValue, ColumnProfile, ColumnType, ColumnRole, TrustLevel,
  SchemaProfile, WorkBucket, SaleBucket,
} from "./types";

const NULL_HEAVY = 70;

export function profileColumns(rows: Row[]): ColumnProfile[] {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const allCols = new Set<string>(cols);
  for (const r of rows) for (const k of Object.keys(r)) allCols.add(k);
  return Array.from(allCols).map((name) => {
    const values = rows.map((r) => r[name]);
    const nonNull = values.filter((v) => v !== null && v !== "");
    const nullPercent = rows.length ? Math.round(((rows.length - nonNull.length) / rows.length) * 100) : 100;
    const distinct = new Set(nonNull.map((v) => String(v))).size;
    const detectedType = detectType(nonNull);
    const sampleValues = uniqueSamples(nonNull, 8);
    const role = guessRole(name, detectedType, distinct, sampleValues);
    const trust = guessTrust(nullPercent, distinct, nonNull.length);
    return { name, detectedType, nullPercent, distinctCount: distinct, sampleValues, role, trust,
      reason: heuristicReason(nullPercent, detectedType, distinct) };
  });
}

function detectType(vals: CellValue[]): ColumnType {
  if (vals.length === 0) return "empty";
  let nums = 0, bools = 0, dates = 0;
  for (const v of vals) {
    if (typeof v === "number") nums++;
    else if (typeof v === "boolean") bools++;
    else if (typeof v === "string") {
      if (/^\d{4}-\d{2}-\d{2}/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}/.test(v)) dates++;
      else if (/^-?\d+(\.\d+)?$/.test(v)) nums++;
    }
  }
  const n = vals.length;
  if (bools / n > 0.8) return "boolean";
  if (dates / n > 0.8) return "date";
  if (nums / n > 0.8) return "number";
  if (nums > 0 && nums / n < 0.8 && nums / n > 0.1) return "mixed";
  return "string";
}

function uniqueSamples(vals: CellValue[], k: number): CellValue[] {
  const out: CellValue[] = []; const seen = new Set<string>();
  for (const v of vals) { const key = String(v);
    if (!seen.has(key)) { seen.add(key); out.push(v); if (out.length >= k) break; } }
  return out;
}

function guessTrust(nullPercent: number, distinct: number, nonNullCount: number): TrustLevel {
  if (nonNullCount === 0) return "deprecated";
  if (nullPercent >= NULL_HEAVY) return "low_signal";
  if (distinct <= 1) return "low_signal";
  return "trusted";
}

const KW: Record<Exclude<ColumnRole, "other">, RegExp> = {
  identifier: /\b(name|serial|unit\s*id|^id$|asset|vin)\b/i,
  location: /\b(location|loc|branch|site|yard|store|city|dealer|fob|warehouse)\b/i,
  work_stage: /\b(work|stage|status|condition|recon|prep|repair|diag|serviced|progress|sign\s*off)\b/i,
  sale_type: /\b(sale\s*type|deal|terms?|pif|paid|down\s*pmt|payment\s*type|sold)\b/i,
  payment_status: /\b(invoiced|invoice|balance|owed|collected|payment\s*status|deposit)\b/i,
  flag: /\b(signed|approved|complete|done|shipped|delivered)\b/i,
  metric: /\b(cap|lbs|weight|price|cost|amount|hours|hrs|qty|count)\b/i,
  date: /\b(date|created|updated|sold\s*on|delivered\s*on)\b/i,
};

function guessRole(name: string, type: ColumnType, distinct: number, samples: CellValue[]): ColumnRole {
  const sampleStr = samples.map((s) => String(s).toLowerCase()).join(" ");
  if (/(ready|working|needs?\s*diag|on\s*rent|sold|recon|serviced|in progress)/.test(sampleStr)) return "work_stage";
  if (/(paid in full|down payment|govt|government|po\b|rental)/.test(sampleStr)) return "sale_type";
  for (const [role, re] of Object.entries(KW) as [ColumnRole, RegExp][]) if (re.test(name)) return role;
  if (type === "number") return "metric";
  if (type === "date") return "date";
  return "other";
}

function heuristicReason(nullPercent: number, type: ColumnType, distinct: number): string {
  if (nullPercent >= NULL_HEAVY) return `${nullPercent}% empty — likely deprecated or rarely filled.`;
  if (distinct <= 1) return "Single constant value — no discriminating signal.";
  return `${type} column, ${nullPercent}% empty, ${distinct} distinct values.`;
}

export function heuristicSchema(rows: Row[]): SchemaProfile {
  const columns = profileColumns(rows);
  const byRole = (r: ColumnRole) => columns.find((c) => c.role === r && c.trust !== "deprecated")?.name;
  const workStage = byRole("work_stage");
  const saleType = byRole("sale_type");
  const workStageValueMap: Record<string, WorkBucket> = {};
  if (workStage) {
    const col = columns.find((c) => c.name === workStage)!;
    for (const v of col.sampleValues) workStageValueMap[String(v).toLowerCase()] = bucketWork(String(v));
  }
  const saleTypeValueMap: Record<string, SaleBucket> = {};
  if (saleType) {
    const col = columns.find((c) => c.name === saleType)!;
    for (const v of col.sampleValues) saleTypeValueMap[String(v).toLowerCase()] = bucketSale(String(v));
  }
  return {
    columns,
    conceptMap: {
      unitName: byRole("identifier"), location: byRole("location"), workStage, saleType,
      paymentStatus: byRole("payment_status"),
    },
    workStageValueMap, saleTypeValueMap,
    warnings: ["Heuristic inference (no AI). Connect ANTHROPIC_API_KEY for runtime schema inference."],
    source: "heuristic",
  };
}

function bucketWork(v: string): WorkBucket {
  const s = v.toLowerCase();
  if (/ready|complete|done|prepped|diagnosed|serviced/.test(s)) return "ready";
  if (/diag.*need|need.*diag|broken|inop/.test(s)) return "needs_diagnosis";
  if (/rent/.test(s)) return "on_rent";
  if (/sold/.test(s)) return "sold";
  if (/work|recon|prep|repair|service|body|progress/.test(s)) return "working";
  return "unknown";
}
function bucketSale(v: string): SaleBucket {
  const s = v.toLowerCase();
  if (/paid in full|^pif|paid/.test(s)) return "paid_in_full";
  if (/down|deposit|dp\b/.test(s)) return "down_payment";
  if (/govt|government|\bpo\b|purchase order/.test(s)) return "govt_po";
  if (/rent/.test(s)) return "rental";
  return "other";
}
