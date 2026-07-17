# UI Overhaul Plan — "De-clunk" + owner feature requests

Generated 2026-07-17 from a 7-surface fan-out audit (Overview · Work Stage · Sales
Team · Media · OCTANE/Admin · App shell/nav · Shared primitives). Companion to
`docs/UI_CONSISTENCY_AUDIT.md` (the earlier design-system consistency queue) — this
doc is the **information-architecture / "feels clunky"** overhaul plus the owner's
concrete feature requests.

## Status

- **Phase 1 (foundations): DONE + verified** — `ui/CopyText`, `ui/DataTable` (sort/page/search/link/copy/**Print-PDF**/expand), `ui/Drawer`, `units/UnitDetail`, `lib/printTable`, `SoldUnit` enrichment. typecheck + production build clean.
- **Phase 2 (features wired): DONE + verified** — `UnitsDrawer` + `MediaDrawer` on `DataTable`; OCTANE cards now drill in; Sales "Unsigned — Chase These" on `DataTable` with Customer + Listing columns; per-rep drill enriched; **global sticky header search** (`GlobalSearch`). typecheck + build clean. ⚠️ Not yet eyeballed live.
- **Phase 3 (IA reorg + layout): HIGH-SEVERITY PASS DONE + verified** — shell widened to `max-w-[1600px]`; AI button demoted to ghost secondary; "refining" pill → "Updating numbers…"; inferring copy → "Reading your inventory…"; location bar restyled to filled chips (distinct from the underline nav); Overview grids labelled (Work stage / Payment status), "Sold" accent neutralised, yard snapshot hoisted, AI moved below the facts, scoring methodology removed from the landing page; Work Stage reordered (pipeline → queue → explainer → AI); Sales unsigned worklist hoisted + KPI row regrouped + AI to bottom; Media cards gap-first + yards worst-first; OCTANE lifecycle-ordered + neutral Sold + its own yard counts in the location bar. typecheck + build clean.
  - **Remaining Phase 3 polish (medium/low):** tab-bar segmentation (business | internal), in-content view title, location bar inert-not-hidden on non-scoped tabs, ReconPipeline triple-redundancy collapse, unify "$ Behind the Shop" ≡ "Act Now", payment-type chart de-dup, Sales race↔leaderboard link + roster↔leaderboard unify, rep email/phone click-to-copy on the contact card, Admin reorg.

## Decisions locked (owner, 2026-07-17)

- **Sequence:** Foundations → Features → IA reorg. Build shared primitives first, wire
  the feature requests through every table, then reorder/regroup tab-by-tab.
- **Layout:** Design for the **fixed PRO Web Viewer canvas (~1900×1030, landscape, PC)**.
  Use the horizontal space and cut scroll depth — the app is currently locked to
  `max-w-7xl` (1280px) and wastes ~600px of side gutter while stacking everything
  vertically. This is the single biggest "clunky" multiplier on the real canvas.
  (Confirm exact Web Viewer pixel size; assume ~1900×1030 until then.) No mobile/
  responsive juggling required — it is one target size, but keep it from breaking narrower.

## Why it feels clunky — 5 root causes (from the audit)

1. **Inverted hierarchy** — the eye lands on the wrong thing. Optional AI button is the
   loudest element (scarce brand-red); "Sold" is painted the same alarm-red as "Needs
   Diagnosis"; the most-urgent list is dead-last on Work Stage, Sales, and Media.
2. **Redundancy** — the same number appears 2–3× per tab (work-stage counts ×3 on Work
   Stage; ReconPipeline encodes 5 counts in 3 visual languages; "$ Behind the Shop" =
   "Act Now" across two tabs; payment chart re-plots the payment cards; Admin shows the
   latest upload twice).
3. **Dead-end drill-downs** — click a number → flat table → no listing link, no video, no
   action, can't copy (right-click disabled in prod). OCTANE cards aren't clickable at all.
4. **Nav doesn't orient** — tab bar and location bar share the identical active treatment
   and stack, reading as one control; 7 flat tabs mix daily views + sub-brand + internal
   tooling; tab counts each mean a different thing; no in-content "you are here" title.
5. **Wasted canvas** — `max-w-7xl` + vertical stacking on a ~1900px screen = empty gutters
   + deep scroll.

Full finding-level detail (file:line, severity, proposal) lives in the audit workflow
journal for this session; the per-tab tasks below fold in every high/med finding.

---

## Phase 1 · Foundations (shared primitives) — DO FIRST

Every live table is hand-rolled (5×), so features would otherwise be built 5×. Build
these once; Phases 2–3 compose them.

- [ ] **`components/ui/CopyText.tsx`** — click-to-copy hover affordance. Renders text (or
  children) with a hover-revealed copy control (`navigator.clipboard.writeText`), an
  `aria-label` ("Copy <field>"), and a `✓ copied` confirmation (sanctioned glyph). Real
  `<button>`, keyboard-operable. Icon-rule note: no "copy" glyph exists in the sanctioned
  Unicode set, so use a compact `copy`/`✓` text affordance, not a new glyph.
- [ ] **Shared `components/ui/DataTable.tsx`** — generic table: composes existing
  `SortHeader` + `Pager` (25/page), a `ColDef` API (`key, header, render?, sortValue?,
  href?` → link cell, `copy?` → wrap in CopyText, `numeric?`, `padClass?`), an optional
  search box, and a header-level **Print-to-PDF** button. Retire dead `viz/Leaderboard.tsx`.
