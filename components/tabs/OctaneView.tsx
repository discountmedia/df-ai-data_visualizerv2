"use client";

import type { UnitRecord } from "@/lib/types";
import { OverviewGrid } from "../overview/OverviewGrid";
import { EmptyState } from "../states/States";
import { bucketedLocations } from "@/lib/location";

/**
 * OCTANE is a separate part of the company — these metrics are computed ONLY from
 * OCTANE units (Make = "OCTANE") and are never blended into the Discount Forklift
 * numbers on the other tabs.
 */
export function OctaneView({ units }: { units: UnitRecord[] }) {
  return (
    <div className="space-y-5 fade-up">
      <div>
        <p className="eyebrow text-brand">OCTANE</p>
        <h1 className="mt-1 text-xl font-bold text-ink">OCTANE — separate inventory &amp; metrics</h1>
        <p className="mt-1 text-[13px] text-ink-dim">
          A distinct part of the company. These {units.length} units are kept out of every Discount Forklift number.
        </p>
      </div>
      {units.length > 0 ? (
        <OverviewGrid units={units} allLocations={bucketedLocations(units)} />
      ) : (
        <EmptyState title="No OCTANE units in this view" />
      )}
    </div>
  );
}
