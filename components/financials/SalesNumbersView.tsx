"use client";

import { useEffect, useMemo, useState } from "react";
import type { FinancialSummary, FinancialUnit } from "@/lib/types";
import { cn, fmt, fmtMoney, fmtMoneyExact } from "@/lib/format";
import { ChartPanel } from "../viz/ChartPanel";
import { CategoryBars } from "../viz/CategoryBars";
import { Pager } from "../ui/Pager";
import { LoadingState, EmptyState } from "../states/States";

const PAGE = 25;
type SortKey = "gp" | "margin" | "soldPrice" | "cost" | "commission" | "make";

export function SalesNumbersView({ financials }: { financials?: FinancialSummary }) {
  const [sortKey, setSortKey] = useState<SortKey>("gp");
  const [asc, setAsc] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => setPage(0), [sortKey, asc, q]);

  const f = financials;
  const rows = useMemo(() => {
    if (!f) return [];
    const needle = q.trim().toLowerCase();
    const base = needle
      ? f.units.filter((u) => `${u.serial4 ?? ""} ${u.make ?? ""} ${u.type ?? ""} ${u.location ?? ""}`.toLowerCase().includes(needle))
      : f.units;
    const dir = asc ? 1 : -1;
    return [...base].sort((a, b) => {
      if (sortKey === "make") return (a.make ?? "").localeCompare(b.make ?? "") * dir;
      return ((a[sortKey] ?? -Infinity) - (b[sortKey] ?? -Infinity)) * dir;
    });
  }, [f, q, sortKey, asc]);

  if (!f) return <LoadingState label="Loading financials…" />;
  if (!f.available) {
    return <EmptyState title="No financial data" hint="The fullnew export didn't yield gross-profit columns (sold price, cost, GP)." />;
  }

  const setSort = (k: SortKey) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "make"); }
  };

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * PAGE;
  const shown = rows.slice(start, start + PAGE);

  const yearData = f.byYear.map((b) => ({ name: b.label, "Gross profit": Math.round(b.gp) }));
  const yardData = f.byYard.map((b) => ({ name: b.label, "Gross profit": Math.round(b.gp) }));
  const distData = f.gpDistribution.map((d) => ({ name: d.label, Units: d.count }));

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-brand">Financials</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Sales numbers &amp; gross profit</h1>
        </div>
        <span className="text-[11px] text-ink-faint">company-wide · OCTANE excluded</span>
      </div>

      {/* Headline gross-profit KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card label="Gross Profit" value={fmtMoney(f.totalGP)} accent="text-ready" sub={`${fmt(f.gpCount)} sold units`} />
        <Card label="GP Margin" value={f.marginPct != null ? `${f.marginPct.toFixed(1)}%` : "—"} accent="text-pif" sub="profit / revenue" />
        <Card label="Revenue" value={fmtMoney(f.totalRevenue)} accent="text-ink" sub="total sold price" />
        <Card label="Avg GP / Unit" value={fmtMoney(f.avgGP)} accent="text-rent" sub="per sold unit" />
        <Card label="Commission" value={fmtMoney(f.totalCommission)} accent="text-downpmt" sub={`on ${fmt(f.soldCount)} sold units`} />
        <Card label="Underwater" value={fmt(f.underwaterCount)} accent="text-diag" sub="sold below cost" />
      </div>

      {/* Company-wide KPI totals (constants from the sheet) */}
      <section className="card p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="eyebrow">Company KPI Totals</h2>
          <span className="text-[10px] text-ink-faint">fleet-wide figures from the sheet — shown as reported</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Mini label="Fleet Cost" value={fmtMoney(f.kpi.cost)} />
          <Mini label="Fleet Retail" value={fmtMoney(f.kpi.retail)} />
          <Mini label="Parts Billed" value={fmtMoney(f.kpi.partsBilled)} />
          <Mini label="Paint &amp; Body" value={fmtMoney(f.kpi.paintBody)} />
          <Mini label="Serviced" value={fmtMoney(f.kpi.serviced)} />
        </div>
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartPanel
          title="Gross Profit by Year Paid"
          hint="GP, by Date paid"
          height={260}
          ariaLabel={`Bar chart, gross profit by year paid: ${f.byYear.map((b) => `${b.label} ${fmtMoney(b.gp)} over ${b.count} units`).join("; ")}.`}
        >
          <CategoryBars data={yearData} series={["Gross profit"]} layout="horizontal" money colors={["#3ddc84"]} />
        </ChartPanel>
        <ChartPanel
          title="Gross Profit by Yard"
          hint="GP, by FOB state"
          height={260}
          ariaLabel={`Bar chart, gross profit by yard: ${f.byYard.map((b) => `${b.label} ${fmtMoney(b.gp)} over ${b.count} units`).join("; ")}.`}
        >
          <CategoryBars data={yardData} series={["Gross profit"]} layout="vertical" money colors={["#3aa0ff"]} />
        </ChartPanel>
      </div>

      <ChartPanel
        title="Gross Profit per Unit — Distribution"
        hint={`${fmt(f.gpCount)} sold units`}
        height={220}
        ariaLabel={`Bar chart, count of units by gross-profit band: ${f.gpDistribution.map((d) => `${d.label} ${d.count} units`).join("; ")}.`}
      >
        <CategoryBars
          data={distData}
          series={["Units"]}
          layout="horizontal"
          colors={{ Loss: "#ff3b46", "$0–5k": "#ffc02e", "$5–10k": "#3aa0ff", "$10–25k": "#3ddc84", "$25k+": "#3ddc84" }}
        />
      </ChartPanel>

      {/* Per-unit GP table */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <h2 className="eyebrow">Per-Unit Gross Profit</h2>
          <div className="relative w-full sm:w-64">
            <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-faint">⌕</span>
            <input
              aria-label="Search financial units"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search serial, make, type, yard…"
              className="w-full border border-line bg-panel-2 py-1.5 pl-7 pr-7 text-xs text-ink placeholder:text-ink-dim focus:border-brand"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-faint hover:text-ink">✕</button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead>
              <tr className="border-y border-line text-ink-dim">
                <Th label="Make / unit" k="make" cur={sortKey} asc={asc} onSort={setSort} />
                <th scope="col" className="px-3 py-2 font-normal">Type</th>
                <th scope="col" className="px-3 py-2 font-normal">Yard</th>
                <Th label="Sold $" k="soldPrice" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Cost $" k="cost" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="GP $" k="gp" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Margin" k="margin" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Comm." k="commission" cur={sortKey} asc={asc} onSort={setSort} num />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-[12px] text-ink-faint">
                  No units match {q ? <span className="text-ink">“{q}”</span> : "this filter"}.
                </td></tr>
              ) : (
                shown.map((u) => (
                  <GPRow key={u.rowIndex} u={u} open={open === u.rowIndex} onToggle={() => setOpen(open === u.rowIndex ? null : u.rowIndex)} />
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pager page={clampedPage} pageCount={pageCount} start={start} shown={shown.length} total={rows.length} onPage={setPage} />
      </section>

      {f.notes.length > 0 && (
        <div className="card border-line p-3">
          {f.notes.map((n, i) => <p key={i} className="text-[11px] text-ink-faint">· {n}</p>)}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent, sub }: { label: string; value: string; accent: string; sub: string }) {
  return (
    <div className="card card-hover p-4">
      <p className="eyebrow">{label}</p>
      <p className={cn("mt-2 font-display text-3xl leading-none tabular-nums sm:text-4xl", accent)}>{value}</p>
      <p className="mt-2 text-[11px] text-ink-faint">{sub}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line bg-panel-2/40 p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="mt-1 font-display text-2xl leading-none tabular-nums text-ink">{value}</p>
    </div>
  );
}

function Th({ label, k, cur, asc, onSort, num: isNum }:
  { label: string; k: SortKey; cur: SortKey; asc: boolean; onSort: (k: SortKey) => void; num?: boolean }) {
  const active = cur === k;
  return (
    <th scope="col" aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
      className={cn("select-none px-3 py-2 font-normal", isNum ? "text-right" : "text-left", active && "text-ink")}>
      <button type="button" onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand", isNum && "flex-row-reverse")}>
        <span className="align-middle">
          {label}
          <span className="sr-only">{active ? `, sorted ${asc ? "ascending" : "descending"}` : ", sortable"}</span>
        </span>
        <span aria-hidden="true" className={cn("inline-block w-2.5 text-center align-middle", active ? "text-brand" : "text-ink-faint")}>
          {active ? (asc ? "↑" : "↓") : "↕"}
        </span>
      </button>
    </th>
  );
}

function gpColor(gp: number | null): string {
  if (gp == null) return "text-ink-dim";
  return gp < 0 ? "text-diag" : "text-ready";
}

function GPRow({ u, open, onToggle }: { u: FinancialUnit; open: boolean; onToggle: () => void }) {
  const detailId = `fin-detail-${u.rowIndex}`;
  return (
    <>
      <tr className={cn("border-b border-line/50 hover:bg-panel-2", open && "bg-panel-2")}>
        <td className="truncate p-0 text-ink">
          <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={detailId}
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left font-bold text-ink">
            <span aria-hidden="true" className="text-ink-faint">{open ? "▾" : "▸"}</span>
            <span className="truncate">{[u.serial4 ? `#${u.serial4}` : null, u.make, u.year].filter(Boolean).join(" · ") || "Unit"}</span>
          </button>
        </td>
        <td className="truncate px-3 py-2 text-ink-dim">{u.type ?? "—"}</td>
        <td className="whitespace-nowrap px-3 py-2 text-ink-dim">{u.location ?? "—"}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-dim">{fmtMoneyExact(u.soldPrice)}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-dim">{fmtMoneyExact(u.cost)}</td>
        <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums font-bold", gpColor(u.gp))}>{fmtMoneyExact(u.gp)}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-dim">{u.margin != null ? `${(u.margin * 100).toFixed(0)}%` : "—"}</td>
        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-ink-dim">{fmtMoneyExact(u.commission)}</td>
      </tr>
      {open && (
        <tr id={detailId} className="border-b border-line/50">
          <td colSpan={8} className="bg-ground/40 px-4 py-3">
            <p className="eyebrow mb-2">Full financial breakdown</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
              <Detail k="Final sale price" v={fmtMoneyExact(u.finalPrice)} />
              <Detail k="Sale price differential" v={fmtMoneyExact(u.differential)} />
              <Detail k="Desired price" v={fmtMoneyExact(u.desiredPrice)} />
              <Detail k="Target sale price" v={fmtMoneyExact(u.targetPrice)} />
              <Detail k="Unit cost" v={fmtMoneyExact(u.unitCost)} />
              <Detail k="DF input cost" v={fmtMoneyExact(u.dfInputCost)} />
              <Detail k="Commission (w/ spiff)" v={fmtMoneyExact(u.commission)} />
              <Detail k="Est. comm. (w2)" v={fmtMoneyExact(u.estCommissionW2)} />
              <Detail k="Est. comm. (spiff)" v={fmtMoneyExact(u.estCommissionSpiff)} />
              <Detail k="Est. comm. (spiff, w2)" v={fmtMoneyExact(u.estCommissionSpiffW2)} />
              <Detail k="Est. cost to customer" v={fmtMoneyExact(u.estCostToCustomer)} />
              <Detail k="SPIFF" v={fmtMoneyExact(u.spiff)} />
              <Detail k="Down payment" v={fmtMoneyExact(u.downPayment)} />
              <Detail k="Date paid" v={u.datePaid ? u.datePaid.slice(0, 10) : null} />
              <Detail k="Deposit date" v={u.depositDate ? u.depositDate.slice(0, 10) : null} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detail({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line/30 py-1 text-[11px]">
      <span className="shrink-0 text-ink-faint">{k}</span>
      <span className="tabular-nums text-ink-dim">{v && v !== "—" ? v : <span className="text-ink-faint">—</span>}</span>
    </div>
  );
}
