"use client";

import { cn } from "@/lib/format";

/**
 * Accessible sortable table header: a real <button> inside a <th scope="col">
 * with aria-sort + an sr-only state announcement. `cur` may be null (no active
 * sort). Generic over the key type so any table can reuse it.
 */
export function SortHeader<K extends string>({ label, k, cur, asc, onSort, num, padClass = "px-3 py-2" }:
  { label: string; k: K; cur: K | null; asc: boolean; onSort: (k: K) => void; num?: boolean; padClass?: string }) {
  const active = cur === k;
  return (
    <th
      scope="col"
      aria-sort={active ? (asc ? "ascending" : "descending") : "none"}
      className={cn("select-none font-normal", padClass, num ? "text-right" : "text-left", active && "text-ink")}
    >
      <button
        type="button"
        onClick={() => onSort(k)}
        className={cn("inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand", num && "flex-row-reverse")}
      >
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
