"use client";

import { useMemo, useState } from "react";
import type { UnitRecord, WorkBucket } from "@/lib/types";
import { cn, fmt, fmtMoney } from "@/lib/format";
import { WorkPill, SalePill } from "@/components/ui/Pills";
import { WORK_LABEL } from "@/lib/buckets";
import { EmptyState } from "@/components/states/States";

type SortKey =
  | "name"
  | "serial"
  | "make"
  | "type"
  | "location"
  | "capacity"
  | "work"
  | "sale"
  | "price";

const WORK_ORDER: Record<WorkBucket, number> = {
  needs_diagnosis: 0,
  working: 1,
  ready: 2,
  on_rent: 3,
  sold: 4,
  unknown: 5,
};
const SALE_ORDER: Record<string, number> = {
  paid_in_full: 0,
  down_payment: 1,
  govt_po: 2,
  rental: 3,
  other: 4,
  unknown: 5,
};

function sortVal(u: UnitRecord, k: SortKey): string | number {
  switch (k) {
    case "capacity":
      return u.capacity ?? -1;
    case "price":
      return u.price ?? -1;
    case "work":
      return WORK_ORDER[u.work];
    case "sale":
      return SALE_ORDER[u.sale];
    default:
      return (u[k] ?? "").toString().toLowerCase();
  }
}

export function AllUnits({ units }: { units: UnitRecord[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("work");
  const [asc, setAsc] = useState(true);
  const [loc, setLoc] = useState("ALL");
  const [work, setWork] = useState<WorkBucket | "ALL">("ALL");
  const [query, setQuery] = useState("");

  const locations = useMemo(() => {
    const s = new Set<string>();
    for (const u of units) if (u.location) s.add(u.location);
    return Array.from(s).sort();
  }, [units]);

  const workBuckets = useMemo(() => {
    const present = new Set<WorkBucket>();
    for (const u of units) present.add(u.work);
    return (Object.keys(WORK_ORDER) as WorkBucket[]).filter((b) => present.has(b));
  }, [units]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let rows = units;
    if (loc !== "ALL") rows = rows.filter((u) => (u.location ?? "") === loc);
    if (work !== "ALL") rows = rows.filter((u) => u.work === work);
    if (q) {
      rows = rows.filter((u) =>
        [u.name, u.serial, u.make, u.model, u.type, u.customer, u.soldBy]
          .some((f) => f && f.toLowerCase().includes(q))
      );
    }
    const dir = asc ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = sortVal(a, sortKey);
      const bv = sortVal(b, sortKey);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.id.localeCompare(b.id);
    });
  }, [units, loc, work, query, sortKey, asc]);

  const setSort = (k: SortKey) => {
    if (k === sortKey) setAsc(!asc);
    else {
      setSortKey(k);
      // text columns default A→Z; numeric/bucket columns default most-relevant first.
      setAsc(k === "name" || k === "serial" || k === "make" || k === "type" || k === "location" || k === "work" || k === "sale");
    }
  };

  if (units.length === 0) {
    return <EmptyState title="No unit rows to display" hint="The inventory table came back empty after schema review." />;
  }

  return (
    <div className="space-y-4 fade-up">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search make / model / serial / customer…"
          className="w-full max-w-xs border border-line bg-panel px-3 py-1.5 text-xs text-ink placeholder:text-ink-dim focus:border-brand focus-visible:outline-none sm:w-64"
        />
        {locations.length > 0 && (
          <select
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            className="border border-line bg-panel px-2 py-1.5 text-xs text-ink-dim focus:border-brand focus-visible:outline-none"
          >
            <option value="ALL">All locations</option>
            {locations.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <FilterChip active={work === "ALL"} onClick={() => setWork("ALL")}>All stages</FilterChip>
          {workBuckets.map((b) => (
            <FilterChip key={b} active={work === b} onClick={() => setWork(b)}>{WORK_LABEL[b]}</FilterChip>
          ))}
        </div>
        <span className="ml-auto text-[11px] tabular-nums text-ink-faint">
          {fmt(filtered.length)} of {fmt(units.length)} units
        </span>
      </div>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="eyebrow">All Units</p>
          <p className="text-[11px] text-ink-faint">click a header to sort</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] table-fixed text-left text-xs">
            <colgroup>
              <col style={{ width: "180px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "100px" }} />
              <col style={{ width: "190px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "90px" }} />
              <col style={{ width: "130px" }} />
              <col style={{ width: "120px" }} />
              <col style={{ width: "60px" }} />
              <col style={{ width: "100px" }} />
            </colgroup>
            <thead>
              <tr className="border-y border-line text-ink-dim">
                <Th label="Unit" k="name" cur={sortKey} asc={asc} onSort={setSort} />
                <Th label="Serial" k="serial" cur={sortKey} asc={asc} onSort={setSort} />
                <Th label="Make" k="make" cur={sortKey} asc={asc} onSort={setSort} />
                <Th label="Type" k="type" cur={sortKey} asc={asc} onSort={setSort} />
                <Th label="Location" k="location" cur={sortKey} asc={asc} onSort={setSort} />
                <Th label="Cap (lbs)" k="capacity" cur={sortKey} asc={asc} onSort={setSort} num />
                <Th label="Work Stage" k="work" cur={sortKey} asc={asc} onSort={setSort} />
                <Th label="Sale" k="sale" cur={sortKey} asc={asc} onSort={setSort} />
                <th className="px-3 py-2 text-center font-normal">Sig</th>
                <Th label="Price" k="price" cur={sortKey} asc={asc} onSort={setSort} num />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id + ":" + u.rowIndex} className="border-b border-line/50 hover:bg-panel-2">
                  <td className="truncate px-3 py-2 font-bold text-ink" title={u.name ?? ""}>{u.name ?? "—"}</td>
                  <td className="truncate px-3 py-2 tabular-nums text-ink-dim">{u.serial ?? "—"}</td>
                  <td className="truncate px-3 py-2 text-ink-dim">{u.make ?? "—"}</td>
                  <td className="truncate px-3 py-2 text-ink-dim" title={u.type ?? ""}>{u.type ?? "—"}</td>
                  <td className="truncate px-3 py-2 text-ink-dim">{u.location ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-dim">{u.capacity != null ? fmt(u.capacity) : "—"}</td>
                  <td className="px-3 py-2"><WorkPill work={u.work} /></td>
                  <td className="px-3 py-2"><SalePill sale={u.sale} /></td>
                  <td className="px-3 py-2 text-center">
                    {u.committed ? (
                      <span className={cn("w-3", u.signed ? "text-ready" : "text-working")} title={u.signed ? "Signed" : "Unsigned"}>
                        {u.signed ? "✓" : "○"}
                      </span>
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-pif">{fmtMoney(u.price)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-ink-faint">No units match these filters.</p>
        )}
      </section>
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

function Th({ label, k, cur, asc, onSort, num }:
  { label: string; k: SortKey; cur: SortKey; asc: boolean; onSort: (k: SortKey) => void; num?: boolean }) {
  const active = cur === k;
  return (
    <th
      onClick={() => onSort(k)}
      className={cn("cursor-pointer select-none px-3 py-2 font-normal hover:text-ink", num ? "text-right" : "text-left", active && "text-ink")}
    >
      <span className="align-middle">{label}</span>
      <span className={cn("ml-1 inline-block w-2.5 text-center align-middle", active ? "text-brand" : "text-ink-faint")}>
        {active ? (asc ? "↑" : "↓") : "↕"}
      </span>
    </th>
  );
}
