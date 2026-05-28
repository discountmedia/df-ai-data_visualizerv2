"use client";

import { cn } from "@/lib/format";

export type Tab = "overview" | "sales" | "priority" | "all" | "insights";

interface TabDef {
  id: Tab;
  label: string;
  live: boolean;
  count?: number | null;
}

export function Header({
  fileName,
  unitCount,
  source,
  activeTab,
  onTab,
  salesCount,
  onReset,
}: {
  fileName: string;
  unitCount: number;
  source: "claude" | "heuristic";
  activeTab: Tab;
  onTab: (t: Tab) => void;
  salesCount: number | null;
  onReset: () => void;
}) {
  const tabs: TabDef[] = [
    { id: "overview", label: "Overview", live: true, count: unitCount },
    { id: "sales", label: "Sales Team", live: true, count: salesCount },
    { id: "priority", label: "Priority", live: false },
    { id: "all", label: "All Units", live: false },
    { id: "insights", label: "AI Insights", live: false },
  ];

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-ground/90 backdrop-blur">
      <div className="top-rule" />
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex items-center justify-between py-3">
          <div className="flex items-baseline gap-3">
            <span className="text-sm font-bold tracking-tight text-brand">DISCOUNT FORKLIFT</span>
            <span className="hidden text-[11px] text-ink-faint sm:inline">inventory intelligence</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-2 text-[11px] text-ink-faint md:flex">
              <span className="text-ink-dim">{fileName}</span>
              <span className="text-ink-faint">·</span>
              <span>{unitCount.toLocaleString()} units</span>
              <span className={cn("border px-1.5 py-0.5 uppercase",
                source === "claude" ? "border-ready/40 text-ready" : "border-working/40 text-working")}>
                {source === "claude" ? "AI" : "heuristic"}
              </span>
            </span>
            <button onClick={onReset}
              className="border border-line px-3 py-1 text-[11px] uppercase tracking-wider text-ink-dim hover:border-brand hover:text-ink">
              New file
            </button>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                disabled={!t.live}
                onClick={() => t.live && onTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs uppercase tracking-wider transition-colors",
                  active ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink",
                  !t.live && "cursor-not-allowed text-ink-faint hover:text-ink-faint"
                )}
              >
                {t.label}
                {t.live && t.count != null && (
                  <span className={cn("tabular-nums", active ? "text-brand" : "text-ink-faint")}>{t.count}</span>
                )}
                {!t.live && <span className="text-[9px] text-ink-faint">soon</span>}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
