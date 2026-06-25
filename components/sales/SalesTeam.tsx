"use client";

import { useEffect, useMemo, useState } from "react";
import type { SalesSummary, SalesRep, SoldUnit, SaleBucket } from "@/lib/types";
import { cn, fmt, fmtMoney } from "@/lib/format";
import { locationBucket } from "@/lib/location";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { EmptyState } from "../states/States";
import { ChartPanel } from "../viz/ChartPanel";
import { AXIS, GRID, ChartTip } from "../viz/chartTheme";
import { Pager } from "../ui/Pager";
import { SalesAI } from "./SalesAI";

type SortKey = "unitsSold" | "totalSale" | "avgSale" | "emailsSent" | "unsignedDocs" | "name" | "location";
const PAGE = 25;

export function SalesTeam({ summary, locationFilter = "ALL" }: { summary: SalesSummary; locationFilter?: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("unitsSold");
  const [asc, setAsc] = useState(false);
  const [openRep, setOpenRep] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  // Snap to page 1 whenever the sort or search changes underfoot.
  useEffect(() => setPage(0), [sortKey, asc, q]);

  // Location tabs (owner ask): scope the team to one yard by each rep's home
  // department (DENVER SALES -> Denver, etc.). Round-robin + lead sources stay
  // company-wide — they're queue/source totals, not per-rep — so the panels that
  // receive `view` simply get the unchanged values via the spread.
  const scoped = locationFilter !== "ALL";
  const view: SalesSummary = useMemo(() => {
    if (!scoped) return summary;
    const reps = summary.reps.filter((r) => locationBucket(r.location) === locationFilter);
    const names = new Set(reps.map((r) => r.name));
    const soldUnitsByRep: Record<string, SoldUnit[]> = {};
    for (const [n, list] of Object.entries(summary.soldUnitsByRep)) if (names.has(n)) soldUnitsByRep[n] = list;
    const unsignedWorklist = summary.unsignedWorklist.filter((u) => u.rep != null && names.has(u.rep));
    return {
      ...summary,
      reps,
      soldUnitsByRep,
      unsignedWorklist,
      unsignedCount: unsignedWorklist.length,
      totalSold: reps.reduce((s, r) => s + r.unitsSold, 0),
      totalEmails: reps.reduce((s, r) => s + (r.emailsSent ?? 0), 0),
    };
  }, [summary, scoped, locationFilter]);

  const activeReps = view.reps.filter((r) => r.unitsSold > 0).length;
  const totalSaleVal = view.reps.reduce((s, r) => s + (r.totalSale ?? 0), 0);
  const avgSale = view.totalSold > 0 ? Math.round(totalSaleVal / view.totalSold) : null;
  const allSold = useMemo(() => Object.values(view.soldUnitsByRep).flat(), [view.soldUnitsByRep]);
  const signedDeals = allSold.filter((u) => u.signed).length;
  const signRate = allSold.length ? Math.round((signedDeals / allSold.length) * 100) : 0;

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = needle
      ? view.reps.filter((r) => `${r.name} ${r.location ?? ""}`.toLowerCase().includes(needle))
      : view.reps;
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
      if (sortKey === "location") {
        const al = a.location ?? "", bl = b.location ?? "";
        if (!al !== !bl) return al ? -1 : 1; // reps with no location always sink to the bottom
        return (al.localeCompare(bl) * dir) || (b.unitsSold - a.unitsSold);
      }
      return ((num(a[sortKey] as number | null) - num(b[sortKey] as number | null)) * dir) || (b.unitsSold - a.unitsSold);
    });
  }, [view.reps, sortKey, asc, q]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "name" || k === "location"); }
  };

  if (view.reps.length === 0 && view.totalSold === 0) {
    return (
      <EmptyState
        title={scoped ? `No sales team in ${locationFilter}` : "No sales data found"}
        hint={
          scoped
            ? "No reps are based in this yard. Switch the location filter to ALL to see the whole team."
            : "This export didn't yield a 'sold by' column or a staff roster to attribute sales."
        }
      />
    );
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = sorted.slice(start, start + PAGE);

  return (
    <div className="fade-up lg:grid lg:grid-cols-[252px_minmax(0,1fr)] lg:gap-5">
      {/* Main column (first in DOM → on top on mobile, right rail on desktop) */}
      <div className="min-w-0 space-y-5 lg:col-start-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="eyebrow text-brand">Sales Team</p>
            <h1 className="mt-1 text-xl font-bold text-ink">Who&apos;s closing — and what&apos;s still open</h1>
          </div>
          <span className="text-[13px] text-ink-faint">
            {scoped ? `${locationFilter} · reps based in this yard` : "all yards"}
          </span>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Card label="Total Sold" value={fmt(view.totalSold)} accent="text-diag" sub="Attributed units" />
          <Card label="Reps Active" value={fmt(activeReps)} accent="text-ink" sub={`${view.reps.length} on team`} />
          <Card label="Unsigned Docs" value={fmt(view.unsignedCount)} accent="text-working" sub="Real open deals" />
          <Card label="Avg Sale" value={fmtMoney(avgSale)} accent="text-ready" sub="Per unit" />
          <Card label="Total Sales $" value={fmtMoney(totalSaleVal || null)} accent="text-pif" sub="Attributed" />
          <Card
            label="Emails Sent"
            value={view.emailsAvailable ? fmt(view.totalEmails) : "—"}
            accent="text-rent"
            sub={view.emailsAvailable ? "Outreach (proxy)" : "Not in file"}
          />
        </div>

        {/* Opt-in AI analyzer — directly beneath the KPI cards */}
        <SalesAI
          summary={view}
          activeReps={activeReps}
          totalSaleVal={totalSaleVal}
          avgSale={avgSale}
          signed={signedDeals}
          totalDeals={allSold.length}
          signRate={signRate}
        />

        {/* Engaging visuals */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2"><SalesRace reps={view.reps} /></div>
          <DealHealth units={allSold} />
        </div>

        {/* Emails vs units per rep */}
        <EmailsChart summary={view} />

        {/* Leaderboard (25 / page) */}
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <p className="eyebrow">Sales Team — Leaderboard</p>
            <div className="relative w-full sm:w-56">
              <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">⌕</span>
              <input
                aria-label="Search reps"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search rep or location…"
                className="w-full border border-line bg-panel-2 py-1.5 pl-7 pr-7 text-[13px] text-ink placeholder:text-ink-dim focus:border-brand"
              />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint hover:text-ink">✕</button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-fixed text-left text-[13px]">
              <colgroup>
                <col style={{ width: "200px" }} />
                <col style={{ width: "130px" }} />
                <col style={{ width: "90px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "110px" }} />
                <col style={{ width: "100px" }} />
                <col style={{ width: "110px" }} />
              </colgroup>
              <thead>
                <tr className="border-y border-line text-ink-dim">
                  <Th label="Rep" k="name" cur={sortKey} asc={asc} onSort={setSort} />
                  <Th label="Location" k="location" cur={sortKey} asc={asc} onSort={setSort} />
                  <Th label="Units" k="unitsSold" cur={sortKey} asc={asc} onSort={setSort} num />
                  <Th label="Total $" k="totalSale" cur={sortKey} asc={asc} onSort={setSort} num />
                  <Th label="Avg $" k="avgSale" cur={sortKey} asc={asc} onSort={setSort} num />
                  <Th label="Emails" k="emailsSent" cur={sortKey} asc={asc} onSort={setSort} num />
                  <Th label="Unsigned" k="unsignedDocs" cur={sortKey} asc={asc} onSort={setSort} num />
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-[12px] text-ink-faint">
                    No reps match {q ? <span className="text-ink">“{q}”</span> : "this filter"}.
                  </td></tr>
                ) : (
                  shown.map((r) => (
                    <RepRow
                      key={r.name}
                      rep={r}
                      open={openRep === r.name}
                      units={view.soldUnitsByRep[r.name] ?? []}
                      emailsAvailable={view.emailsAvailable}
                      onToggle={() => setOpenRep(openRep === r.name ? null : r.name)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pager page={clampedPage} pageCount={pageCount} start={start} shown={shown.length} total={sorted.length} onPage={setPage} />
        </section>

        {/* Round robin + lead sources */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <RoundRobinPanel summary={view} />
          <LeadSourcesPanel summary={view} />
        </div>

        {/* Unsigned worklist */}
        <UnsignedPanel units={view.unsignedWorklist} />

        {view.notes.length > 0 && (
          <div className="card border-line p-3">
            {view.notes.map((n, i) => (
              <p key={i} className="text-[13px] text-ink-faint">· {n}</p>
            ))}
          </div>
        )}
      </div>

      {/* Roster rail (left on desktop) */}
      <RosterSidebar reps={view.reps} selected={selected} onSelect={setSelected} />
    </div>
  );
}

function num(v: number | null): number {
  return v ?? 0;
}

/** Left rail listing the whole team; click a name → contact card. */
function RosterSidebar({ reps, selected, onSelect }:
  { reps: SalesRep[]; selected: string | null; onSelect: (n: string | null) => void }) {
  const roster = useMemo(() => [...reps].sort((a, b) => a.name.localeCompare(b.name)), [reps]);
  const sel = selected ? reps.find((r) => r.name === selected) ?? null : null;
  return (
    <aside className="mb-5 lg:col-start-1 lg:row-start-1 lg:mb-0 lg:sticky lg:top-4 lg:self-start">
      <div className="card p-3">
        <p className="eyebrow mb-2">Roster <span className="text-ink-faint">· {reps.length}</span></p>
        {sel && <RosterCard rep={sel} onClose={() => onSelect(null)} />}
        <div className={cn("space-y-0.5 overflow-y-auto pr-1", sel ? "max-h-[34vh]" : "max-h-[64vh]")}>
          {roster.map((r) => {
            const active = r.name === selected;
            return (
              <button
                key={r.name}
                onClick={() => onSelect(active ? null : r.name)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors",
                  active ? "bg-brand/10 text-ink" : "text-ink-dim hover:bg-panel-2 hover:text-ink"
                )}
              >
                <span className="truncate">{r.name}</span>
                <span className="shrink-0 tabular-nums text-ink-faint">{r.unitsSold || 0}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function RosterCard({ rep, onClose }: { rep: SalesRep; onClose: () => void }) {
  return (
    <div className="mb-2 border border-line bg-panel-2/50 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{rep.name}</p>
          {rep.title && <p className="truncate text-[12px] text-ink-faint">{rep.title}</p>}
        </div>
        <button onClick={onClose} aria-label="Close" className="shrink-0 text-[13px] text-ink-faint hover:text-ink">✕</button>
      </div>
      <dl className="mt-2.5 space-y-1.5 text-[13px]">
        <ContactRow k="Email" v={rep.email} href={rep.email ? `mailto:${rep.email}` : null} />
        <ContactRow k="Phone" v={rep.phone} />
        <ContactRow k="Location" v={rep.location} />
        <ContactRow k="Units sold" v={fmt(rep.unitsSold || 0)} />
        <ContactRow k="Total $" v={rep.totalSale != null ? fmtMoney(rep.totalSale) : null} />
      </dl>
    </div>
  );
}

function ContactRow({ k, v, href }: { k: string; v: string | null; href?: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line/30 pb-1">
      <dt className="shrink-0 text-ink-faint">{k}</dt>
      <dd className="min-w-0 truncate text-right text-ink-dim" title={v ?? undefined}>
        {v ? (href ? <a href={href} className="text-brand hover:underline">{v}</a> : v) : <span className="text-ink-faint">—</span>}
      </dd>
    </div>
  );
}

/**
 * Per-rep email volume vs units sold. Emails dwarf unit counts by ~2 orders of
 * magnitude, so they ride a dual axis — bars (left) for emails, a line (right)
 * for closes — which keeps both honestly visible. No pie, per house rules.
 */
function EmailsChart({ summary }: { summary: SalesSummary }) {
  const data = useMemo(
    () =>
      [...summary.reps]
        .filter((r) => (r.emailsSent ?? 0) > 0)
        .sort((a, b) => (b.emailsSent ?? 0) - (a.emailsSent ?? 0))
        .slice(0, 12)
        .map((r) => ({ name: r.name, "Emails sent": r.emailsSent ?? 0, "Units sold": r.unitsSold })),
    [summary.reps]
  );
  if (!summary.emailsAvailable || data.length === 0) return null;
  const ariaLabel = `Combination chart, outreach versus closes, top 12 reps by email volume. Per rep, emails sent then units sold: ${data
    .map((d) => `${d.name}, ${d["Emails sent"]} emails, ${d["Units sold"]} sold`)
    .join("; ")}.`;
  return (
    <ChartPanel title="Outreach vs Closes" hint="emails sent (bars) vs units sold (line) · top 12 by email volume" height={300} ariaLabel={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 58, left: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="name" stroke={AXIS} fontSize={11} tickLine={false} interval={0} angle={-30} textAnchor="end" height={66} />
          <YAxis yAxisId="emails" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
          <YAxis yAxisId="units" orientation="right" stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Legend wrapperStyle={{ fontSize: 11, color: AXIS }} iconType="square" iconSize={9} />
          <Bar yAxisId="emails" dataKey="Emails sent" fill="#3aa0ff" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          <Line yAxisId="units" dataKey="Units sold" stroke="#ff8a3d" strokeWidth={2} dot={{ r: 3, fill: "#ff8a3d" }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartPanel>
  );
}

/** A horizontal "race" of the top reps by units sold — the page's hero visual. */
function SalesRace({ reps }: { reps: SalesRep[] }) {
  const ranked = [...reps].filter((r) => r.unitsSold > 0).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10);
  const max = ranked[0]?.unitsSold ?? 1;
  if (ranked.length === 0) {
    return (
      <section className="card p-4">
        <p className="eyebrow">Sales Race</p>
        <p className="mt-3 text-[13px] text-ink-faint">No attributed units to race yet.</p>
      </section>
    );
  }
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Sales Race — Units Sold</p>
        <span className="text-[12px] text-ink-faint">top {ranked.length} reps</span>
      </div>
      <div className="mt-3 space-y-2">
        {ranked.map((r, i) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className={cn(
              "w-6 shrink-0 text-center text-[13px] tabular-nums",
              i === 0 ? "font-bold text-brand" : i < 3 ? "text-ink" : "text-ink-faint"
            )}>
              {i + 1}
            </span>
            <span className="w-24 shrink-0 truncate text-[13px] text-ink-dim sm:w-36" title={r.name}>{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-panel-2">
              <div
                className={cn("h-full rounded-sm transition-[width] duration-700", i === 0 ? "bg-brand" : "bg-rent")}
                style={{ width: `${(r.unitsSold / max) * 100}%`, opacity: i === 0 ? 1 : 0.8 }}
              />
            </div>
            <span className="w-9 shrink-0 text-right font-display text-base leading-none tabular-nums text-ink">{r.unitsSold}</span>
            <span className="hidden w-20 shrink-0 text-right text-[13px] tabular-nums text-pif sm:inline">{fmtMoney(r.totalSale)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const PAY: { key: SaleBucket; label: string; cls: string }[] = [
  { key: "paid_in_full", label: "Paid in full", cls: "bg-pif" },
  { key: "down_payment", label: "Down pmt", cls: "bg-downpmt" },
  { key: "govt_po", label: "Govt PO", cls: "bg-govt" },
  { key: "other", label: "Other", cls: "bg-ink-faint" },
];

/** Signature rate + payment mix — "how healthy is the close." */
function DealHealth({ units }: { units: SoldUnit[] }) {
  const total = units.length;
  const signed = units.filter((u) => u.signed).length;
  const signRate = total ? Math.round((signed / total) * 100) : 0;
  const counts = new Map<SaleBucket, number>();
  for (const u of units) counts.set(u.saleType, (counts.get(u.saleType) ?? 0) + 1);
  const payTotal = PAY.reduce((s, p) => s + (counts.get(p.key) ?? 0), 0) || 1;

  return (
    <section className="card p-4">
      <p className="eyebrow">Deal Close Health</p>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-ink-dim">Signature rate</span>
          <span className="font-display text-2xl leading-none tabular-nums text-ready">{signRate}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-panel-2">
          <div className="h-full bg-ready transition-[width] duration-700" style={{ width: `${signRate}%` }} />
        </div>
        <p className="mt-1 text-[12px] text-ink-faint">{fmt(signed)} of {fmt(total)} attributed deals signed</p>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[13px] text-ink-dim">Payment mix</p>
        <div className="flex h-2.5 overflow-hidden rounded-sm bg-panel-2">
          {PAY.map((p) => {
            const v = counts.get(p.key) ?? 0;
            if (!v) return null;
            return <div key={p.key} className={p.cls} style={{ width: `${(v / payTotal) * 100}%` }} title={`${p.label}: ${v}`} />;
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {PAY.map((p) => {
            const v = counts.get(p.key) ?? 0;
            if (!v) return null;
            return (
              <span key={p.key} className="flex items-center gap-1 text-[12px]">
                <span className={cn("inline-block h-2 w-2 rounded-sm", p.cls)} />
                <span className="text-ink-dim">{p.label}</span>
                <span className="tabular-nums text-ink-faint">{v}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Card({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  return (
    <div className="card card-hover p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-2 font-display text-4xl leading-none tabular-nums", accent)}>{value}</p>
      <p className="mt-2 text-[13px] text-ink-faint">{sub}</p>
    </div>
  );
}

function Th<K extends string>({ label, k, cur, asc, onSort, num: isNum }:
  { label: string; k: K; cur: K; asc: boolean; onSort: (k: K) => void; num?: boolean }) {
  const active = cur === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
      className={cn("select-none px-4 py-2 font-normal", isNum ? "text-right" : "text-left", active && "text-ink")}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn(
          "inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand",
          isNum ? "flex-row-reverse" : ""
        )}
      >
        <span className="align-middle">
          {label}
          <span className="sr-only">
            {active ? `, sorted ${asc ? "ascending" : "descending"}` : ", sortable"}
          </span>
        </span>
        <span aria-hidden="true" className={cn("inline-block w-2.5 text-center align-middle", active ? "text-brand" : "text-ink-faint")}>
          {active ? (asc ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function RepRow({ rep, open, units, emailsAvailable, onToggle }:
  { rep: SalesRep; open: boolean; units: SoldUnit[]; emailsAvailable: boolean; onToggle: () => void }) {
  const detailId = `rep-detail-${rep.name.replace(/\s+/g, "-")}`;
  return (
    <>
      <tr className={cn("border-b border-line/50 hover:bg-panel-2", open && "bg-panel-2")}>
        <td className="truncate p-0 font-bold text-ink">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={detailId}
            className="flex w-full cursor-pointer items-center px-4 py-2 text-left font-bold text-ink"
          >
            <span className="mr-1 text-ink-faint" aria-hidden="true">{open ? "▾" : "▸"}</span>{rep.name}
          </button>
        </td>
        <td className="truncate px-4 py-2 text-ink-dim">{rep.location ?? "—"}</td>
        <td className="whitespace-nowrap px-4 py-2 text-right font-bold tabular-nums text-ink">{rep.unitsSold || "—"}</td>
        <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-pif">{fmtMoney(rep.totalSale)}</td>
        <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-ink-dim">{fmtMoney(rep.avgSale)}</td>
        <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-rent">{emailsAvailable ? fmt(rep.emailsSent) : "—"}</td>
        <td className="px-4 py-2 text-right">
          {rep.unsignedDocs > 0 ? (
            <span className="bg-working/15 px-2 py-0.5 font-bold tabular-nums text-working">{rep.unsignedDocs}</span>
          ) : (
            <span className="text-ink-faint">0</span>
          )}
        </td>
      </tr>
      {open && (
        <tr id={detailId} className="border-b border-line/50">
          <td colSpan={7} className="bg-ground/40 px-4 py-3">
            {units.length === 0 ? (
              <p className="text-[13px] text-ink-faint">No attributed units{rep.title ? ` · ${rep.title}` : ""}.</p>
            ) : (
              <div className="space-y-1">
                <p className="eyebrow mb-2">What {rep.name} sold ({units.length})</p>
                {units.slice(0, 30).map((u, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[13px]">
                    <span className="text-ink">{[u.make, u.model, u.type].filter(Boolean).join(" · ") || "Unit"}</span>
                    <span className="flex items-center gap-3">
                      <span className="text-ink-dim">{u.customer ?? ""}</span>
                      <SalePill raw={u.saleTypeRaw} />
                      <span className={cn("w-2 text-center", u.signed ? "text-ready" : "text-working")} title={u.signed ? "Signed" : "Unsigned"}>
                        {u.signed ? "✓" : "○"}
                      </span>
                      <span className="w-16 text-right tabular-nums text-pif">{fmtMoney(u.price)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function SalePill({ raw }: { raw: string | null }) {
  if (!raw) return null;
  const s = raw.toLowerCase();
  const cls = /paid in full|pif/.test(s) ? "text-pif border-pif/40"
    : /down/.test(s) ? "text-downpmt border-downpmt/40"
    : /govt|po/.test(s) ? "text-govt border-govt/40"
    : "text-ink-dim border-line";
  return <span className={cn("border px-1.5 py-0.5 text-[12px] uppercase", cls)}>{raw}</span>;
}

function RoundRobinPanel({ summary }: { summary: SalesSummary }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Round-Robin — Next Up</p>
        {summary.roundRobinAsOf && (
          <span className="text-[12px] text-ink-faint">as of {summary.roundRobinAsOf}</span>
        )}
      </div>
      {summary.roundRobin.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">No round-robin queue data in this export.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {summary.roundRobin.map((q) => (
            <div key={q.queue} className="flex items-center justify-between border-b border-line/40 pb-1.5 text-[13px]">
              <span className="text-ink-dim">{q.queue}</span>
              <span className="font-bold text-ink">{q.assignee ?? "—"}</span>
            </div>
          ))}
          <p className="pt-1 text-[12px] text-ink-faint">Live pointer per queue — not a lead-distribution history.</p>
        </div>
      )}
    </section>
  );
}

function LeadSourcesPanel({ summary }: { summary: SalesSummary }) {
  const max = summary.leadSources[0]?.count ?? 1;
  return (
    <section className="card p-4">
      <p className="eyebrow">Lead Sources</p>
      {summary.leadSources.length === 0 ? (
        <p className="mt-3 text-[13px] text-ink-faint">No lead-source column detected.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {summary.leadSources.map((l) => (
            <div key={l.source}>
              <div className="flex items-center justify-between text-[13px]">
                <span className="truncate text-ink-dim" title={l.source}>{l.source}</span>
                <span className="tabular-nums text-ink">{fmt(l.count)}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-sm bg-panel-2">
                <div className="h-full bg-rent" style={{ width: `${(l.count / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const isUnattributed = (rep: string | null | undefined) => !rep || /unattributed/i.test(rep);
type UnsignedSortKey = "unit" | "rep" | "sale" | "price";
const unitLabel = (u: SoldUnit) => [u.make, u.model, u.type].filter(Boolean).join(" · ") || "Unit";

function UnsignedPanel({ units }: { units: SoldUnit[] }) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<UnsignedSortKey>("price");
  const [asc, setAsc] = useState(false);
  useEffect(() => setPage(0), [sortKey, asc]);

  // "(unattributed)" deals are hidden entirely — only chase deals tied to a rep.
  const attributed = useMemo(() => units.filter((u) => !isUnattributed(u.rep)), [units]);
  const sorted = useMemo(() => {
    const dir = asc ? 1 : -1;
    return [...attributed].sort((a, b) => {
      switch (sortKey) {
        case "unit": return unitLabel(a).localeCompare(unitLabel(b)) * dir;
        case "rep": return (a.rep ?? "").localeCompare(b.rep ?? "") * dir;
        case "sale": return (a.saleTypeRaw ?? "").localeCompare(b.saleTypeRaw ?? "") * dir;
        default: return ((a.price ?? 0) - (b.price ?? 0)) * dir;
      }
    });
  }, [attributed, sortKey, asc]);

  if (attributed.length === 0) return null;

  const setSort = (k: UnsignedSortKey) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k !== "price"); } // text cols asc, price desc by default
  };
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = sorted.slice(start, start + PAGE);

  return (
    <section className="card overflow-hidden border-working/30">
      <div className="px-4 pt-4">
        <p className="eyebrow text-working">Unsigned PandaDocs — Chase These ({attributed.length})</p>
        <p className="mt-1 text-[13px] text-ink-faint">Committed deals (down-payment / paid-in-full) with no signature on file. Govt POs, removed, and unattributed deals excluded.</p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <thead>
            <tr className="border-y border-line text-ink-dim">
              <Th label="Unit" k="unit" cur={sortKey} asc={asc} onSort={setSort} />
              <Th label="Rep" k="rep" cur={sortKey} asc={asc} onSort={setSort} />
              <Th label="Sale" k="sale" cur={sortKey} asc={asc} onSort={setSort} />
              <Th label="Price" k="price" cur={sortKey} asc={asc} onSort={setSort} num />
            </tr>
          </thead>
          <tbody>
            {shown.map((u, i) => (
              <tr key={start + i} className="border-b border-line/40 hover:bg-panel-2">
                <td className="px-4 py-2 text-ink">{unitLabel(u)}</td>
                <td className="truncate px-4 py-2 text-ink-dim">{u.rep}</td>
                <td className="px-4 py-2"><SalePill raw={u.saleTypeRaw} /></td>
                <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-pif">{fmtMoney(u.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {attributed.length > PAGE && (
        <Pager page={clampedPage} pageCount={pageCount} start={start} shown={shown.length} total={sorted.length} onPage={setPage} />
      )}
    </section>
  );
}
