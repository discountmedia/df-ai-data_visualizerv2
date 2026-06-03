"use client";

import { useMemo, useState } from "react";
import type { SalesSummary, SalesRep, SoldUnit, SaleBucket } from "@/lib/types";
import { cn, fmt, fmtMoney } from "@/lib/format";
import { EmptyState } from "../states/States";

type SortKey = "unitsSold" | "totalSale" | "avgSale" | "emailsSent" | "unsignedDocs" | "name";

export function SalesTeam({ summary }: { summary: SalesSummary }) {
  const [sortKey, setSortKey] = useState<SortKey>("unitsSold");
  const [asc, setAsc] = useState(false);
  const [openRep, setOpenRep] = useState<string | null>(null);

  if (summary.reps.length === 0 && summary.totalSold === 0) {
    return (
      <EmptyState
        title="No sales data found"
        hint="This export didn't yield a 'sold by' column or a staff roster to attribute sales."
      />
    );
  }

  const sorted = [...summary.reps].sort((a, b) => {
    const dir = asc ? 1 : -1;
    if (sortKey === "name") return a.name.localeCompare(b.name) * dir;
    return ((num(a[sortKey]) - num(b[sortKey])) * dir) || (b.unitsSold - a.unitsSold);
  });

  const setSort = (k: SortKey) => {
    if (k === sortKey) setAsc(!asc);
    else { setSortKey(k); setAsc(k === "name"); }
  };

  const activeReps = summary.reps.filter((r) => r.unitsSold > 0).length;
  const totalSaleVal = summary.reps.reduce((s, r) => s + (r.totalSale ?? 0), 0);
  const avgSale = summary.totalSold > 0 ? Math.round(totalSaleVal / summary.totalSold) : null;
  const allSold = useMemo(() => Object.values(summary.soldUnitsByRep).flat(), [summary.soldUnitsByRep]);

  return (
    <div className="space-y-5 fade-up">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="eyebrow text-brand">Sales Team</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Who&apos;s closing — and what&apos;s still open</h1>
        </div>
        <span className="text-[11px] text-ink-faint">company-wide · not filtered by yard</span>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Card label="Total Sold" value={fmt(summary.totalSold)} accent="text-diag" sub="Attributed units" />
        <Card label="Reps Active" value={fmt(activeReps)} accent="text-ink" sub={`${summary.reps.length} on team`} />
        <Card label="Unsigned Docs" value={fmt(summary.unsignedCount)} accent="text-working" sub="Real open deals" />
        <Card label="Avg Sale" value={fmtMoney(avgSale)} accent="text-ready" sub="Per unit" />
        <Card label="Total Sales $" value={fmtMoney(totalSaleVal || null)} accent="text-pif" sub="Attributed" />
        <Card
          label="Emails Sent"
          value={summary.emailsAvailable ? fmt(summary.totalEmails) : "—"}
          accent="text-rent"
          sub={summary.emailsAvailable ? "Outreach (proxy)" : "Not in file"}
        />
      </div>

      {/* Engaging visuals */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2"><SalesRace reps={summary.reps} /></div>
        <DealHealth units={allSold} />
      </div>

      {/* Leaderboard */}
      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="eyebrow">Sales Team — Leaderboard</p>
          <p className="text-[11px] text-ink-faint">click a rep for what they sold · click a header to sort</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] table-fixed text-left text-xs">
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
                <th className="px-4 py-2 font-normal">Location</th>
                <Th label="Units" k="unitsSold" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Total $" k="totalSale" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Avg $" k="avgSale" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Emails" k="emailsSent" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Unsigned" k="unsignedDocs" cur={sortKey} asc={asc} onSort={setSort} num />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <RepRow
                  key={r.name}
                  rep={r}
                  open={openRep === r.name}
                  units={summary.soldUnitsByRep[r.name] ?? []}
                  emailsAvailable={summary.emailsAvailable}
                  onToggle={() => setOpenRep(openRep === r.name ? null : r.name)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Round robin + lead sources */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <RoundRobinPanel summary={summary} />
        <LeadSourcesPanel summary={summary} />
      </div>

      {/* Unsigned worklist */}
      <UnsignedPanel units={summary.unsignedWorklist} />

      {summary.notes.length > 0 && (
        <div className="card border-line p-3">
          {summary.notes.map((n, i) => (
            <p key={i} className="text-[11px] text-ink-faint">· {n}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function num(v: number | null): number {
  return v ?? 0;
}

const MEDAL = ["🥇", "🥈", "🥉"];

/** A horizontal "race" of the top reps by units sold — the page's hero visual. */
function SalesRace({ reps }: { reps: SalesRep[] }) {
  const ranked = [...reps].filter((r) => r.unitsSold > 0).sort((a, b) => b.unitsSold - a.unitsSold).slice(0, 10);
  const max = ranked[0]?.unitsSold ?? 1;
  if (ranked.length === 0) {
    return (
      <section className="card p-4">
        <p className="eyebrow">Sales Race</p>
        <p className="mt-3 text-[11px] text-ink-faint">No attributed units to race yet.</p>
      </section>
    );
  }
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Sales Race — Units Sold</p>
        <span className="text-[10px] text-ink-faint">top {ranked.length} reps</span>
      </div>
      <div className="mt-3 space-y-2">
        {ranked.map((r, i) => (
          <div key={r.name} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-center text-sm">
              {i < 3 ? MEDAL[i] : <span className="text-[11px] tabular-nums text-ink-faint">{i + 1}</span>}
            </span>
            <span className="w-24 shrink-0 truncate text-xs text-ink-dim sm:w-36" title={r.name}>{r.name}</span>
            <div className="relative h-5 flex-1 overflow-hidden rounded-sm bg-panel-2">
              <div
                className={cn("h-full rounded-sm transition-[width] duration-700", i === 0 ? "bg-brand" : "bg-rent")}
                style={{ width: `${(r.unitsSold / max) * 100}%`, opacity: i === 0 ? 1 : 0.8 }}
              />
            </div>
            <span className="w-9 shrink-0 text-right font-display text-base leading-none tabular-nums text-ink">{r.unitsSold}</span>
            <span className="hidden w-20 shrink-0 text-right text-[11px] tabular-nums text-pif sm:inline">{fmtMoney(r.totalSale)}</span>
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
          <span className="text-[11px] text-ink-dim">Signature rate</span>
          <span className="font-display text-2xl leading-none tabular-nums text-ready">{signRate}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-sm bg-panel-2">
          <div className="h-full bg-ready transition-[width] duration-700" style={{ width: `${signRate}%` }} />
        </div>
        <p className="mt-1 text-[10px] text-ink-faint">{fmt(signed)} of {fmt(total)} attributed deals signed</p>
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-[11px] text-ink-dim">Payment mix</p>
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
              <span key={p.key} className="flex items-center gap-1 text-[10px]">
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
      <p className="mt-2 text-[11px] text-ink-faint">{sub}</p>
    </div>
  );
}

function Th({ label, k, cur, asc, onSort, num: isNum }:
  { label: string; k: SortKey; cur: SortKey; asc: boolean; onSort: (k: SortKey) => void; num?: boolean }) {
  const active = cur === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={cn("cursor-pointer select-none px-4 py-2 font-normal hover:text-ink", isNum ? "text-right" : "text-left", active && "text-ink")}
    >
      <span className="align-middle">{label}</span>
      <span className={cn("ml-1 inline-block w-2.5 text-center align-middle", active ? "text-brand" : "text-ink-faint")}>
        {active ? (asc ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}

function RepRow({ rep, open, units, emailsAvailable, onToggle }:
  { rep: SalesRep; open: boolean; units: SoldUnit[]; emailsAvailable: boolean; onToggle: () => void }) {
  return (
    <>
      <tr onClick={onToggle} className={cn("cursor-pointer border-b border-line/50 hover:bg-panel-2", open && "bg-panel-2")}>
        <td className="truncate px-4 py-2 font-bold text-ink">
          <span className="mr-1 text-ink-faint">{open ? "▾" : "▸"}</span>{rep.name}
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
        <tr className="border-b border-line/50">
          <td colSpan={7} className="bg-ground/40 px-4 py-3">
            {units.length === 0 ? (
              <p className="text-[11px] text-ink-faint">No attributed units{rep.title ? ` · ${rep.title}` : ""}.</p>
            ) : (
              <div className="space-y-1">
                <p className="eyebrow mb-2">What {rep.name} sold ({units.length})</p>
                {units.slice(0, 30).map((u, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
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
  return <span className={cn("border px-1.5 py-0.5 text-[10px] uppercase", cls)}>{raw}</span>;
}

function RoundRobinPanel({ summary }: { summary: SalesSummary }) {
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">Round-Robin — Next Up</p>
        {summary.roundRobinAsOf && (
          <span className="text-[10px] text-ink-faint">as of {summary.roundRobinAsOf}</span>
        )}
      </div>
      {summary.roundRobin.length === 0 ? (
        <p className="mt-3 text-[11px] text-ink-faint">No round-robin queue data in this export.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {summary.roundRobin.map((q) => (
            <div key={q.queue} className="flex items-center justify-between border-b border-line/40 pb-1.5 text-xs">
              <span className="text-ink-dim">{q.queue}</span>
              <span className="font-bold text-ink">{q.assignee ?? "—"}</span>
            </div>
          ))}
          <p className="pt-1 text-[10px] text-ink-faint">Live pointer per queue — not a lead-distribution history.</p>
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
        <p className="mt-3 text-[11px] text-ink-faint">No lead-source column detected.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {summary.leadSources.map((l) => (
            <div key={l.source}>
              <div className="flex items-center justify-between text-xs">
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

function UnsignedPanel({ units }: { units: SoldUnit[] }) {
  if (units.length === 0) return null;
  return (
    <section className="card border-working/30 p-4">
      <p className="eyebrow text-working">Unsigned PandaDocs — Chase These ({units.length})</p>
      <p className="mt-1 text-[11px] text-ink-faint">Committed deals (down-payment / paid-in-full) with no signature on file. Govt POs and removed units excluded.</p>
      <div className="mt-3 space-y-1.5">
        {units.map((u, i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-line/40 pb-1.5 text-[11px]">
            <span className="text-ink">{[u.make, u.model, u.type].filter(Boolean).join(" · ") || "Unit"}</span>
            <span className="flex items-center gap-3">
              <span className="text-ink-dim">{u.rep}</span>
              <SalePill raw={u.saleTypeRaw} />
              <span className="w-16 text-right tabular-nums text-pif">{fmtMoney(u.price)}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
