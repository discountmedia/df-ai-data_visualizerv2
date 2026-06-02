import { cn, fmt, fmtMoney } from "@/lib/format";

export type Accent = "ink" | "ready" | "working" | "diag" | "rent" | "pif" | "downpmt" | "govt" | "brand";

const ACCENT: Record<Accent, string> = {
  ink: "text-ink", ready: "text-ready", working: "text-working", diag: "text-diag",
  rent: "text-rent", pif: "text-pif", downpmt: "text-downpmt", govt: "text-govt", brand: "text-brand",
};

const COLS: Record<number, string> = {
  2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4", 5: "sm:grid-cols-5", 6: "sm:grid-cols-3 lg:grid-cols-6",
};

export interface StatItem {
  label: string;
  /** number → formatted; string → shown verbatim (for computed stats like "12 yrs"). */
  value: number | string | null;
  accent?: Accent;
  sub?: string;
  /** false → greyed "—" + "Low confidence" (mirrors MetricCard). */
  available?: boolean;
  money?: boolean;
}

export function StatCards({ items, cols = 3 }: { items: StatItem[]; cols?: number }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", COLS[cols] ?? "sm:grid-cols-3")}>
      {items.map((it, i) => {
        const available = it.available !== false && it.value !== null;
        const display =
          typeof it.value === "string" ? it.value
            : it.value == null ? "—"
              : it.money ? fmtMoney(it.value) : fmt(it.value);
        return (
          <div key={i} className="card card-hover p-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow">{it.label}</p><span className="text-ink-faint">→</span>
            </div>
            <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums",
              available ? ACCENT[it.accent ?? "ink"] : "text-ink-faint")}>
              {available ? display : "—"}
            </p>
            <p className="mt-2 text-[11px] text-ink-faint">
              {available ? it.sub ?? "" : "Low confidence — column not mapped"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
