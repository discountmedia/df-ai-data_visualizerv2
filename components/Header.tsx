"use client";

import { cn } from "@/lib/format";

export interface TabDef {
  id: string;
  label: string;
  count?: number | null;
}

export function Header({
  fileName,
  tabs,
  activeTab,
  onTab,
  onAnalyze,
  refining,
}: {
  fileName: string;
  tabs: TabDef[];
  activeTab: string;
  onTab: (id: string) => void;
  onAnalyze?: () => void;
  refining?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur">
      <div className="top-rule" />
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Discount Forklift" className="h-5 w-auto shrink-0" />
            <span className="hidden shrink-0 text-[11px] uppercase tracking-wider text-ink-dim sm:inline">Inventory Dashboard</span>
            <span className="hidden truncate text-[11px] text-ink-faint md:inline">— {fileName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {refining && (
              <span className="inline-flex items-center gap-1 border border-working/40 px-2 py-1 text-[10px] uppercase tracking-wider text-working">
                <span className="animate-pulse">⚡</span> refining
              </span>
            )}
            {onAnalyze && (
              <button onClick={onAnalyze}
                className="flex items-center gap-1 bg-brand-strong px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90">
                ⚡ AI Analysis
              </button>
            )}
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs uppercase tracking-wider transition-colors",
                  active ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
                )}
              >
                {t.label}
                {t.count != null && (
                  <span className={cn("tabular-nums", active ? "text-brand" : "text-ink-faint")}>
                    {t.count.toLocaleString()}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
