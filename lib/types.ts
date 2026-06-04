/**
 * Central types. The whole app is schema-agnostic: we never assume column
 * names. Structure is inferred at runtime (Claude, with a heuristic fallback)
 * and described by SchemaProfile, which downstream views consume.
 */

export type CellValue = string | number | boolean | null;
export type Row = Record<string, CellValue>;

export interface ParsedFile {
  fileName: string;
  sheetName: string;
  sheetNames: string[];
  rows: Row[];
  columns: string[];
}

export type ColumnType = "string" | "number" | "boolean" | "date" | "mixed" | "empty";

export type ColumnRole =
  | "identifier"
  | "location"
  | "work_stage"
  | "sale_type"
  | "payment_status"
  | "flag"
  | "metric"
  | "date"
  | "other";

export type TrustLevel = "trusted" | "low_signal" | "deprecated" | "duplicate";

export interface ColumnProfile {
  name: string;
  detectedType: ColumnType;
  nullPercent: number;
  distinctCount: number;
  sampleValues: CellValue[];
  role: ColumnRole;
  trust: TrustLevel;
  reason: string;
}

export type WorkBucket = "ready" | "working" | "needs_diagnosis" | "on_rent" | "sold" | "unknown";
export type SaleBucket = "paid_in_full" | "down_payment" | "govt_po" | "rental" | "other" | "unknown";

export interface SchemaProfile {
  columns: ColumnProfile[];
  conceptMap: {
    unitName?: string;
    serial?: string;
    location?: string;
    workStage?: string;
    saleType?: string;
    paymentStatus?: string;
    invoiced?: string;
    signed?: string;
  };
  workStageValueMap: Record<string, WorkBucket>;
  saleTypeValueMap: Record<string, SaleBucket>;
  warnings: string[];
  source: "claude" | "heuristic";
}

export interface SchemaOverrides {
  vetoedColumns: string[];
}

export interface MetricValue {
  value: number | null;
  available: boolean;
}

export interface LocationSnapshot {
  name: string;
  total: number;
  ready: number;
  working: number;
  needs_diagnosis: number;
  on_rent: number;
  sold: number;
}

export interface OverviewMetrics {
  totalFleet: number;
  ready: MetricValue;
  working: MetricValue;
  needsDiagnosis: MetricValue;
  onRent: MetricValue;
  sold: MetricValue;
  paidInFull: MetricValue;
  downPayment: MetricValue;
  govtPo: MetricValue;
  openWorkOnSold: MetricValue;
  locations: LocationSnapshot[];
}

/* ----------------------------------------------------------------------------
 * Multi-entity ingestion (the export stacks several tables in one sheet).
 * Entities are detected structurally via the `prefix::` naming convention,
 * never by hardcoded column names.
 * ------------------------------------------------------------------------- */

export interface EntityTable {
  /** "base" for unprefixed columns, otherwise the detected prefix (e.g. "email"). */
  key: string;
  label: string;
  columns: string[];
  /** Rows where at least one of this entity's columns is populated. */
  rowCount: number;
}

export interface EntitySet {
  base: EntityTable;
  related: EntityTable[];
  /** Quick lookup: entity key -> rows belonging to it. */
  rowsByEntity: Record<string, Row[]>;
}

/* ----------------------------------------------------------------------------
 * Sales-team analytics
 * ------------------------------------------------------------------------- */

export interface SoldUnit {
  rep: string;
  make: string | null;
  model: string | null;
  type: string | null;
  saleType: SaleBucket;
  saleTypeRaw: string | null;
  price: number | null;
  customer: string | null;
  signed: boolean;
}

export interface SalesRep {
  name: string;
  /** Trailing employee id parsed from the padded name, if any. */
  repId: string | null;
  location: string | null;
  title: string | null;
  /** Outbound sender address (email::email_from_address). No contact-email column exists. */
  email: string | null;
  /** No phone column exists anywhere in the export; always null (UI shows "—"). */
  phone: string | null;
  unitsSold: number;
  totalSale: number | null;
  avgSale: number | null;
  emailsSent: number | null;
  unsignedDocs: number;
}

