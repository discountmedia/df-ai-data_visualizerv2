/**
 * Feature flags.
 *
 * FINANCIALS_ENABLED — the "Financials" (Sales Numbers / gross-profit) tab is
 * HIDDEN by owner request until further notice. While `false`:
 *   • the tab never appears in the nav and never renders,
 *   • public/fullnew.xlsx is NEVER fetched, so none of the GP / cost /
 *     commission / SPIFF / KPI figures are loaded into the browser, and
 *   • no field that lives only in fullnew is surfaced anywhere on the site.
 *
 * All the code stays in place. To re-enable: set this to `true` AND restore
 * public/fullnew.xlsx (it's deliberately kept out of the public deploy so the
 * sensitive figures aren't downloadable while the tab is hidden).
 */
export const FINANCIALS_ENABLED = false;

/**
 * AUTO_LOAD_BUNDLED — whether to auto-load the bundled test spreadsheets on
 * startup.
 *
 * In production the app waits for a PRO (FileMaker) push and shows a "waiting"
 * state until real data arrives — no stand-in test numbers ever ship. In
 * dev/local it auto-loads the bundled export so the dashboard is populated
 * without FileMaker. Override explicitly with NEXT_PUBLIC_AUTO_LOAD_BUNDLED
 * ("true" / "false").
 */
export const AUTO_LOAD_BUNDLED =
  process.env.NEXT_PUBLIC_AUTO_LOAD_BUNDLED != null
    ? process.env.NEXT_PUBLIC_AUTO_LOAD_BUNDLED === "true"
    : process.env.NODE_ENV !== "production";
