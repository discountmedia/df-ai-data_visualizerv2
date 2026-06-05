import type { ParsedFile, CellValue, MediaProduction } from "./types";

/**
 * Aggregate media-production status from new-vals.xlsx. That export carries
 * three media-workflow columns (photo edit / final-sign-off video upload /
 * marketing-shoot-needed) but NO unit key, and a positional join against the
 * inventory export's shared video column was tested and does not hold — so these
 * are surfaced as company-wide counts only, never attributed to specific units.
 *
 * Column names are matched structurally (never hardcoded), matching the rest of
 * the data layer. Pure + deterministic.
 */

const present = (v: CellValue): boolean => v != null && String(v).trim() !== "";

export function deriveMediaProduction(parsed: ParsedFile): MediaProduction {
  const empty: MediaProduction = {
    available: false, tracked: 0, photosResized: 0, videoUploaded: 0, marketingShootNeeded: 0,
    notes: ["No media-production data found in this export."],
  };

  const cols = parsed.columns;
  const find = (re: RegExp) => cols.find((c) => re.test(c)) ?? null;
  const photoCol = find(/photo.*resiz|resiz.*photo|photo.*edit/i);
  const videoCol = find(/sign.?off\s*video|video\s*upload/i);
  const shootCol = find(/market.*shoot|shoot.*need|mktg.*shoot/i);

  if (!photoCol && !videoCol && !shootCol) {
    return { ...empty, notes: ["No recognizable media-production columns in new-vals."] };
  }

  const rows = parsed.rows;
  // Rows carrying ANY media-production signal (the export pads with blank rows).
  const tracked = rows.filter((r) =>
    (photoCol && present(r[photoCol])) || (videoCol && present(r[videoCol])) || (shootCol && present(r[shootCol]))
  ).length;

  // All three columns are presence/status flags (each holds a single affirmative
  // token or null), so count them the same way — presence — for consistency and
  // robustness to a relabeled done-marker in a future PRO export.
  const photosResized = photoCol ? rows.filter((r) => present(r[photoCol])).length : 0;
  const videoUploaded = videoCol ? rows.filter((r) => present(r[videoCol])).length : 0;
  const marketingShootNeeded = shootCol ? rows.filter((r) => present(r[shootCol])).length : 0;

  return {
    available: tracked > 0,
    tracked,
    photosResized,
    videoUploaded,
    marketingShootNeeded,
    notes: [
      "From the media-production tracker (new-vals). These statuses have no unit key, so they are company-wide totals — not attributable to specific units or filterable by yard.",
    ],
  };
}
