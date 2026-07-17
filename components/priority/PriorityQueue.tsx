"use client";

import { useMemo, useState, type ReactNode } from "react";
import type { ScoringResult, ScoredUnit, PriorityTier, UnitRecord } from "@/lib/types";
import { cn, fmt, fmtMoney } from "@/lib/format";
import { WorkPill, SalePill, TierPill } from "@/components/ui/Pills";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { UnitsDrawer } from "@/components/overview/UnitsDrawer";
import { UnitDetail } from "@/components/units/UnitDetail";
import { unitTitle } from "@/components/tabs/shared";
import { TIER_LABEL } from "@/lib/buckets";
import { EmptyState } from "@/components/states/States";

const TIERS: PriorityTier[] = ["act_now", "high", "medium", "low"];

/** Everything a unit can be matched on in the search box. */
function unitHaystack(u: UnitRecord): string {
  return [u.forkliftName, u.name, u.serial, u.serial4, u.make, u.model, u.type, u.year, u.fuel, u.customer, u.location, u.soldBy]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function PriorityQueue({ scoring }: { scoring: ScoringResult }) {
  const [tier, setTier] = useState<PriorityTier | "ALL">("ALL");
  const [drill, setDrill] = useState<{ title: string; units: UnitRecord[] } | null>(null);

  // Stable 1-based rank per scored unit (the ranked order, before any column sort).
  const rankOf = useMemo(() => {
    const m = new Map<ScoredUnit, number>();
    scoring.ranked.forEach((s, i) => m.set(s, i + 1));
    return m;
  }, [scoring.ranked]);

  const rows = useMemo(
    () => (tier === "ALL" ? scoring.ranked : scoring.ranked.filter((r) => r.tier === tier)),
    [scoring.ranked, tier],
  );

  const columns = useMemo<Column<ScoredUnit>[]>(() => [
    { key: "rank", header: "#", numeric: true, sortValue: (s) => rankOf.get(s) ?? 0, render: (s) => <span className="tabular-nums text-ink-faint">#{rankOf.get(s) ?? 0}</span>, printValue: (s) => String(rankOf.get(s) ?? 0) },
    {
      key: "unit", header: "Unit", sortValue: (s) => unitTitle(s.unit),
      render: (s) => (
        <div className="min-w-0">
          <div className="truncate font-bold text-ink">{unitTitle(s.unit)}</div>
          <div className="truncate text-[12px] text-ink-dim">{s.action}</div>
        </div>
      ),
      printValue: (s) => unitTitle(s.unit),
    },
    { key: "tier", header: "Tier", sortValue: (s) => TIERS.indexOf(s.tier), render: (s) => <TierPill tier={s.tier} />, printValue: (s) => TIER_LABEL[s.tier] },
    { key: "location", header: "Location", sortValue: (s) => s.unit.location ?? "", render: (s) => <span className="text-ink-dim">{s.unit.location ?? "—"}</span> },
    { key: "stage", header: "Stage", sortValue: (s) => s.unit.work, render: (s) => <WorkPill work={s.unit.work} /> },
    { key: "sale", header: "Sale", sortValue: (s) => s.unit.sale, render: (s) => <SalePill sale={s.unit.sale} /> },
    { key: "price", header: "Price", numeric: true, sortValue: (s) => s.unit.price ?? -Infinity, render: (s) => <span className="tabular-nums text-pif">{s.unit.price != null ? fmtMoney(s.unit.price) : "—"}</span>, printValue: (s) => (s.unit.price != null ? String(s.unit.price) : "") },
    { key: "score", header: "Score", numeric: true, sortValue: (s) => s.score, render: (s) => <span className="font-display text-lg leading-none tabular-nums text-ink">{s.score}</span>, printValue: (s) => String(s.score) },
  ], [rankOf]);

  if (scoring.ranked.length === 0) {
    return (
      <EmptyState
        title="Nothing in the priority queue"
        hint="No unit has open work or a committed-but-unfinished signal. Either the fleet is caught up, or the work-stage / sale-type columns weren't mapped."
      />
    );
  }

  const tierUnits = (t: PriorityTier | "ALL"): UnitRecord[] =>
    (t === "ALL" ? scoring.ranked : scoring.ranked.filter((s) => s.tier === t)).map((s) => s.unit);
  const openTier = (label: string, t: PriorityTier | "ALL") => setDrill({ title: label, units: tierUnits(t) });

  return (
    <div className="space-y-5 fade-up">
      {scoring.tierCounts.act_now > 0 && (
        <button
          type="button"
          onClick={() => openTier("Act Now — committed but unfinished", "act_now")}
          className="card card-hover group block w-full border-l-2 border-l-brand bg-brand/5 px-4 py-3 text-left transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-brand">
            <span aria-hidden="true">⚠</span>{fmt(scoring.tierCounts.act_now)} units need action now
            <span aria-hidden="true" className="ml-auto text-ink-dim transition-colors group-hover:text-brand">→</span>
          </p>
          <p className="mt-1 text-[13px] text-ink-dim">
            Committed-but-unfinished units lead the queue — a customer has paid or committed and the unit isn&apos;t deliverable. These go first.
          </p>
        </button>
      )}

      {/* Clickable tier KPIs — each pulls up the table of its units, like every
          other KPI card in the app. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="In Queue" value={fmt(scoring.scoredCount)} accent="text-ink" sub={`of ${fmt(scoring.totalUnits)} units`} onClick={() => openTier("Priority Queue — all ranked units", "ALL")} />
        {TIERS.map((t) => (
          <SummaryCard
            key={t}
            label={TIER_LABEL[t]}
            value={fmt(scoring.tierCounts[t])}
            accent={tierAccent(t)}
            sub="units"
            onClick={() => openTier(t === "act_now" ? "Act Now — committed but unfinished" : `${TIER_LABEL[t]} — priority units`, t)}
            disabled={scoring.tierCounts[t] === 0}
          />
        ))}
      </div>

      {/* Tier filter for the ranked table below */}
      <div className="flex flex-wrap items-center gap-1">
        <FilterChip active={tier === "ALL"} onClick={() => setTier("ALL")}>All ({fmt(scoring.scoredCount)})</FilterChip>
        {TIERS.map((t) => (
          <FilterChip key={t} active={tier === t} onClick={() => setTier(t)}>
            {TIER_LABEL[t]} ({fmt(scoring.tierCounts[t])})
          </FilterChip>
        ))}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="eyebrow">Priority Queue — Ranked</p>
          <p className="text-[13px] text-ink-faint">sort any column · expand a row for its score breakdown &amp; specs</p>
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(s) => String(s.unit.rowIndex)}
          initialSort={{ key: "rank", asc: true }}
          searchText={(s) => unitHaystack(s.unit)}
          searchPlaceholder="Search name, serial, make, customer…"
          minWidth={1000}
          printTitle="Priority Queue"
          printSubtitle={tier === "ALL" ? "All tiers" : TIER_LABEL[tier]}
          expandable={(s) => <ScoreDetail scored={s} />}
          emptyLabel="No units in this tier."
        />
      </div>

      {drill && <UnitsDrawer title={drill.title} units={drill.units} onClose={() => setDrill(null)} />}
    </div>
  );
}

/** The expanded row: the deterministic score breakdown + the canonical unit detail. */
function ScoreDetail({ scored }: { scored: ScoredUnit }) {
  const rawSum = scored.factors.reduce((s, f) => s + f.points, 0);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div>
        <p className="eyebrow mb-2">How this score was built</p>
        <div className="space-y-1.5">
          {scored.factors.map((f) => (
            <div key={f.key} className="flex items-start justify-between gap-3 text-[13px]">
              <div>
                <span className="text-ink">{f.label}</span>
                <p className="text-ink-faint">{f.detail}</p>
              </div>
              <span className="shrink-0 font-bold tabular-nums text-ready">+{f.points}</span>
            </div>
          ))}
          {rawSum > scored.score && (
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-ink-faint">Capped at 100</span>
              <span className="tabular-nums text-ink-faint">−{rawSum - scored.score}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-line/50 pt-1.5 text-[13px]">
            <span className="font-bold text-ink">Total</span>
            <span className="font-bold tabular-nums text-ink">{scored.score}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="eyebrow mb-2">Unit</p>
        <UnitDetail u={scored.unit} />
      </div>
    </div>
  );
}

function tierAccent(t: PriorityTier): string {
  return t === "act_now" ? "text-brand" : t === "high" ? "text-diag" : t === "medium" ? "text-working" : "text-ink-dim";
}

function SummaryCard({ label, value, accent, sub, onClick, disabled }:
  { label: string; value: string; accent: string; sub: string; onClick: () => void; disabled?: boolean }) {
  if (disabled) {
    return (
      <div className="card p-4 opacity-60">
        <p className="eyebrow">{label}</p>
        <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums", accent)}>{value}</p>
        <p className="mt-2 text-[13px] text-ink-faint">{sub}</p>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      title={`View the ${label} units`}
      className="card card-hover group w-full p-4 text-left transition-colors hover:border-brand/60 focus:border-brand focus-visible:outline-none"
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <span aria-hidden="true" className="text-ink-dim transition-colors group-hover:text-brand">→</span>
      </div>
      <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums", accent)}>{value}</p>
      <p className="mt-2 text-[13px] text-ink-faint">{sub}</p>
    </button>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-2.5 py-1.5 text-[13px] uppercase tracking-wider transition-colors",
        active ? "border-brand bg-brand/10 text-ink" : "border-line text-ink-dim hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
