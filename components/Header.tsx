"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { LogsAlertBadge } from "@/components/logs/LogsAlertBadge";

export interface TabDef {
  id: string;
  label: string;
  count?: number | null;
}

export function Header({
  tabs,
  activeTab,
  onTab,
  onAnalyze,
  refining,
  search,
}: {
  tabs: TabDef[];
  activeTab: string;
  onTab: (id: string) => void;
  onAnalyze?: () => void;
  refining?: boolean;
  search?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur">
      <div className="top-rule" />
      <div className="mx-auto max-w-[1600px] px-5">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Discount Forklift" className="h-9 w-auto shrink-0 sm:h-11" />
            <span className="hidden shrink-0 text-[13px] uppercase tracking-wider text-ink-dim lg:inline">Discount Forklift - Inventory Overview</span>
          </div>
          {search && <div className="flex min-w-0 flex-1 justify-center">{search}</div>}
          <div className="flex shrink-0 items-center gap-2">
            {refining && (
              <span className="inline-flex items-center gap-1.5 border border-working/40 px-2 py-1 text-[12px] uppercase tracking-wider text-working">
                <span className="animate-pulse" aria-hidden="true">●</span> Updating numbers…
              </span>
            )}
            {onAnalyze && (
              <button onClick={onAnalyze}
                className="flex items-center gap-1 border border-line px-3 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink">
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
                  "flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-[15px] font-medium uppercase tracking-wide transition-colors",
                  active ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
                )}
              >
                {t.label}
                {t.count != null && (
                  <span className={cn("tabular-nums", active ? "text-brand" : "text-ink-faint")}>
                    {t.count.toLocaleString()}
                  </span>
                )}
                {t.id === "logs" && <LogsAlertBadge />}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
