import type { UnitRecord } from "./types";

/**
 * OCTANE is a separate part of the company — its inventory and metrics must NOT
 * be combined with normal Discount Forklift numbers. It's tagged on units by
 * `Make = "OCTANE"`, and on staff/email/leads by department "OCTANE",
 * the @OctaneForklifts.com domain, or "OCTANE Direct" lead sources.
 */

const OCTANE_RE = /octane/i;

export const isOctane = (v: string | null | undefined): boolean => !!v && OCTANE_RE.test(v);

export const isOctaneUnit = (u: UnitRecord): boolean => isOctane(u.make);

/** Split inventory into normal Discount Forklift units and OCTANE units. */
export function splitOctaneUnits(units: UnitRecord[]): { df: UnitRecord[]; octane: UnitRecord[] } {
  const df: UnitRecord[] = [];
  const octane: UnitRecord[] = [];
  for (const u of units) (isOctaneUnit(u) ? octane : df).push(u);
  return { df, octane };
}
