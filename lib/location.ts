/**
 * Discount Forklift runs 4 yards: Denver, Las Vegas, Phoenix, DFW. Everything
 * else (customer ship-to, in-production, misc) buckets to "Other". Works on the
 * messy `FOB City and State` strings and on `Staff::DEPARTMENT` labels alike.
 */

import type { UnitRecord, LocationSnapshot } from "./types";

export type LocationBucket = "Denver" | "Las Vegas" | "Phoenix" | "DFW" | "Other";
export const LOCATION_BUCKETS: LocationBucket[] = ["Denver", "Las Vegas", "Phoenix", "DFW", "Other"];

export function locationBucket(raw: string | null | undefined): LocationBucket {
  if (!raw) return "Other";
  const s = String(raw).toLowerCase();
  if (/\bdenver\b|\bden\b|colorado|\bco\b/.test(s)) return "Denver";
  if (/vegas|nevada|\bnv\b/.test(s)) return "Las Vegas";
  if (/phoenix|arizona|\baz\b/.test(s)) return "Phoenix";
  if (/\bdfw\b|dallas|arlington|fort\s*worth|\bkaty\b|houston|texas|\btx\b/.test(s)) return "DFW";
  return "Other";
}

/** Per-yard snapshot (the 4 yards + Other) with work-stage counts, for the bar + filter. */
export function bucketedLocations(units: UnitRecord[]): LocationSnapshot[] {
  const m = new Map<LocationBucket, LocationSnapshot>();
  for (const u of units) {
    const k = locationBucket(u.location);
    const s = m.get(k) ?? { name: k, total: 0, ready: 0, working: 0, needs_diagnosis: 0, on_rent: 0, sold: 0 };
    s.total += 1;
    if (u.work !== "unknown") (s as unknown as Record<string, number>)[u.work] += 1;
    m.set(k, s);
  }
  return LOCATION_BUCKETS.map((b) => m.get(b)).filter((x): x is LocationSnapshot => !!x);
}
