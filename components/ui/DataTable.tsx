"use client";

import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/format";
import { Pager } from "@/components/ui/Pager";
import { SortHeader } from "@/components/ui/SortHeader";
import { CopyText } from "@/components/ui/CopyText";
import { printTable } from "@/lib/printTable";

export interface Column<T> {
  key: string;
  header: string;
  /** Full control over the cell. Wins over href/copy when provided. */
  render?: (row: T) => ReactNode;
  /** Present → the column is sortable (SortHeader + aria-sort). */
  sortValue?: (row: T) => string | number;
  /** Present → link cell (opens in a new tab). Return null for "no link". */
  href?: (row: T) => string | null | undefined;
  /** Visible link text; defaults to "Open ↗". */
  linkLabel?: (row: T) => string;
  /** Present → click-to-copy cell (right-click is disabled in prod). */
  copy?: (row: T) => string | null | undefined;
  /** Plain-text projection for Print/PDF export (defaults to copy/href/sortValue/raw). */
  printValue?: (row: T) => string;
  numeric?: boolean;
  thClass?: string;
  tdClass?: string;
}

/**
 * The one shared table primitive: composes SortHeader + Pager + an optional
 * search box over a ColDef list, with convenience link / click-to-copy cells, an
 * optional Print/PDF export, and optional accessible row expansion. Every live
 * unit/rep table should render through this so sort glyphs, paging, empty
 * states, and the URL/copy affordances stay identical everywhere.
 *
 * `fill` makes it stretch to a flex parent's height with a sticky header (for
 * the full-screen drawers); omit it for inline tables that size to content.
 */