export interface RoundRobinQueue {
  queue: string; // e.g. "Denver walk-in", "Call-in", "Chat"
  assignee: string | null;
}

export interface LeadSource {
  source: string;
  count: number;
}

export interface SalesSummary {
  totalSold: number;
  reps: SalesRep[];
  /** Sold/committed units with no signature, excluding Govt PO & Removed. */
  unsignedWorklist: SoldUnit[];
  unsignedCount: number;
  roundRobin: RoundRobinQueue[];
  roundRobinAsOf: string | null;
  leadSources: LeadSource[];
  /** Per-rep list of units they sold (for the drill-down). */
  soldUnitsByRep: Record<string, SoldUnit[]>;
  emailsAvailable: boolean;
  totalEmails: number | null;
  /** Plain-language notes on what was/wasn't found (shown in the UI). */
  notes: string[];
}

/* ----------------------------------------------------------------------------
 * Per-unit record (one inventory row, schema-resolved). Columns are resolved
 * from the conceptMap + structural patterns — never hardcoded export names.
 * Feeds the All-Units table and the priority scorer.
 * ------------------------------------------------------------------------- */

/**
 * Display-only spec sheet shown in a unit's accordion drawer. Every field is
 * resolved from the broker/measurement export columns (never hardcoded) and is
 * null when that column is absent or empty.
 */
export interface UnitSpecs {
  hours: string | null;
  forkLength: string | null;
  mast: string | null;
  tires: string | null;
  loweredHeight: string | null;
  raisedHeight: string | null;
  warehouse: string | null;
  attachments: string | null;
  productUrl: string | null;
  youtubeUrl: string | null;
}

export interface UnitRecord {
  /** Stable key for React + dedupe: serial, else name, else row index. */
  id: string;
  rowIndex: number;
  name: string | null;
  /** The lift's given name ("Forklift Name", e.g. "Lula"). */
  forkliftName: string | null;
  serial: string | null;
  /** Last-4 of the serial ("Serial 4") — shown in place of the full serial. */
  serial4: string | null;
  make: string | null;
  model: string | null;
  type: string | null;
  year: string | null;
  fuel: string | null;
  location: string | null;
  capacity: number | null;
  work: WorkBucket;
  workRaw: string | null;
  sale: SaleBucket;
  saleRaw: string | null;
  /** True only when a sale/commitment exists (sale ∈ committed buckets). */
  committed: boolean;
  signed: boolean;
  soldBy: string | null;
  price: number | null;
  customer: string | null;
  /** Broker/measurement spec sheet for the accordion drawer. */
  specs: UnitSpecs;
}

/* ----------------------------------------------------------------------------
 * Priority scoring. Deterministic and fully explainable — every point a unit
 * earns is itemised in `factors` so the Insights tab can show exactly how a
 * score was calculated. AI (when available) layers narrative on top; it never
 * computes the score.
 * ------------------------------------------------------------------------- */

export type PriorityTier = "act_now" | "high" | "medium" | "low";

export interface ScoreFactor {
  /** Stable rule key (matches a ScoreWeights field). */
  key: string;
  label: string;
  /** Points this rule contributed to the unit's score. */
  points: number;
  /** One-line, operator-auditable explanation. */
  detail: string;
}

export interface ScoredUnit {
  unit: UnitRecord;
  /** 0–100, capped. 0 means "nothing to act on" (excluded from the queue). */
  score: number;
  tier: PriorityTier;
  factors: ScoreFactor[];
  /** What the yard should actually do next. */
  action: string;
}

export interface ScoreWeights {
  committedUnfinished: number;
  paidInFullBonus: number;
  govtPoBonus: number;
  committedUnknownWork: number;
  needsDiagnosis: number;
  beingWorked: number;
  /** Bonus for high final-sale-price units already in the work queue (top tier). */
  highValue: number;
}

