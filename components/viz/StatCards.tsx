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
  /** When set (and the stat has data), the card becomes a button that drills in. */
  onClick?: () => void;
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
        const clickable = !!it.onClick && available && (typeof it.value === "number" ? it.value > 0 : true);
        const inner = (
          <>
            <div className="flex items-center justify-between">
              <p className="eyebrow">{it.label}</p>
              <span className={cn("transition-colors", clickable ? "text-ink-dim group-hover:text-brand" : "text-ink-faint")}>→</span>
            </div>
            <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums",
              available ? ACCENT[it.accent ?? "ink"] : "text-ink-faint")}>
              {available ? display : "—"}
            </p>
            <p className="mt-2 text-[13px] text-ink-faint">
              {available ? it.sub ?? "" : "Low confidence — column not mapped"}
            </p>
          </>
        );
        if (clickable) {
          return (
            <button
              key={i}
              onClick={it.onClick}
              title={`View the units behind ${it.label}`}
              className="card card-hover group w-full p-4 text-left transition-colors hover:border-brand/60 focus:border-brand focus-visible:outline-none"
            >
              {inner}
            </button>
          );
        }
        return <div key={i} className="card card-hover p-4">{inner}</div>;
      })}
    </div>
  );
}
