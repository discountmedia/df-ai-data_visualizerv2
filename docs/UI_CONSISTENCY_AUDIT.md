# UI / UX Consistency Audit — Work Queue

Generated 2026-07-15 from a 5-agent audit (interactive controls · cards & typography · nav/states/drawers · charts/viz · API & formatting), judged against the design-system canon in `CLAUDE.md` and the `Discount Forklift Design System/` folder.

**How to use:** work top-down. **P1** first (live-path a11y — protects the "0 axe violations" guarantee), then **P2** (live visible inconsistency), then **P3** (DRY consolidations that erase whole classes of drift). **P4–P6** are legacy/off-path, the temporary Admin tab, and cosmetics — lower priority, batch them when convenient.

**Tags:** effort **S** (<30 min) / **M** (~1–2 hr) / **L** (half-day+). **LIVE** = on the rendered tab set; **LEGACY** = off the live render path per CLAUDE.md (fix only if reactivated); **GATED** = behind `FINANCIALS_ENABLED`; **TEMP** = Admin tab (slated for removal).

**Quick wins that clear multiple findings:** P3-1 (shared stat-card) resolves P2-1 + P2-2; P3-2 (shared `SortHeader`) resolves three duplicates; P3-3 (focus-trap hook) resolves the modal-a11y drift.

Totals: **1 High a11y (live)** · ~14 live inconsistencies · 6 DRY consolidations · the rest legacy/temp/cosmetic.

---

## P1 · Live-path accessibility (do first)

