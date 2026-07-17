"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { UnitRecord } from "@/lib/types";
import { cn } from "@/lib/format";
import { unitTitle } from "@/components/tabs/shared";
import { WorkPill } from "@/components/ui/Pills";
import { Drawer } from "@/components/ui/Drawer";
import { UnitDetail } from "@/components/units/UnitDetail";
import { UnitsDrawer } from "@/components/overview/UnitsDrawer";

const MAX = 10;

/**
 * Global unit search — sticky in the header on every tab. Matches any unit on
 * name / serial / make / model / year / price / fuel / location / customer /
 * salesperson, and opens the canonical UnitDetail. An accessible combobox
 * (aria-activedescendant listbox, arrow-key + Enter, Esc/outside-click close).
 */
export function GlobalSearch({ units }: { units: UnitRecord[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [detail, setDetail] = useState<UnitRecord | null>(null);
  const [seeAll, setSeeAll] = useState<{ title: string; units: UnitRecord[] } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const index = useMemo(
    () =>
      units.map((u) => ({
        u,
        hay: [unitTitle(u), u.serial, u.serial4, u.make, u.model, u.type, u.year, u.fuel, u.location, u.customer, u.soldBy, u.price != null ? String(u.price) : null]
          .filter(Boolean).join(" ").toLowerCase(),
      })),
    [units],
  );

  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => (needle.length < 2 ? [] : index.filter((r) => r.hay.includes(needle)).map((r) => r.u)), [index, needle]);
  const shown = matches.slice(0, MAX);

  useEffect(() => setActive(0), [needle]);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const choose = (u: UnitRecord) => { setDetail(u); setOpen(false); setQ(""); };
  const openAll = () => { setSeeAll({ title: `Search: “${q.trim()}”`, units: matches }); setOpen(false); };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { setOpen(false); return; }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, shown.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (shown[active]) choose(shown[active]);
      else if (matches.length) openAll();
    }
  };

  const listId = "global-search-list";
  return (
    <div ref={boxRef} className="relative w-full max-w-md">
      <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">⌕</span>
      <input
        type="text"
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `gs-opt-${active}` : undefined}
        aria-label="Search all units by name, serial, make, model, year, or price"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Find a unit — serial, name, make, model…"
        className="w-full border border-line bg-panel-2 py-1.5 pl-7 pr-7 text-[13px] text-ink placeholder:text-ink-dim focus:border-brand focus-visible:outline-none"
      />
      {q && (
        <button onClick={() => { setQ(""); setOpen(false); }} aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint hover:text-ink">✕</button>
      )}

      {open && needle.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 border border-line bg-panel shadow-lg">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-ink-faint">No units match “{q.trim()}”.</p>
          ) : (
            <ul id={listId} role="listbox" aria-label="Unit matches" className="max-h-80 overflow-auto py-1">
              {shown.map((u, i) => (
                <li
                  key={u.rowIndex}
                  id={`gs-opt-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(u)}
                  className={cn("flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-[13px]", i === active && "bg-panel-2")}
                >
                  <span className="min-w-0 truncate text-ink">{unitTitle(u)}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {u.location && <span className="text-[12px] text-ink-faint">{u.location}</span>}
                    <WorkPill work={u.work} />
                  </span>
                </li>
              ))}
              {matches.length > shown.length && (
                <li
                  role="option"
                  aria-selected={false}
                  onClick={openAll}
                  className="cursor-pointer border-t border-line/60 px-3 py-2 text-[12px] text-brand hover:bg-panel-2"
                >
                  See all {matches.length.toLocaleString()} matches →
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {detail && (
        <Drawer title={unitTitle(detail)} onClose={() => setDetail(null)}>
          <div className="max-w-3xl">
            <UnitDetail u={detail} />
          </div>
        </Drawer>
      )}
      {seeAll && <UnitsDrawer title={seeAll.title} units={seeAll.units} onClose={() => setSeeAll(null)} />}
    </div>
  );
}
