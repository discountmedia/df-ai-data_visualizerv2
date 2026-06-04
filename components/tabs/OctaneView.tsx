"use client";

import { useMemo } from "react";
import type { UnitRecord, WorkBucket } from "@/lib/types";
import { StatCards } from "../viz/StatCards";
import { EmptyState } from "../states/States";

/**
 * OCTANE is a separate part of the company — its team doesn't use this tool and
 * we rarely look at their numbers, so this is a deliberately bare view: a few
 * headline counts, nothing more. OCTANE is excluded from every DF metric.
 */
export function OctaneView({ units }: { units: UnitRecord[] }) {
  const counts = useMemo(() => {
    const c = new Map<WorkBucket, number>();
    for (const u of units) c.set(u.work, (c.get(u.work) ?? 0) + 1);
    return c;
  }, [units]);
  const committed = units.filter((u) => u.committed).length;

  return (
    <div className="space-y-5 fade-up">
      <div>
        <p className="eyebrow text-brand">OCTANE</p>
        <h1 className="mt-1 text-xl font-bold text-ink">OCTANE — separate inventory</h1>
        <p className="mt-1 text-[13px] text-ink-dim">
          A distinct part of the company, kept out of all Discount Forklift numbers. Lightweight by design — OCTANE runs on its own.
        </p>
      </div>
      {units.length > 0 ? (
        <StatCards cols={3} items={[
          { label: "OCTANE Units", value: units.length, accent: "ink", sub: "total inventory" },
          { label: "Committed", value: committed, accent: "pif", sub: "paid / deposit / PO" },
          { label: "On Rent", value: counts.get("on_rent") ?? 0, accent: "rent", sub: "generating income" },
          { label: "Ready", value: counts.get("ready") ?? 0, accent: "ready", sub: "prepped" },
          { label: "In Service", value: (counts.get("working") ?? 0) + (counts.get("needs_diagnosis") ?? 0), accent: "working", sub: "being worked + needs diag" },
          { label: "Sold", value: counts.get("sold") ?? 0, accent: "diag", sub: "closed" },
        ]} />
      ) : (
        <EmptyState title="No OCTANE units in this view" />
      )}
    </div>
  );
}
