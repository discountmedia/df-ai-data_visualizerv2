import type { ReactNode } from "react";

/** Card wrapper for a chart: eyebrow title + optional hint/right slot + fixed-height body. */
export function ChartPanel({
  title, hint, right, height = 224, ariaLabel, children,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  height?: number;
  /** Text alternative for the chart (WCAG 1.1.1). Sets role="img" on the body. */
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{title}</p>
        {right ?? (hint && <span className="text-[10px] text-ink-faint">{hint}</span>)}
      </div>
      <div
        className="mt-3 w-full"
        style={{ height }}
        {...(ariaLabel ? { role: "img", "aria-label": ariaLabel } : null)}
      >
        {children}
      </div>
    </section>
  );
}
