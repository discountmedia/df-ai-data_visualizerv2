"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScoringResult, ScoredUnit, PriorityTier, UnitRecord } from "@/lib/types";
import { cn, fmt, fmtMoney } from "@/lib/format";
import { WorkPill, SalePill, TierPill } from "@/components/ui/Pills";
import { Pager } from "@/components/ui/Pager";
import { TIER_LABEL } from "@/lib/buckets";
import { EmptyState } from "@/components/states/States";

const TIERS: PriorityTier[] = ["act_now", "high", "medium", "low"];
const PAGE = 25;

/** Everything a unit can be matched on in the search box. */
function unitHaystack(u: UnitRecord): string {
  return [u.forkliftName, u.name, u.serial, u.serial4, u.make, u.model, u.type, u.year, u.fuel, u.customer, u.location, u.soldBy]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function PriorityQueue({ scoring }: { scoring: ScoringResult }) {
  const [tier, setTier] = useState<PriorityTier | "ALL">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const rankOf = useMemo(() => {
    const m = new Map<ScoredUnit, number>();
    scoring.ranked.forEach((s, i) => m.set(s, i + 1));
    return m;
  }, [scoring.ranked]);

  const rows = useMemo(() => {
    let rs = tier === "ALL" ? scoring.ranked : scoring.ranked.filter((r) => r.tier === tier);
    const needle = q.trim().toLowerCase();
    if (needle) rs = rs.filter((s) => unitHaystack(s.unit).includes(needle));
    return rs;
  }, [scoring.ranked, tier, q]);

  // Snap back to page 1 whenever the result set changes underfoot.
  useEffect(() => setPage(0), [tier, q]);

  if (scoring.ranked.length === 0) {
    return (
      <EmptyState
        title="Nothing in the priority queue"
        hint="No unit has open work or a committed-but-unfinished signal. Either the fleet is caught up, or the work-stage / sale-type columns weren't mapped in schema review."
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = rows.slice(start, start + PAGE);

  return (
    <div className="space-y-5 fade-up">
      {scoring.tierCounts.act_now > 0 && (
        <div className="card border-l-2 border-l-brand bg-brand/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-bold text-brand">
            <span>⚠</span>{fmt(scoring.tierCounts.act_now)} units need action now
          </p>
          <p className="mt-1 text-xs text-ink-dim">
            Committed-but-unfinished units lead the queue — a customer has paid or committed and the unit isn&apos;t deliverable. These go first.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <SummaryCard label="In Queue" value={fmt(scoring.scoredCount)} accent="text-ink" sub={`of ${fmt(scoring.totalUnits)} units`} />
        {TIERS.map((t) => (
          <SummaryCard key={t} label={TIER_LABEL[t]} value={fmt(scoring.tierCounts[t])} accent={tierAccent(t)} sub="units" />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip active={tier === "ALL"} onClick={() => setTier("ALL")}>All ({fmt(scoring.scoredCount)})</FilterChip>
          {TIERS.map((t) => (
            <FilterChip key={t} active={tier === t} onClick={() => setTier(t)}>
              {TIER_LABEL[t]} ({fmt(scoring.tierCounts[t])})
            </FilterChip>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">⌕</span>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, serial, make, customer…"
            className="w-full border border-line bg-panel-2/60 py-1.5 pl-7 pr-7 text-xs text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="eyebrow">Act-Now Queue — Ranked</p>
          <p className="text-[11px] text-ink-faint">click a unit for its score breakdown & specs</p>
        </div>
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-[12px] text-ink-faint">
            No units match {q ? <span className="text-ink">“{q}”</span> : "this filter"}.
          </p>
        ) : (
          <div className="divide-y divide-line/50">
            {shown.map((s) => {
              // rowIndex is unique per base row; unit.id (serial/name) is not.
              const oid = String(s.unit.rowIndex);
              return (
                <PriorityRow
                  key={oid}
                  rank={rankOf.get(s) ?? 0}
                  scored={s}
                  open={open === oid}
                  onToggle={() => setOpen(open === oid ? null : oid)}
                />
              );
            })}
          </div>
        )}
        {rows.length > 0 && (
          <Pager
            page={clampedPage}
            pageCount={pageCount}
            start={start}
            shown={shown.length}
            total={rows.length}
            onPage={setPage}
          />
        )}
      </section>
    </div>
  );
}

function PriorityRow({ rank, scored, open, onToggle }:
  { rank: number; scored: ScoredUnit; open: boolean; onToggle: () => void }) {
  const u = scored.unit;
  // Lead with the forklift's given name, then year · make · type.
  const name = u.forkliftName ?? u.name;
  const spec = [u.year, u.make, u.type].filter(Boolean).join(" ");
  const title = name ? (spec ? `${name} · ${spec}` : name) : spec || "Unit";
  const rawSum = scored.factors.reduce((s, f) => s + f.points, 0);
  return (
    <div className={cn("cursor-pointer px-4 py-3 hover:bg-panel-2", open && "bg-panel-2")} onClick={onToggle}>
      <div className="flex items-center gap-3">
        <span className="w-8 shrink-0 text-right text-xs tabular-nums text-ink-faint">#{rank}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-ink-faint">{open ? "▾" : "▸"}</span>
            <span className="truncate text-sm font-bold text-ink" title={title}>{title}</span>
            <TierPill tier={scored.tier} />
          </div>
          <p className="mt-0.5 truncate text-[11px] text-ink-dim">{scored.action}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-2 sm:flex">
          {u.location && <span className="text-[11px] text-ink-faint">{u.location}</span>}
          <WorkPill work={u.work} />
          <SalePill sale={u.sale} />
        </div>
        <div className="w-14 shrink-0 text-right">
          <span className="font-display text-3xl leading-none tabular-nums text-ink">{scored.score}</span>
          <span className="block text-[9px] uppercase tracking-wide text-ink-faint">score</span>
        </div>
      </div>

      {open && (
        <div className="mt-3 border-t border-line/50 pt-3" onClick={(e) => e.stopPropagation()}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="eyebrow mb-2">How this score was built</p>
              <div className="space-y-1.5">
                {scored.factors.map((f) => (
                  <div key={f.key} className="flex items-start justify-between gap-3 text-[11px]">
                    <div>
                      <span className="text-ink">{f.label}</span>
                      <p className="text-ink-faint">{f.detail}</p>
                    </div>
                    <span className="shrink-0 tabular-nums font-bold text-ready">+{f.points}</span>
                  </div>
                ))}
                {rawSum > scored.score && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-ink-faint">Capped at 100</span>
                    <span className="tabular-nums text-ink-faint">−{rawSum - scored.score}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-line/50 pt-1.5 text-[11px]">
                  <span className="font-bold text-ink">Total</span>
                  <span className="tabular-nums font-bold text-ink">{scored.score}</span>
                </div>
              </div>
            </div>
            <div className="text-[11px] text-ink-dim">
              <p className="eyebrow mb-2">Unit</p>
              <Detail k="Serial (last 4)" v={u.serial4 ?? u.serial} />
              <Detail k="Year" v={u.year} />
              <Detail k="Fuel" v={u.fuel} />
              <Detail k="Location" v={u.location} />
              <Detail k="Customer" v={u.customer} />
              <Detail k="Sold by" v={u.soldBy} />
              <Detail k="Sale price" v={u.price != null ? fmtMoney(u.price) : null} />
              <Detail k="Signed" v={u.committed ? (u.signed ? "Yes" : "No") : null} />
            </div>
          </div>
          <UnitSpecsPanel u={u} />
        </div>
      )}
    </div>
  );
}

function UnitSpecsPanel({ u }: { u: UnitRecord }) {
  const s = u.specs;
  const measures = [
    { k: "Hours", v: s.hours },
    { k: "Capacity (lbs)", v: u.capacity != null ? u.capacity.toLocaleString() : null },
    { k: "Mast", v: s.mast },
    { k: "Fork length", v: s.forkLength },
    { k: "Lowered height", v: s.loweredHeight },
    { k: "Raised / max fork", v: s.raisedHeight },
    { k: "Tires / drive", v: s.tires },
    { k: "Attachments", v: s.attachments },
    { k: "Warehouse", v: s.warehouse },
  ].filter((m) => m.v);
  const links = [
    { k: "Product page", href: s.productUrl },
    { k: "Walk-around video", href: s.youtubeUrl },
  ].filter((l) => l.href && /^https?:\/\//i.test(l.href));

  if (measures.length === 0 && links.length === 0) return null;

  return (
    <div className="mt-3 border-t border-line/50 pt-3">
      <p className="eyebrow mb-2">Specs &amp; media</p>
      {measures.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          {measures.map((m) => (
            <div key={m.k} className="flex items-baseline justify-between gap-2 border-b border-line/30 py-1 text-[11px]">
              <span className="shrink-0 text-ink-faint">{m.k}</span>
              <span className="truncate text-right text-ink-dim" title={m.v!}>{m.v}</span>
            </div>
          ))}
        </div>
      )}
      {links.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.k}
              href={l.href!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-line px-2.5 py-1 text-[11px] text-brand transition-colors hover:border-brand"
            >
              {l.k} ↗
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string | null }) {
  if (!v) return null;
  return (
    <div className="flex items-center justify-between border-b border-line/30 py-1">
      <span className="text-ink-faint">{k}</span>
      <span className="text-ink-dim">{v}</span>
    </div>
  );
}

function tierAccent(t: PriorityTier): string {
  return t === "act_now" ? "text-brand" : t === "high" ? "text-diag" : t === "medium" ? "text-working" : "text-ink-dim";
}

function SummaryCard({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  return (
    <div className="card card-hover p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums", accent)}>{value}</p>
      <p className="mt-2 text-[11px] text-ink-faint">{sub}</p>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border px-2.5 py-1.5 text-[11px] uppercase tracking-wider transition-colors",
        active ? "border-brand text-ink" : "border-line text-ink-dim hover:text-ink"
      )}
    >
      {children}
    </button>
  );
}
