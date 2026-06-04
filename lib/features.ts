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
