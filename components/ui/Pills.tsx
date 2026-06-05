import { cn } from "@/lib/format";
import {
  WORK_LABEL,
  WORK_PILL,
  SALE_LABEL,
  SALE_PILL,
  TIER_LABEL,
  TIER_PILL,
} from "@/lib/buckets";
import type { WorkBucket, SaleBucket, PriorityTier } from "@/lib/types";

const base = "inline-block whitespace-nowrap border px-1.5 py-0.5 text-[12px] uppercase tracking-wide";

export function WorkPill({ work }: { work: WorkBucket }) {
  if (work === "unknown") return <span className="text-ink-faint">—</span>;
  return <span className={cn(base, WORK_PILL[work])}>{WORK_LABEL[work]}</span>;
}

export function SalePill({ sale }: { sale: SaleBucket }) {
  if (sale === "unknown") return <span className="text-ink-faint">—</span>;
  return <span className={cn(base, SALE_PILL[sale])}>{SALE_LABEL[sale]}</span>;
}

export function TierPill({ tier }: { tier: PriorityTier }) {
  return <span className={cn(base, "font-bold", TIER_PILL[tier])}>{TIER_LABEL[tier]}</span>;
}
