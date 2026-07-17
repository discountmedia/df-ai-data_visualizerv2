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
 * PRODUCTION NEVER auto-loads: it always waits for a PRO (FileMaker) push and
 * shows the "waiting" state until real data arrives — no stand-in test numbers,
 * and (importantly) NO attempt to fetch the bundled test xlsx (which are stripped
 * from `public/` anyway). This is HARD-FORCED off in prod regardless of any env
 * var — `NEXT_PUBLIC_*` values are inlined at build time and must never be able to
 * turn the test-data load back on in production.
 *
 * In dev/local it auto-loads the bundled export so the dashboard populates without
 * FileMaker; set NEXT_PUBLIC_AUTO_LOAD_BUNDLED="false" to turn that off in dev too.
 */
export const AUTO_LOAD_BUNDLED =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_AUTO_LOAD_BUNDLED !== "false";
