"use client";

import type { ReactNode } from "react";
import type { UnitRecord } from "@/lib/types";
import { fmtMoneyExact } from "@/lib/format";
import { unitTitle } from "@/components/tabs/shared";
import { WorkPill, SalePill } from "@/components/ui/Pills";
import { CopyText } from "@/components/ui/CopyText";
import { ExternalLink } from "@/components/ui/ExternalLink";

const isUrl = (v: string | null | undefined): v is string => !!v && /^https?:\/\//i.test(v);

/**
 * The one canonical unit-detail view — the single place a unit's full info is
 * shown. Opened from KPI drawers, table rows, and global search. Read-only.
 * Serial / customer / salesperson / URLs are click-to-copy because right-click
 * is disabled in the production Web Viewer.
 */
export function UnitDetail({ u }: { u: UnitRecord }) {
  const measures = [
    { k: "Hours", v: u.specs.hours },
    { k: "Capacity (lbs)", v: u.capacity != null ? u.capacity.toLocaleString() : null },
    { k: "Mast", v: u.specs.mast },
    { k: "Fork length", v: u.specs.forkLength },
    { k: "Lowered height", v: u.specs.loweredHeight },
    { k: "Raised / max fork", v: u.specs.raisedHeight },
    { k: "Tires / drive", v: u.specs.tires },
    { k: "Attachments", v: u.specs.attachments },
    { k: "Warehouse", v: u.specs.warehouse },
  ].filter((m) => m.v);

  const links = [
    { k: "Product page", href: u.specs.productUrl },
    { k: "Walk-around video", href: u.specs.youtubeUrl },
  ].filter((l) => isUrl(l.href));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-bold text-ink">{unitTitle(u)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <WorkPill work={u.work} />
          <SalePill sale={u.sale} />
          {u.location && <span className="text-[13px] text-ink-faint">{u.location}</span>}
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
        <DetailRow k="Serial (last 4)">{u.serial4 ? <CopyText value={u.serial4} label="serial">#{u.serial4}</CopyText> : null}</DetailRow>
        <DetailRow k="Full serial">{u.serial ? <CopyText value={u.serial} label="serial" /> : null}</DetailRow>
        <DetailRow k="Year">{u.year}</DetailRow>
        <DetailRow k="Fuel">{u.fuel}</DetailRow>
        <DetailRow k="Customer">{u.customer ? <CopyText value={u.customer} label="customer" /> : null}</DetailRow>
        <DetailRow k="Sold by">{u.soldBy ? <CopyText value={u.soldBy} label="salesperson" /> : null}</DetailRow>
        <DetailRow k="Sale price">{u.price != null ? fmtMoneyExact(u.price) : null}</DetailRow>
        <DetailRow k="Signed">{u.committed ? (u.signed ? "Yes" : "No") : null}</DetailRow>
      </div>

      {measures.length > 0 && (
        <div>
          <p className="eyebrow mb-2">Specs</p>
          <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3">
            {measures.map((m) => (
              <div key={m.k} className="flex items-baseline justify-between gap-2 border-b border-line/30 py-1 text-[13px]">
                <span className="shrink-0 text-ink-faint">{m.k}</span>
                <span className="truncate text-right text-ink-dim" title={m.v!}>{m.v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <span key={l.k} className="inline-flex items-center gap-1.5 border border-line px-2.5 py-1 text-[13px]">
              <ExternalLink href={l.href!} className="text-brand hover:underline">{l.k} ↗</ExternalLink>
              <CopyText value={l.href!} label={`${l.k} link`} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailRow({ k, children }: { k: string; children: ReactNode }) {
  if (children == null || children === false || children === "") return null;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-line/30 py-1">
      <span className="text-ink-faint">{k}</span>
      <span className="text-right text-ink-dim">{children}</span>
    </div>
  );
}
