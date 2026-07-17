"use client";

import { useMemo } from "react";
import type { UnitRecord } from "@/lib/types";
import { CopyText } from "@/components/ui/CopyText";
import { Drawer } from "@/components/ui/Drawer";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { UnitDetail } from "@/components/units/UnitDetail";

const isUrl = (v: string | null | undefined): v is string => !!v && /^https?:\/\//i.test(v);

/**
 * Media-specific drill-down: the actual units behind a clicked coverage card,
 * with click-through links to each unit's walkaround video + product page.
 * Runs through the shared DataTable/Drawer, so search, sort, paging, Print/PDF
 * and the expandable UnitDetail (which exposes copyable video/product URLs —
 * right-click is disabled in prod) match every other unit table. Read-only.
 */
export function MediaDrawer({ title, units, onClose }: { title: string; units: UnitRecord[]; onClose: () => void }) {
  const columns = useMemo<Column<UnitRecord>[]>(() => [
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
    {
      key: "video", header: "Video", sortValue: (u) => (isUrl(u.specs.youtubeUrl) ? 0 : 1),
      href: (u) => (isUrl(u.specs.youtubeUrl) ? u.specs.youtubeUrl : null), linkLabel: () => "▶ Video ↗",
      printValue: (u) => u.specs.youtubeUrl ?? "",
    },
    {
      key: "page", header: "Product page", sortValue: (u) => (isUrl(u.specs.productUrl) ? 0 : 1),
      href: (u) => (isUrl(u.specs.productUrl) ? u.specs.productUrl : null), linkLabel: () => "Page ↗",
      printValue: (u) => u.specs.productUrl ?? "",
    },
  ], []);

  return (
    <Drawer title={title} subtitle={`${units.length.toLocaleString()} ${units.length === 1 ? "unit" : "units"}`} onClose={onClose}>
      <DataTable
        fill
        columns={columns}
        rows={units}
        getRowKey={(u) => String(u.rowIndex)}
        searchText={(u) => [u.serial4, u.serial, u.forkliftName, u.name, u.make, u.model, u.type, u.year, u.location].filter(Boolean).join(" ")}
        searchPlaceholder="Search unit, serial, make…"
        minWidth={900}
        printTitle={title}
        printSubtitle="Discount Forklift · media coverage"
        expandable={(u) => <UnitDetail u={u} />}
        emptyLabel="No units in this view."
      />
    </Drawer>
  );
}
