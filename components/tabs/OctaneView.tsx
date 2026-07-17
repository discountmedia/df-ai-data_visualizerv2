"use client";

import { useMemo, useState } from "react";
import type { UnitRecord, WorkBucket } from "@/lib/types";
import { StatCards } from "../viz/StatCards";
import { AiAnalysisCard } from "../insights/AiAnalysisCard";
import { EmptyState } from "../states/States";
import { UnitsDrawer } from "@/components/overview/UnitsDrawer";
import { scoreUnits } from "@/lib/score";
import { buildInsightsInput } from "@/lib/insightsClient";

/**
 * OCTANE is a separate part of the company — its team doesn't use this tool and
 * we rarely look at their numbers, so this is a deliberately bare view: a few
 * headline counts, nothing more. OCTANE is excluded from every DF metric.
 * Each card drills into the units behind it (same drawer the rest of the app
 * uses — listing links, click-to-copy, Print/PDF, salesman column all included).
 */
export function OctaneView({ units }: { units: UnitRecord[] }) {
  const [drill, setDrill] = useState<{ title: string; units: UnitRecord[] } | null>(null);
  const counts = useMemo(() => {
    const c = new Map<WorkBucket, number>();
    for (const u of units) c.set(u.work, (c.get(u.work) ?? 0) + 1);
    return c;
  }, [units]);
  const committed = useMemo(() => units.filter((u) => u.committed), [units]);
  const inService = useMemo(() => units.filter((u) => u.work === "working" || u.work === "needs_diagnosis"), [units]);
  const aiInput = useMemo(() => buildInsightsInput(scoreUnits(units), units, null), [units]);
  const open = (title: string, list: UnitRecord[]) => setDrill({ title, units: list });

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
        <>
          {/* Lifecycle order (total → in service → ready → on rent → committed →
              sold), matching the rest of the app so the fleet reads left-to-right. */}
          <StatCards cols={3} items={[
            { label: "OCTANE Units", value: units.length, accent: "ink", sub: "total inventory", onClick: () => open("OCTANE — All Units", units) },
            { label: "In Service", value: inService.length, accent: "working", sub: "being worked + needs diag", onClick: () => open("OCTANE — In Service", inService) },
            { label: "Ready", value: counts.get("ready") ?? 0, accent: "ready", sub: "prepped", onClick: () => open("OCTANE — Ready", units.filter((u) => u.work === "ready")) },
            { label: "On Rent", value: counts.get("on_rent") ?? 0, accent: "rent", sub: "generating income", onClick: () => open("OCTANE — On Rent", units.filter((u) => u.work === "on_rent")) },
            { label: "Committed", value: committed.length, accent: "pif", sub: "paid / deposit / PO", onClick: () => open("OCTANE — Committed", committed) },
            { label: "Sold", value: counts.get("sold") ?? 0, accent: "ink", sub: "closed", onClick: () => open("OCTANE — Sold", units.filter((u) => u.work === "sold")) },
          ]} />
          <AiAnalysisCard
            input={aiInput}
            blurb="AI analysis is off by default — click Run to have Claude read OCTANE's inventory (kept separate from DF) and surface anything notable."
          />
        </>
      ) : (
        <EmptyState title="No OCTANE units in this view" />
      )}
      {drill && <UnitsDrawer title={drill.title} units={drill.units} onClose={() => setDrill(null)} />}
    </div>
  );
}
