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
              // Deliberately a different shape from the underline nav above: a
              // filled segmented chip, so "filter WHERE" reads distinct from
              // "navigate WHAT". Same brand accent, different form.
              "flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-[12px] uppercase tracking-wider transition-colors",
              active ? "border-brand bg-brand/10 text-ink" : "border-line/60 text-ink-dim hover:border-line hover:text-ink"
            )}>
            {l.name}<span className={cn("tabular-nums", active ? "text-brand" : "text-ink-faint")}>{fmt(l.total)}</span>
          </button>
        );
      })}
    </div>
  );
}
