"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/format";

export interface ColDef<T> {
  key: string;
  label: string;
  numeric?: boolean;
  render?: (r: T) => ReactNode;
  sortVal?: (r: T) => string | number;
}

/** Generic sortable table. Click a header to sort; numeric columns right-align. */
export function Leaderboard<T>({
  columns, rows, initialSort, rowKey, minWidth = 460, maxRows,
}: {
  columns: ColDef<T>[];
  rows: T[];
  initialSort?: { key: string; asc: boolean };
  rowKey: (r: T) => string;
  minWidth?: number;
  maxRows?: number;
}) {
  const [sort, setSort] = useState(initialSort ?? { key: columns[0]?.key ?? "", asc: false });
  const col = columns.find((c) => c.key === sort.key);
  const sorted = [...rows].sort((a, b) => {
    if (!col) return 0;
    const va = col.sortVal ? col.sortVal(a) : (a as Record<string, unknown>)[col.key];
    const vb = col.sortVal ? col.sortVal(b) : (b as Record<string, unknown>)[col.key];
    const cmp = typeof va === "number" && typeof vb === "number"
      ? va - vb
      : String(va ?? "").localeCompare(String(vb ?? ""));
    return sort.asc ? cmp : -cmp;
  });
  const shown = maxRows ? sorted.slice(0, maxRows) : sorted;
  const onSort = (k: string) => setSort((s) => (s.key === k ? { key: k, asc: !s.asc } : { key: k, asc: false }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[11px]" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line text-ink-dim">
            {columns.map((c) => (
              <th key={c.key}
                onClick={() => onSort(c.key)}
                className={cn("cursor-pointer select-none px-2 py-1.5 font-normal hover:text-ink", c.numeric && "text-right")}>
                {c.label}{sort.key === c.key && <span className="text-brand">{sort.asc ? " ▲" : " ▼"}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={rowKey(r)} className="border-b border-line/40">
              {columns.map((c) => (
                <td key={c.key} className={cn("px-2 py-1.5", c.numeric && "text-right tabular-nums")}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {maxRows && sorted.length > maxRows && (
        <p className="mt-1 px-2 text-[10px] text-ink-faint">Showing top {maxRows} of {sorted.length}.</p>
      )}
    </div>
  );
}
