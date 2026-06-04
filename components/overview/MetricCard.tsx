import { cn, fmt } from "@/lib/format";
import type { MetricValue } from "@/lib/types";

export type Accent = "ink" | "ready" | "working" | "diag" | "rent" | "pif" | "downpmt" | "govt" | "brand";

const ACCENT: Record<Accent, string> = {
  ink: "text-ink", ready: "text-ready", working: "text-working", diag: "text-diag",
  rent: "text-rent", pif: "text-pif", downpmt: "text-downpmt", govt: "text-govt", brand: "text-brand",
};

export function MetricCard({ label, metric, accent = "ink", subtext, onClick }:
  { label: string; metric: number | MetricValue; accent?: Accent; subtext?: string; onClick?: () => void }) {
  const value = typeof metric === "number" ? metric : metric.value;
  const available = typeof metric === "number" ? true : metric.available;
  const clickable = !!onClick && available && (value ?? 0) > 0;

  const inner = (
    <>
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span className={cn("transition-colors", clickable ? "text-ink-dim group-hover:text-brand" : "text-ink-faint")}>→</span>
      </div>
      <p className={cn("mt-2 font-display text-5xl leading-none tabular-nums",
        available ? ACCENT[accent] : "text-ink-faint")}>
        {available ? fmt(value) : "—"}
      </p>
      <p className="mt-2 text-[11px] text-ink-faint">
        {available ? subtext ?? "" : "Low confidence — column not mapped"}
      </p>
    </>
  );

  if (clickable) {
    return (
      <button
        onClick={onClick}
        title={`View the ${typeof value === "number" ? fmt(value) : ""} units behind ${label}`}
        className="card card-hover group w-full p-4 text-left transition-colors hover:border-brand/60 focus:border-brand focus-visible:outline-none"
      >
        {inner}
      </button>
    );
  }
  return <div className="card card-hover p-4">{inner}</div>;
}
