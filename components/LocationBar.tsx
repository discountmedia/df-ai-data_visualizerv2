"use client";

import { useDashboard } from "./DashboardProvider";
import { cn, fmt } from "@/lib/format";
import type { LocationSnapshot } from "@/lib/types";

export function LocationBar({ locations }: { locations: LocationSnapshot[] }) {
  const { locationFilter, setLocation } = useDashboard();
  if (locations.length === 0) return null;
  const total = locations.reduce((s, l) => s + l.total, 0);
  const tabs = [{ name: "ALL", total }, ...locations];
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-1">
      <span className="eyebrow mr-2 shrink-0">Location:</span>
      {tabs.map((l) => {
        const active = locationFilter === l.name;
        return (
          <button key={l.name} onClick={() => setLocation(l.name)}
            aria-pressed={active}
            className={cn(
              "flex shrink-0 items-center gap-2 border px-3 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
              active ? "border-brand text-ink" : "border-transparent text-ink-dim hover:text-ink"
            )}>
            {l.name}<span className="text-ink-faint">{fmt(l.total)}</span>
          </button>
        );
      })}
    </div>
  );
}
