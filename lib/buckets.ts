import type { WorkBucket, SaleBucket, PriorityTier } from "./types";

/**
 * Display labels, pill styles, and chart colours for the inferred buckets.
 * Pill/bar classes are written as FULL static strings (never interpolated) so
 * Tailwind's JIT keeps them — matching the pattern in MetricCard/SchemaReview.
 */

export const WORK_LABEL: Record<WorkBucket, string> = {
  ready: "Ready",
  working: "Being Worked",
  needs_diagnosis: "Needs Diag",
  on_rent: "On Rent",
  sold: "Sold",
  unknown: "Unknown",
};

export const WORK_PILL: Record<WorkBucket, string> = {
  ready: "text-ready border-ready/40",
  working: "text-working border-working/40",
  needs_diagnosis: "text-diag border-diag/40",
  on_rent: "text-rent border-rent/40",
  sold: "text-ink-dim border-line",
  unknown: "text-ink-faint border-line",
};

export const WORK_BG: Record<WorkBucket, string> = {
  ready: "bg-ready",
  working: "bg-working",
  needs_diagnosis: "bg-diag",
  on_rent: "bg-rent",
  sold: "bg-ink-faint",
  unknown: "bg-line",
};

export const SALE_LABEL: Record<SaleBucket, string> = {
  paid_in_full: "Paid in Full",
  down_payment: "Down Pmt",
  govt_po: "Govt PO",
  rental: "Rental",
  other: "Other",
  unknown: "—",
};

export const SALE_PILL: Record<SaleBucket, string> = {
  paid_in_full: "text-pif border-pif/40",
  down_payment: "text-downpmt border-downpmt/40",
  govt_po: "text-govt border-govt/40",
  rental: "text-rent border-rent/40",
  other: "text-ink-dim border-line",
  unknown: "text-ink-faint border-line",
};

export const TIER_LABEL: Record<PriorityTier, string> = {
  act_now: "Act Now",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const TIER_PILL: Record<PriorityTier, string> = {
  act_now: "text-brand border-brand/50 bg-brand/10",
  high: "text-diag border-diag/40 bg-diag/5",
  medium: "text-working border-working/40 bg-working/5",
  low: "text-ink-dim border-line",
};

/** Bar fill colours for recharts (hex; recharts can't read CSS vars in props). */
export const WORK_HEX: Record<WorkBucket, string> = {
  ready: "#3ddc84",
  working: "#ffc02e",
  needs_diagnosis: "#ff3b46",
  on_rent: "#3aa0ff",
  sold: "#5e5e66",
  unknown: "#2a2a2e",
};

export const SALE_HEX: Record<SaleBucket, string> = {
  paid_in_full: "#ff8a3d",
  down_payment: "#ffb86b",
  govt_po: "#b07cff",
  rental: "#3aa0ff",
  other: "#9a9aa0",
  unknown: "#5e5e66",
};
