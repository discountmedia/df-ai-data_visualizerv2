"use client";

import { useMemo, useState } from "react";
import type { UnitRecord, MediaProduction, MediaLocationCoverage } from "@/lib/types";
import { deriveMedia, isListable } from "@/lib/deriveMedia";
import { MetricCard } from "../overview/MetricCard";
import { StatCards } from "../viz/StatCards";
import { DistributionBar } from "../viz/DistributionBar";
import { MediaDrawer } from "./MediaDrawer";
import { EmptyState } from "../states/States";
import { fmt } from "@/lib/format";

const has = (v: string | null | undefined): boolean => !!v && String(v).trim() !== "";
const hasVideo = (u: UnitRecord) => has(u.specs.youtubeUrl);
const hasPage = (u: UnitRecord) => has(u.specs.productUrl);

/**
 * Media tab — content coverage + the marketing-production pipeline.
 *
 * Two clearly-separated sources (see lib/deriveMedia + deriveMediaProduction):
 *  - Per-unit COVERAGE (video + product page from the inventory export) — the
 *    KPI cards + by-yard bars + drill-down; honors the global location filter.
 *  - Media PRODUCTION pipeline (new-vals tracker) — company-wide counts with no
 *    unit key, shown separately and labeled as not filterable by yard.
 */
export function MediaView({ units, production }: {
  units: UnitRecord[];
  production?: MediaProduction;
}) {
  // Coverage is over LISTABLE inventory only — non-inventory rows (round-robin /
  // blank, no serial or make) would otherwise masquerade as "missing media".
  const listable = useMemo(() => units.filter(isListable), [units]);
  const cov = useMemo(() => deriveMedia(listable), [listable]);
  const [drill, setDrill] = useState<{ title: string; units: UnitRecord[] } | null>(null);
  if (units.length === 0) return <EmptyState title="No units for this filter" />;

  const excluded = units.length - listable.length;
  const open = (title: string, list: UnitRecord[]) => () => setDrill({ title, units: list });
  const pct = (n: number) => (cov.total ? Math.round((n / cov.total) * 100) : 0);
  const noVideo = listable.filter((u) => !hasVideo(u));
  const noMedia = listable.filter((u) => !hasVideo(u) && !hasPage(u));

  return (
    <>
      <div className="space-y-6 fade-up">
        <div>
          <p className="eyebrow text-brand">Media</p>
          <h1 className="mt-1 text-xl font-bold text-ink">Content coverage — what a shopper can actually see</h1>
        </div>

        {/* Per-unit coverage KPIs — clickable into the media drill-down */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <MetricCard label="Listable Inventory" metric={cov.total} accent="ink" subtext="Real units in this filter" onClick={open("Listable inventory", listable)} />
          <MetricCard label="Walkaround Video" metric={cov.withVideo} accent="ready" subtext={`${pct(cov.withVideo)}% have a video`} onClick={open("Has a walkaround video", listable.filter(hasVideo))} />
          <MetricCard label="Product Page" metric={cov.withProductPage} accent="rent" subtext={`${pct(cov.withProductPage)}% have a page`} onClick={open("Has a product page", listable.filter(hasPage))} />
          <MetricCard label="No Video" metric={noVideo.length} accent="working" subtext="Missing a walkaround" onClick={open("Missing a walkaround video", noVideo)} />
          <MetricCard label="No Media at All" metric={noMedia.length} accent="diag" subtext="Invisible online — fix" onClick={open("No video and no product page", noMedia)} />
        </div>
        {excluded > 0 && (
          <p className="-mt-3 text-[12px] text-ink-faint">
            {fmt(excluded)} non-inventory {excluded === 1 ? "row" : "rows"} (round-robin / blank — no serial or make) excluded from coverage.
          </p>
        )}

        {/* Coverage by yard — same location-filtered population as the cards above,
            so the bars always reconcile with the KPI numbers. */}
        {cov.byLocation.length > 0 && (
          <section>
            <h2 className="eyebrow mb-3">Coverage by Yard</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cov.byLocation.map((l) => (
                <div key={l.name} className="card p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="truncate text-sm font-bold text-ink">{l.name}</span>
                    <span className="text-[13px] text-ink-faint">{fmt(l.total)} units</span>
                  </div>
                  <div className="mt-2">
                    <DistributionBar segments={yardSegments(l)} legend />
                  </div>
                  {l.withNeither > 0 && (
                    <p className="mt-1 text-[12px] text-diag">{fmt(l.withNeither)} with no media</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Media-production pipeline (new-vals) — company-wide, NOT per-unit */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="eyebrow">Media Production Pipeline</h2>
            <span className="text-[12px] text-ink-faint">company-wide · not filtered by yard</span>
          </div>
          {production?.available ? (
            <div className="mt-3">
              <StatCards cols={3} items={[
                { label: "Photos Resized & Edited", value: production.photosResized, accent: "ready", sub: "post-production complete" },
                { label: "Sign-off Video Uploaded", value: production.videoUploaded, accent: "rent", sub: "upload step marked done" },
                { label: "Marketing Shoot Needed", value: production.marketingShootNeeded, accent: "diag", sub: "still needs a photo shoot" },
              ]} />
              <p className="mt-2 text-[12px] text-ink-faint">
                {fmt(production.tracked)} rows tracked. {production.notes[0]}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-[13px] text-ink-faint">Media-production tracker not loaded for this export.</p>
          )}
        </section>
      </div>
      {drill && <MediaDrawer title={drill.title} units={drill.units} onClose={() => setDrill(null)} />}
    </>
  );
}

/** Partition a yard's units into video+page / video-only / page-only / none. */
function yardSegments(l: MediaLocationCoverage) {
  return [
    { label: "Video + page", value: l.withBoth, cls: "bg-ready" },
    { label: "Video only", value: l.withVideo - l.withBoth, cls: "bg-rent" },
    { label: "Page only", value: l.withProductPage - l.withBoth, cls: "bg-working" },
    { label: "No media", value: l.withNeither, cls: "bg-diag" },
  ];
}
