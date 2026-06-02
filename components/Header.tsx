"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/format";

export interface TabDef {
  id: string;
  label: string;
  count?: number | null;
}

export function Header({
  fileName,
  unitCount,
  source,
  tabs,
  activeTab,
  onTab,
  onReset,
  onAnalyze,
}: {
  fileName: string;
  unitCount: number;
  source: "claude" | "heuristic";
  tabs: TabDef[];
  activeTab: string;
  onTab: (id: string) => void;
  onReset: () => void;
  onAnalyze?: () => void;
}) {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    const saved = (localStorage.getItem("theme") as "dark" | "light" | null)
      ?? (document.documentElement.dataset.theme as "dark" | "light" | undefined)
      ?? "dark";
    setTheme(saved);
    document.documentElement.dataset.theme = saved;
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur">
      <div className="top-rule" />
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-baseline gap-3">
            <span className="shrink-0 text-sm font-bold tracking-tight text-brand">DISCOUNT FORKLIFT</span>
            <span className="hidden shrink-0 text-[11px] uppercase tracking-wider text-ink-dim sm:inline">Inventory Dashboard</span>
            <span className="hidden truncate text-[11px] text-ink-faint md:inline">— {fileName}</span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-2 text-[11px] text-ink-faint lg:flex">
              <span>{unitCount.toLocaleString()} units</span>
              <span className={cn("border px-1.5 py-0.5 uppercase",
                source === "claude" ? "border-ready/40 text-ready" : "border-working/40 text-working")}>
                {source === "claude" ? "AI" : "heuristic"}
              </span>
            </span>
            <button onClick={toggleTheme}
              className="border border-line px-2.5 py-1 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink">
              {theme === "dark" ? "☀ Light" : "☾ Dark"}
            </button>
            {onAnalyze && (
              <button onClick={onAnalyze}
                className="flex items-center gap-1 bg-brand px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white transition-opacity hover:opacity-90">
                ⚡ AI Analysis
              </button>
            )}
            <button onClick={onReset}
              className="border border-line px-3 py-1 text-[11px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink">
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
                onClick={() => onTab(t.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs uppercase tracking-wider transition-colors",
                  active ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
                )}
              >
                {t.label}
                {t.count != null && (
                  <span className={cn("tabular-nums", active ? "text-brand" : "text-ink-faint")}>{t.count}</span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
