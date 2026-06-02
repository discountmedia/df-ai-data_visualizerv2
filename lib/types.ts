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

export interface UnitRecord {
  /** Stable key for React + dedupe: serial, else name, else row index. */
  id: string;
  rowIndex: number;
  name: string | null;
  serial: string | null;
  make: string | null;
  model: string | null;
  type: string | null;
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

export interface SecondOpinion {
  summary: string;
  insights: Insight[];
  model: string;
  source: "grok" | "openai";
}

export interface InsightsResult {
  summary: string;
  insights: Insight[];
  source: "claude" | "heuristic";
  note?: string;
  /** Independent second-opinion reads (Grok, GPT) that succeeded. */
  others?: SecondOpinion[];
  /** Per-provider error when an opinion is missing (e.g. wrong model string). */
  othersErrors?: Record<string, string>;
}
