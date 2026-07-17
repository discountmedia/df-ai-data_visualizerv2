"use client";

import { useMemo } from "react";
import type { UnitRecord } from "@/lib/types";
import { fmtMoney } from "@/lib/format";
import { WorkPill, SalePill } from "@/components/ui/Pills";
import { CopyText } from "@/components/ui/CopyText";
import { Drawer } from "@/components/ui/Drawer";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { UnitDetail } from "@/components/units/UnitDetail";

const isUrl = (v: string | null | undefined): v is string => !!v && /^https?:\/\//i.test(v);

/** Titles whose population is a sold / committed cut → show who sold it + the buyer. */
const SALE_CONTEXT = /\b(sold|paid|down\s*payment|deposit|govt|po|open\s*work|committed)\b/i;

/**
 * Full-screen drill-down: the actual units behind a clicked KPI card. Renders
 * through the shared DataTable, so search, sort, paging, click-to-copy, the
 * listing-URL column, Print/PDF, and the expandable UnitDetail all come for
 * free and stay identical to every other unit table. Read-only — the audit
 * trail for a headline number; nothing computes here.
 */
export function UnitsDrawer({ title, units, onClose }: { title: string; units: UnitRecord[]; onClose: () => void }) {
  const saleContext = SALE_CONTEXT.test(title);

  const columns = useMemo<Column<UnitRecord>[]>(() => {
    const cols: Column<UnitRecord>[] = [
      {
        key: "serial", header: "Serial", sortValue: (u) => u.serial4 ?? "",
        render: (u) => u.serial4
          ? <CopyText value={u.serial4} label="serial"><span className="tabular-nums text-ink-dim">#{u.serial4}</span></CopyText>
          : <span className="text-ink-faint">—</span>,
        printValue: (u) => u.serial4 ?? "",
      },
      {
        key: "unit", header: "Unit", sortValue: (u) => u.forkliftName ?? u.name ?? "",
        render: (u) => <span className="font-bold text-ink">{u.forkliftName ?? u.name ?? "—"}</span>,
        printValue: (u) => u.forkliftName ?? u.name ?? "",
      },
      {
        key: "spec", header: "Year · Make · Type", sortValue: (u) => [u.year, u.make, u.type].filter(Boolean).join(" "),
        render: (u) => <span className="text-ink-dim">{[u.year, u.make, u.type].filter(Boolean).join(" · ") || "—"}</span>,
      },
      { key: "location", header: "Location", sortValue: (u) => u.location ?? "", render: (u) => <span className="text-ink-dim">{u.location ?? "—"}</span> },
      { key: "stage", header: "Stage", sortValue: (u) => u.work, render: (u) => <WorkPill work={u.work} /> },
      { key: "sale", header: "Sale", sortValue: (u) => u.sale, render: (u) => <SalePill sale={u.sale} /> },
    ];
    if (saleContext) {
      cols.push(
        { key: "soldBy", header: "Sold by", sortValue: (u) => u.soldBy ?? "", copy: (u) => u.soldBy },
        { key: "customer", header: "Customer", sortValue: (u) => u.customer ?? "", copy: (u) => u.customer },
      );
    }
    cols.push(
      { key: "listing", header: "Listing", href: (u) => (isUrl(u.specs.productUrl) ? u.specs.productUrl : null), linkLabel: () => "Listing ↗", printValue: (u) => u.specs.productUrl ?? "" },
      {
        key: "price", header: "Price", numeric: true, sortValue: (u) => u.price ?? -Infinity,
        render: (u) => <span className="tabular-nums text-pif">{u.price != null ? fmtMoney(u.price) : "—"}</span>,
        printValue: (u) => (u.price != null ? String(u.price) : ""),
      },
    );
    return cols;
  }, [saleContext]);

  return (
    <Drawer title={title} subtitle={`${units.length.toLocaleString()} ${units.length === 1 ? "unit" : "units"}`} onClose={onClose}>
      <DataTable
        fill
        columns={columns}
        rows={units}
        getRowKey={(u) => String(u.rowIndex)}
        searchText={(u) => [u.serial4, u.serial, u.forkliftName, u.name, u.make, u.model, u.type, u.year, u.location, u.customer, u.soldBy].filter(Boolean).join(" ")}
        searchPlaceholder="Search unit, serial, make, customer…"
        minWidth={saleContext ? 1100 : 900}
        printTitle={title}
        printSubtitle="Discount Forklift"
        expandable={(u) => <UnitDetail u={u} />}
        emptyLabel="No units in this view."
      />
    </Drawer>
  );
}
