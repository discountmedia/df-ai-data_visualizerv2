import type { ReactNode } from "react";

/** Card wrapper for a chart: eyebrow title + optional hint/right slot + fixed-height body. */
export function ChartPanel({
  title, hint, right, height = 224, children,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  height?: number;
  children: ReactNode;
}) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <p className="eyebrow">{title}</p>
        {right ?? (hint && <span className="text-[10px] text-ink-faint">{hint}</span>)}
      </div>
      <div className="mt-3 w-full" style={{ height }}>{children}</div>
    </section>
  );
}
