import type { UnitRecord, MediaCoverage, MediaLocationCoverage } from "./types";
import { locationBucket, LOCATION_BUCKETS } from "./location";

/**
 * Per-unit media coverage, rolled up from the inventory export's resolved
 * media fields (UnitRecord.specs.youtubeUrl = walkaround video, productUrl =
 * the unit's product page). Pure + deterministic — same units, same numbers.
 *
 * "withNeither" (no video AND no product page) is the headline gap: inventory a
 * shopper can't see online. This is fully joinable, so it honors the global
 * location filter (unlike the media-production tracker, which has no unit key).
 */

const has = (v: string | null | undefined): boolean => !!v && String(v).trim() !== "";

/**
 * A unit is "listable" (real, media-able inventory) if it carries any identity:
 * serial, name, make, model, or type. This filters out non-inventory rows that
 * leak into the export — round-robin queue rows and blank placeholders that have
 * NO serial/name/make — so they don't masquerade as "inventory missing media".
 */
export function isListable(u: UnitRecord): boolean {
  return has(u.serial) || has(u.serial4) || has(u.forkliftName) || has(u.name) || has(u.make) || has(u.model) || has(u.type);
}

export function deriveMedia(units: UnitRecord[]): MediaCoverage {
  let withVideo = 0, withProductPage = 0, withBoth = 0, videoOnly = 0, pageOnly = 0, withNeither = 0;

  const byLoc = new Map<string, MediaLocationCoverage>();
  for (const k of LOCATION_BUCKETS) {
    byLoc.set(k, { name: k, total: 0, withVideo: 0, withProductPage: 0, withBoth: 0, withNeither: 0 });
  }

  for (const u of units) {
    const v = has(u.specs.youtubeUrl);
    const p = has(u.specs.productUrl);
    if (v) withVideo++;
    if (p) withProductPage++;
    if (v && p) withBoth++;
    else if (v) videoOnly++;
    else if (p) pageOnly++;
    else withNeither++;

    const row = byLoc.get(locationBucket(u.location));
    if (row) {
      row.total++;
      if (v) row.withVideo++;
      if (p) row.withProductPage++;
      if (v && p) row.withBoth++;
      if (!v && !p) row.withNeither++;
    }
  }

  const byLocation = LOCATION_BUCKETS
    .map((k) => byLoc.get(k))
    .filter((r): r is MediaLocationCoverage => !!r && r.total > 0);

  return { total: units.length, withVideo, withProductPage, withBoth, videoOnly, pageOnly, withNeither, byLocation };
}