- [ ] **Nested interactive controls in the priority-queue row.** `PriorityRow` is a `role="button"` `<div>`; when expanded it contains real `<a>` links (product page / walkaround video) → axe `nested-interactive`. Rebuild as a real `<button>` toggle with the detail as a **sibling** row, mirroring `RepRow`/`GPRow`. — [PriorityQueue.tsx:160-241](components/priority/PriorityQueue.tsx#L160), [:281-289](components/priority/PriorityQueue.tsx#L281) · **High · M · LIVE**
- [ ] **Disclosure toggle missing `aria-expanded`.** The Show/Hide button doesn't announce state. — [ReadinessLegend.tsx:36](components/ReadinessLegend.tsx#L36) · **Med · S · LIVE**
- [ ] **Tier filter chips don't expose active state.** `FilterChip` conveys active visually only; add `aria-pressed` (as `LocationBar`/roster buttons do). — [PriorityQueue.tsx:321-333](components/priority/PriorityQueue.tsx#L321) · **Med · S · LIVE**

## P2 · Live-path visible inconsistency

- [ ] **KPI numeral size differs on every tab** (`text-5xl` / `text-4xl` / `text-3xl→4xl`); the Media tab shows two sizes at once (coverage `MetricCard` vs production `StatCards`). Pick one headline size — best fixed via **P3-1**. — [MetricCard.tsx:24](components/overview/MetricCard.tsx#L24), [StatCards.tsx:44](components/viz/StatCards.tsx#L44), [SalesTeam.tsx:449](components/sales/SalesTeam.tsx#L449), [PriorityQueue.tsx:315](components/priority/PriorityQueue.tsx#L315), [SalesNumbersView.tsx:187](components/financials/SalesNumbersView.tsx#L187) · **High(visible) · M · LIVE**
- [ ] **`card-hover` on non-clickable cards** implies a click affordance that isn't there (canon: hover only when clickable). — [SalesTeam.tsx:447](components/sales/SalesTeam.tsx#L447), [PriorityQueue.tsx:313](components/priority/PriorityQueue.tsx#L313), [SalesNumbersView.tsx:185](components/financials/SalesNumbersView.tsx#L185) · **Med · S · LIVE**
- [ ] **Raw hex in the two live charts** → use tokens. `#3aa0ff` → `PALETTE[1]`; `#ff8a3d` → `SALE_HEX.paid_in_full`. — [OverviewCharts.tsx:111](components/charts/OverviewCharts.tsx#L111), [SalesTeam.tsx:336-337](components/sales/SalesTeam.tsx#L336) · **Med · S · LIVE**
- [ ] **`OverviewCharts` re-declares the shared chart theme** (`AXIS`/`GRID`/`ChartTip`/`Panel`) instead of importing `chartTheme` + `ChartPanel` — a drift-prone shadow copy. — [OverviewCharts.tsx:19-50](components/charts/OverviewCharts.tsx#L19) · **Med · S · LIVE**
- [ ] **Unsigned-PandaDocs list has no search box** though it paginates + sorts (canon: paginated lists carry a search box). — [SalesTeam.tsx:612-676](components/sales/SalesTeam.tsx#L612) · **Med · M · LIVE**
- [ ] **`fmt`/`fmtMoney` bypasses** (raw `.toLocaleString()` on counts) on live surfaces. — [ReconPipeline.tsx:39](components/viz/ReconPipeline.tsx#L39),52,80,90-92; [Pager.tsx:21](components/ui/Pager.tsx#L21); [UnitsDrawer.tsx:101](components/overview/UnitsDrawer.tsx#L101); [MediaDrawer.tsx:93](components/media/MediaDrawer.tsx#L93); [PriorityQueue.tsx:249](components/priority/PriorityQueue.tsx#L249) (capacity); [Header.tsx:65](components/Header.tsx#L65); [AlertBanner.tsx:8](components/AlertBanner.tsx#L8) · **Med · M · LIVE**
- [ ] **`PriorityRow` re-implements `unitTitle` and has drifted** (drops the ` · <fuel>` suffix, wrong `serial` fallback) → call `unitTitle(u)`. — [PriorityQueue.tsx:154-156](components/priority/PriorityQueue.tsx#L154) · **Med · S · LIVE**
- [ ] **`ReadinessLegend` section header breaks the eyebrow convention** — 16px bold sentence-case `<h2>` (only live section header that isn't `.eyebrow`); its inner boxes use ad-hoc borders instead of `.card`. — [ReadinessLegend.tsx:38](components/ReadinessLegend.tsx#L38),49,64 · **Med · S · LIVE**
- [ ] **`✦` glyph is outside the sanctioned Unicode icon set.** — [AiAnalysisCard.tsx:47](components/insights/AiAnalysisCard.tsx#L47), [AiAnalysisModal.tsx:101](components/insights/AiAnalysisModal.tsx#L101), [SummarizePanel.tsx:23](components/tabs/SummarizePanel.tsx#L23) · **Low · S · LIVE**

## P3 · DRY consolidations (each erases a class of drift)

- [ ] **P3-1 · One shared stat-card primitive.** The eyebrow+numeral+subtext card is reimplemented 5×; consolidate to `StatCards`/`MetricCard`. Resolves P2-1 (size) and P2-2 (hover). — [MetricCard.tsx](components/overview/MetricCard.tsx), [StatCards.tsx](components/viz/StatCards.tsx), [SalesTeam.tsx:445](components/sales/SalesTeam.tsx#L445), [PriorityQueue.tsx:311](components/priority/PriorityQueue.tsx#L311), [SalesNumbersView.tsx:183](components/financials/SalesNumbersView.tsx#L183) · **Med · M**
- [ ] **P3-2 · One sortable header.** `ui/SortHeader` (with `padClass`) already exists and is used by both drawers; `SalesTeam` and `SalesNumbers` each re-implement it. Consolidate. — [SalesTeam.tsx:455-484](components/sales/SalesTeam.tsx#L455), [SalesNumbersView.tsx:202-220](components/financials/SalesNumbersView.tsx#L202) · **Med · M**
- [ ] **P3-3 · One focus-trap/modal-a11y hook.** Three copies of the trap effect; the `AiAnalysisModal` copy already drifted (its focusable selector omits `select`/`textarea`). Extract `useModalA11y`. — [UnitsDrawer.tsx:43](components/overview/UnitsDrawer.tsx#L43), [MediaDrawer.tsx:42](components/media/MediaDrawer.tsx#L42), [AiAnalysisModal.tsx:53-64](components/insights/AiAnalysisModal.tsx#L53) · **Med · M**
- [ ] **Inline `SalePill` should match the `Pills` `base`** (missing `tracking-wide`/`whitespace-nowrap`). — [SalesTeam.tsx:546-554](components/sales/SalesTeam.tsx#L546) · **Low · S**
- [ ] **One Pager visibility rule.** Five lists gate the Pager five different ways (always / `>0` / `>PAGE`). — Pager call sites in UnitsDrawer, MediaDrawer, SalesTeam, PriorityQueue, SalesNumbersView · **Low · S**
- [ ] **Dedupe `FilterChip`** (byte-identical in PriorityQueue + legacy AllUnits). — [PriorityQueue.tsx:321](components/priority/PriorityQueue.tsx#L321), [AllUnits.tsx:206](components/all/AllUnits.tsx#L206) · **Low · S**

## P4 · Legacy / off-path (fix only if reactivated)

- [ ] **`bg-brand` white-text buttons fail contrast** (~3.7:1) → `bg-brand-strong`. — [CategoryExplorer.tsx:113](components/explore/CategoryExplorer.tsx#L113), [SchemaReview.tsx:228](components/SchemaReview.tsx#L228) · **High-if-live · S · LEGACY**
- [ ] **Clickable `<th onClick>` with no button/keyboard/`aria-sort`.** `Leaderboard` is **dead code** (unimported) — delete it; fix `AllUnits` only if revived. — [AllUnits.tsx:220-234](components/all/AllUnits.tsx#L220), [Leaderboard.tsx:45-49](components/viz/Leaderboard.tsx#L45) · **Med-if-live · S · LEGACY**
- [ ] **`ScatterPanel` (shared primitive, used by legacy tabs) has no `role="img"`/`aria-label` and an inline hex tooltip** instead of `ChartTip`. — [ScatterPanel.tsx:12-49](components/viz/ScatterPanel.tsx#L12) · **a11y-if-live · M · LEGACY**
- [ ] **`CategoryExplorer`:** redeclares the palette, inline hex tooltip, chart not in `ChartPanel` (no `role=img`/label), search input missing `aria-label` + weak focus. — [CategoryExplorer.tsx:12-14](components/explore/CategoryExplorer.tsx#L12),103-109,162-185 · **Med-if-live · M · LEGACY**
- [ ] **Legacy category tabs omit chart `ariaLabel`** (would regress 0-axe if reactivated). — LocationTab, MetricTab, WorkStageTab, SaleTypeTab, OtherTab · **a11y-if-live · M · LEGACY**
- [ ] **`TabAI` disclosure missing `aria-expanded`.** — [TabAI.tsx:31](components/tabs/TabAI.tsx#L31) · **Low · S · LEGACY**
- [ ] **`LocationTab` manual `$` concat** in a chart aria-label. — [LocationTab.tsx:95](components/tabs/LocationTab.tsx#L95) · **Low · S · LEGACY**
- [ ] **`chartTheme.PALETTE[0]` is brand red** — the largest single-series bar renders brand-red, in tension with "red is scarce." Design-token judgment call. — [chartTheme.tsx:9](components/viz/chartTheme.tsx#L9) · **Low · S**

## P5 · Admin tab (TEMP — minimal effort, or skip until it's replaced)

- [ ] **Buttons diverge from canonical primary/secondary** (shape/weight/case). — [AdminUploads.tsx:189](components/admin/AdminUploads.tsx#L189),197 · **Med · S · TEMP**
- [ ] **Bypasses the `States` components** (ad-hoc loading/error/empty). — [AdminUploads.tsx:143](components/admin/AdminUploads.tsx#L143),156,191,206,243 · **Med · M · TEMP**
- [ ] **`rounded` corners (rest of app is square) + missing `tabular-nums` + `<th>` without `scope`.** — [AdminUploads.tsx:172](components/admin/AdminUploads.tsx#L172),150,217-223,234-236 · **Low · S · TEMP**

## P6 · Cosmetic / very low

- [ ] **Section-card padding `p-5` → `p-4`** (norm). — ReadinessLegend:35, AiAnalysisModal:97, AdminUploads:141/161/211 · **Low · S**
- [ ] **Section-header element mix** (`<h2>` vs `<p>` for the same `.eyebrow` role) — pick one for the a11y outline. · **Low · M**
- [ ] **Eyebrow bottom-margin drift** (`mb-2`/`mb-3`/`mb-4`/none). · **Low · S**
- [ ] **Header ↔ LocationBar micro-drift:** `gap-1.5` vs `gap-2`; `aria-current` vs `aria-pressed`; `toLocaleString` vs `fmt`. — [Header.tsx:56](components/Header.tsx#L56), [LocationBar.tsx:19](components/LocationBar.tsx#L19) · **Low · S**
- [ ] **Standardize focus indicator** on `focus-visible:ring-1 ring-brand` (clickable KPI cards use border-color-only). — MetricCard:39, StatCards:59 · **Low · S**
- [ ] **Search-box width varies** (`w-80`/`w-64`/`w-56`). · **Low · S**
- [ ] **In-table "no match" copy inconsistent** across the 5 tables. · **Low · S**
- [ ] **`RepRow` silent truncation** — `units.slice(0, 30)` with no "+N more". — [SalesTeam.tsx:524](components/sales/SalesTeam.tsx#L524) · **Low · S**
- [ ] **API client nits:** `inferSchemaClient` lacks the empty-result guard its siblings have; catch-block typing drift across clients. — [inferSchemaClient.ts:29](lib/inferSchemaClient.ts#L29) · **Low · S**
- [ ] **Financials inline unit title + `Mini` ad-hoc card/label** (uses `bg-panel-2`, non-eyebrow label). — [SalesNumbersView.tsx:236](components/financials/SalesNumbersView.tsx#L236),193-199 · **Low · S · GATED**

---

### Corroboration notes (multiple audits independently flagged these)
- Duplicate sortable header → flagged by 3 audits (P3-2).
- Stat-card reimplementation + KPI numeral drift → 2 audits (P2-1, P3-1).
- `OverviewCharts` shadow chart-theme → 2 audits (P2-4).

### Clean / exemplary (no action — keep as the reference patterns)
Header & LocationBar active treatment · `UnitsDrawer`/`MediaDrawer` full modal a11y + parity · opt-in AI buttons (`AiAnalysisCard`, `SummarizePanel`) using `bg-brand-strong` · the four API clients' error-handling parity · `CategoryBars`/`ChartPanel`/`DistributionBar`/`StatCards` primitives · no pie/donut anywhere · "In Service" terminology · the `h1` page-title pattern.