export interface ScoreRule {
  key: keyof ScoreWeights;
  label: string;
  points: number;
  /** Plain-language description of when this rule fires. */
  when: string;
}

export interface ScoringResult {
  /** Ranked desc by score; only units with score > 0 are included. */
  ranked: ScoredUnit[];
  weights: ScoreWeights;
  rules: ScoreRule[];
  tierCounts: Record<PriorityTier, number>;
  /** How many of the supplied units earned a non-zero score. */
  scoredCount: number;
  totalUnits: number;
  /** Plain-language methodology lines shown in the Insights panel. */
  methodology: string[];
}

/* ----------------------------------------------------------------------------
 * AI Insights — portfolio-level narrative. Always optional: the Insights tab's
 * "how scores were calculated" panel is deterministic; this layers a read on
 * top, with a heuristic fallback when no API key is set.
 * ------------------------------------------------------------------------- */

export type InsightSeverity = "act" | "watch" | "info";

export interface Insight {
  title: string;
  body: string;
  severity: InsightSeverity;
}

export interface InsightsResult {
  summary: string;
  insights: Insight[];
  source: "claude" | "heuristic";
  note?: string;
}

/* ----------------------------------------------------------------------------
 * Financials ("Sales Numbers") — gross-profit / margin analytics from the
 * fullnew export. Self-contained: every figure here comes from that sheet's
 * own per-unit rows, joined to nothing. Deterministic; AI never touches it.
 * ------------------------------------------------------------------------- */

/** One sold/inventory row's financial picture. All money fields are numbers or null. */
export interface FinancialUnit {
  rowIndex: number;
  serial4: string | null;
  make: string | null;
  type: string | null;
  year: string | null;
  /** Raw FOB State/location string (bucketed elsewhere). */
  location: string | null;
  isOctane: boolean;
  /** Gp TOTAL SOLD PRICE — the revenue figure. */
  soldPrice: number | null;
  /** Final sale price. */
  finalPrice: number | null;
  /** Final sale price Differential (often negative — sold below reference). */
  differential: number | null;
  desiredPrice: number | null;
  targetPrice: number | null;
  /** Gp Total Cost — the cost figure used for GP. */
  cost: number | null;
  unitCost: number | null;
  dfInputCost: number | null;
  /** Gross profit = soldPrice − cost, when both exist. */
  gp: number | null;
  /** gp / soldPrice. */
  margin: number | null;
  /** GP comission with spiff (sales commission). */
  commission: number | null;
  estCommissionW2: number | null;
  estCommissionSpiff: number | null;
  estCommissionSpiffW2: number | null;
  estCostToCustomer: number | null;
  spiff: number | null;
  downPayment: number | null;
  datePaid: string | null;
  depositDate: string | null;
  gpMonth: string | null;
}

export interface FinancialBucket {
  label: string;
  count: number;
  revenue: number;
  gp: number;
}

export interface FinancialSummary {
  available: boolean;
  /** Company-wide KPI totals from the sheet (constant per row — shown as-is, never summed). */
  kpi: {
    cost: number | null;
    retail: number | null;
    partsBilled: number | null;
    paintBody: number | null;
    serviced: number | null;
  };
  /** Per-unit financial rows, OCTANE excluded (split out like the rest of the app). */
  units: FinancialUnit[];
  octaneCount: number;
  /** Rows with a sold price. */
  soldCount: number;
  /** Rows where GP is computable (sold price AND cost). */
  gpCount: number;
  totalRevenue: number;
  totalCost: number;
  totalGP: number;
  marginPct: number | null;
  avgGP: number | null;
  totalCommission: number;
  totalSpiff: number;
  totalDownPayment: number;
  underwaterCount: number;
  byYear: FinancialBucket[];
  byYard: FinancialBucket[];
  gpDistribution: { label: string; count: number }[];
  notes: string[];
}