- [ ] **`components/units/UnitDetail.tsx`** — the ONE canonical unit view: `unitTitle`,
  full `specs` block (mast, fork length, lowered/raised height, tires, hours, attachments,
  warehouse), `soldBy`/`customer`/`price`/signed, and click-through **+ copyable**
  `productUrl`/`youtubeUrl`. Extract from the PriorityQueue accordion (already ~this).
  Every entry point (KPI drawer, table row, global search) opens this.
- [ ] **Data fix — `lib/deriveSales.ts`**: propagate `serial4` + `productUrl` +
  `youtubeUrl` onto `SoldUnit` (currently dropped at deriveSales.ts:199-209) so the sales
  tables can show a listing link + real unit identity.
- [ ] **Print-to-PDF approach (SPIKE — has unknowns in the locked WebView2):** verify how
  printing works in the FileMaker Web Viewer. `window.print()` + a print stylesheet that
  isolates the target table is the first attempt; Ctrl+P is blocked by `HARDEN_SCRIPT`, so
  the button must trigger print programmatically. Fallback: a dedicated printable render.
  Resolve this before wiring #5 broadly.

## Phase 2 · Features wired through the tables

- [ ] **#4 Listing/product URL in every unit table** — via `ColDef.href`. UnitsDrawer,
  Sales per-rep drill-down + Unsigned worklist (needs Phase-1 data fix); MediaDrawer +
  PriorityQueue already render links (add copy).
- [ ] **#6 Salesman + customer columns on sold/down-payment cuts** — UnitsDrawer: when
  `drill.title` is a Sold / Paid-in-Full / Down-Payment / Open-Work-on-Sold cut, add
  **Sold by** + **Customer** columns (`soldBy`/`customer` already on every row). Sales
  Unsigned table already has Rep → add **Customer**.
- [ ] **#3 Click-to-copy** — apply CopyText to serials, product/YouTube URLs, rep
  email/phone (add `tel:`), customer names, round-robin assignee across all tables + the
  Sales contact card.
- [ ] **#5 Print-to-PDF button** per table (once the spike resolves).
- [ ] **#1 Canonical unit drill-down** — KPI drawers + table rows open `UnitDetail`.
- [ ] **#2 Global sticky search** — header input, persists on every tab; matches units on
  name/serial/year/make/model/price/fuel/customer/soldBy; result → opens `UnitDetail`.

## Phase 3 · Information-architecture reorg (per tab) + layout

Layout: widen the content container toward the PRO canvas and compose blocks
side-by-side to cut scroll depth (decision above).

**App shell / nav**
- [ ] Differentiate nav vs location bar (nav = underline tabs; location = filled segmented
  chips with a "Location:" lead) so they don't read as one control.
- [ ] Segment the tab bar: business tabs left, divider, then OCTANE/Admin/Logs right (or
  Admin+Logs behind an overflow/gear) — stop internal tooling competing with ops.
- [ ] Demote the AI button to a bordered/ghost secondary (reserve solid red for active
  tab/filter). Plain-language + de-glyph the "refining" pill; move it out of the action
  cluster so the header doesn't reflow.
- [ ] Add an in-content view title (e.g. "Sales Team — Denver"); keep the location bar
  mounted-but-inert (not unmounted) on tabs where it doesn't apply.
- [ ] Plain-language, visually-distinct loading/waiting/inferring states ("Reading your
  inventory…" not "Inferring schema with AI…"). Drop/qualify heterogeneous tab counts.

**Overview**
- [ ] Label the two KPI grids ("Work stage" / "Payment status"); fix "Sold" accent to
  neutral (not diag-red); make the work-stage row reconcile to Total Fleet (or surface an
  explicit "Unclassified"). Hoist the yard snapshot up under the KPIs; move the scoring
  methodology block off Overview to Work Stage; move AI below the facts; de-dup the
  payment-type chart (it re-plots the payment cards); route AlertBanner + "Open Work on
  Sold" to the scored priority queue, not a flat drawer.

**Work Stage**
- [ ] Queue first (move ReadinessLegend below it / fold into a "How is this ranked? ▸"
  disclosure in the queue header); hoist the Act-Now banner above the KPI cards. Kill the
  triplicated work-stage counts (one home each). Unify "$ Behind the Shop" ≡ "Act Now"
  (one label; card click → Act-Now tier of the queue). Move AI to the end. Elevate the row
  action text over the score.

**Sales Team**
- [ ] Move the Unsigned "Chase These" worklist up (under the leaderboard / KPIs, above the
  reference band) + add a Customer column; wire the "Unsigned Docs" KPI to it. Move AI to
  the bottom. Group the KPI row (sales / team / the one warning). When emails unavailable,
  drop the dead Emails KPI + column + chart gap. Link Sales Race ↔ leaderboard; unify
  roster-select ↔ leaderboard-expand so a rep is one interaction.

**Media**
- [ ] Gap-first card order (No-Media / No-Video first, demote "Listable Inventory" to a
  context label); collapse the redundant video complement. Hard-separate the production
  tracker block + relabel so it can't collide with per-unit coverage. Sort yard cards
  worst-first; make the red "no media" segment/count the click target into the drawer.

**OCTANE**
- [ ] Make the cards clickable → a `DataTable` of the underlying OCTANE units (unblocks
  URL/print/salesman on the OCTANE side). Lifecycle card order (Total → In Service → Ready
  → On Rent → Committed → Sold). Feed the location bar `bucketedLocations(octane)` (or hide
  it). Trim the repeated "separate" boilerplate.

**Admin (TEMP)** — low priority (tab is slated for removal)
- [ ] Lead with the Upload CTA; merge the duplicated "Last upload" into the history table's
  top row; match the app's max width.

---

### Print-to-PDF & global search are the two items with real unknowns
Everything else is composition + display of data already in memory. The print spike and
the search UX are the two to prototype early so they don't surprise us late.
