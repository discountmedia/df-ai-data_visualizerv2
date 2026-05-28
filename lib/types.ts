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