export function DataTable<T>({
  columns, rows, getRowKey,
  searchText, searchPlaceholder = "Search…",
  pageSize = 25, initialSort, minWidth = 640,
  emptyLabel = "No matching rows.", fill = false,
  printTitle, printSubtitle, expandable, toolbar,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Present → renders a search box filtering on this haystack. */
  searchText?: (row: T) => string;
  searchPlaceholder?: string;
  pageSize?: number;
  initialSort?: { key: string; asc: boolean };
  minWidth?: number;
  emptyLabel?: string;
  fill?: boolean;
  /** Present → shows a "Print / PDF" button that exports the filtered+sorted rows. */
  printTitle?: string;
  printSubtitle?: string;
  /** Present → each row gets an accessible ▸/▾ toggle revealing this detail panel. */
  expandable?: (row: T) => ReactNode;
  /** Extra controls shown on the toolbar row. */
  toolbar?: ReactNode;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(initialSort?.key ?? null);
  const [asc, setAsc] = useState<boolean>(initialSort?.asc ?? true);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => setPage(0), [q, sortKey, asc]);

  const toggle = (k: string) =>
    setOpenKeys((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  const colByKey = useMemo(() => new Map(columns.map((c) => [c.key, c])), [columns]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle || !searchText) return rows;
    return rows.filter((r) => searchText(r).toLowerCase().includes(needle));
  }, [rows, q, searchText]);

  const sorted = useMemo(() => {
    const col = sortKey ? colByKey.get(sortKey) : undefined;
    if (!col?.sortValue) return filtered;
    const sv = col.sortValue;
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sv(a);
      const vb = sv(b);
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va ?? "").localeCompare(String(vb ?? ""));
      return cmp * dir;
    });
  }, [filtered, sortKey, asc, colByKey]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, pageCount - 1);
  const start = clampedPage * pageSize;
  const shown = sorted.slice(start, start + pageSize);
  const span = columns.length + (expandable ? 1 : 0);

  const onSort = (k: string) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(!colByKey.get(k)?.numeric); // text asc, numeric desc by default
    }
  };

  return (
    <div className={cn("flex flex-col", fill && "min-h-0 flex-1")}>
      {(searchText || toolbar || printTitle) && (
        <div className="flex flex-wrap items-center gap-2 pb-3">
          {searchText && (
            <div className="relative w-full sm:w-72">
              <span aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint">⌕</span>
              <input
                aria-label="Search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full border border-line bg-panel-2 py-1.5 pl-7 pr-7 text-[13px] text-ink placeholder:text-ink-dim focus:border-brand"
              />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[13px] text-ink-faint hover:text-ink">✕</button>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 sm:ml-auto">
            {toolbar}
            {printTitle && (
              <button
                type="button"
                onClick={() =>
                  printTable({
                    title: printTitle,
                    subtitle: printSubtitle,
                    headers: columns.map((c) => c.header),
                    rows: sorted.map((row) => columns.map((c) => cellText(c, row))),
                  })
                }
                className="shrink-0 border border-line px-3 py-1.5 text-[13px] uppercase tracking-wider text-ink-dim transition-colors hover:border-brand hover:text-ink"
              >
                Print / PDF
              </button>
            )}
          </div>
        </div>
      )}

      <div className={cn("card flex flex-col overflow-hidden", fill && "min-h-0 flex-1")}>
        <div className={cn(fill ? "min-h-0 flex-1 overflow-auto" : "overflow-x-auto")}>
          <table className="w-full text-left text-[13px]" style={{ minWidth }}>
            <thead className={cn("bg-panel", fill && "sticky top-0 z-10")}>
              <tr className="border-b border-line text-ink-dim">
                {expandable && <th scope="col" className="w-8 px-2 py-2"><span className="sr-only">Details</span></th>}
                {columns.map((c) =>
                  c.sortValue ? (
                    <SortHeader key={c.key} label={c.header} k={c.key} cur={sortKey} asc={asc} onSort={onSort} num={c.numeric} />
                  ) : (
                    <th key={c.key} scope="col" className={cn("select-none px-3 py-2 font-normal", c.numeric ? "text-right" : "text-left", c.thClass)}>
                      {c.header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 ? (
                <tr>
                  <td colSpan={span} className="px-3 py-10 text-center text-ink-faint">
                    {q ? `No rows match “${q}”.` : emptyLabel}
                  </td>
                </tr>
              ) : (
                shown.map((row) => {
                  const rowKey = getRowKey(row);
                  const isOpen = !!expandable && openKeys.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                      <tr className="border-b border-line/40 hover:bg-panel-2">
                        {expandable && (
                          <td className="w-8 px-2 py-2 align-top">
                            <button
                              type="button"
                              aria-expanded={isOpen}
                              aria-controls={isOpen ? `${rowKey}-detail` : undefined}
                              aria-label={isOpen ? "Hide details" : "Show details"}
                              onClick={() => toggle(rowKey)}
                              className="text-ink-faint transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                            >
                              <span aria-hidden="true">{isOpen ? "▾" : "▸"}</span>
                            </button>
                          </td>
                        )}
                        {columns.map((c) => (
                          <td key={c.key} className={cn("px-3 py-2", c.numeric && "text-right tabular-nums", c.tdClass)}>
                            {renderCell(c, row)}
                          </td>
                        ))}
                      </tr>
                      {isOpen && (
                        <tr id={`${rowKey}-detail`} className="border-b border-line/40 bg-panel-2/40">
                          <td colSpan={span} className="px-4 py-3">
                            {expandable!(row)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pager page={clampedPage} pageCount={pageCount} start={start} shown={shown.length} total={sorted.length} onPage={setPage} />
      </div>
    </div>
  );
}

function renderCell<T>(c: Column<T>, row: T): ReactNode {
  if (c.render) return c.render(row);
  if (c.href) {
    const url = c.href(row);
    if (!url) return <span className="text-ink-faint">—</span>;
    const label = c.linkLabel ? c.linkLabel(row) : "Open ↗";
    return <a href={url} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">{label}</a>;
  }
  if (c.copy) {
    const val = c.copy(row);
    if (!val) return <span className="text-ink-faint">—</span>;
    return <CopyText value={val} label={c.header.toLowerCase()} />;
  }
  const v = (row as Record<string, unknown>)[c.key];
  return v == null || v === "" ? <span className="text-ink-faint">—</span> : String(v);
}

/** Plain-text projection of a cell for Print/PDF export. */
function cellText<T>(c: Column<T>, row: T): string {
  if (c.printValue) return c.printValue(row);
  if (c.copy) return c.copy(row) ?? "";
  if (c.href) return c.href(row) ?? "";
  if (c.sortValue) { const v = c.sortValue(row); return v == null ? "" : String(v); }
  const v = (row as Record<string, unknown>)[c.key];
  return v == null ? "" : String(v);
}
