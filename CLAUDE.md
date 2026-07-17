# CLAUDE.md — Discount Forklift Inventory Intelligence

Project context for an AI agent picking this up cold. Read this first, then
`README.md` (human overview) and `Discount Forklift Design System/` (the brand /
visual rules — non-negotiable; see "House rules").

## What this is

An internal **operations dashboard** for Discount Forklift, a used-forklift
dealer. It ingests a messy, multi-table inventory export and renders a dark,
clean (Inter-typeset) "command center" — fleet KPIs with click-through
drill-downs, a service pipeline, a deterministic priority queue, a sales-team
board, and an opt-in multi-model AI read on top.

The data is **schema-agnostic**: column names are never hardcoded. Structure is
inferred at runtime (heuristic instantly, then Claude refines it), and every
view derives from that inferred schema.

## Stack & commands

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · Recharts ·
SheetJS (`xlsx`) · PapaParse (PRO CSV parse) · Anthropic SDK · Web Crypto (auth gate).

```bash
npm install
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit — run this after edits
npm run build       # production build (Vercel runs this)
```

There is no test suite. **Verify changes with `npm run typecheck` + a production
build.** For a real render check, the data layer can be exercised in Node (parse
**both** bundled xlsx with `xlsx`, `mergeSources` them, then run the
`lib/derive*`/`lib/score` functions); the UI is best checked with a headless
screenshot (Chrome `--headless`, or `puppeteer-core` pointed at the local
Chrome) of `next start` or the deployed URL.

## How it runs (important — this is unusual)

**No upload splash, no schema-review screen.** How data arrives depends on the
environment, gated by `AUTO_LOAD_BUNDLED` (`lib/features.ts`: default `true` in
dev, `false` in production; override with `NEXT_PUBLIC_AUTO_LOAD_BUNDLED`):

- **Production → waits for a PRO push.** The app shows a "waiting for PRO"
  state (`WaitingState`) and renders only once **PRO** — Discount Forklift's
  **FileMaker Pro** system — pushes the data into the Web Viewer. Nothing is
  auto-loaded; no stand-in numbers ever ship to prod. See "PRO integration" below.
- **Dev / local → auto-loads the bundled test export.** It fetches the **two**
  bundled spreadsheets, merges them, and lands straight on the dashboard so the UI
  is populated without FileMaker. The bundled xlsx are stand-in test data used *as
  if they were live PRO data*. (In the waiting state, a dev-only "Simulate PRO
  push" button reprojects the bundled data into the PRO CSV contract and drives
  the real ingest path — `simulateProPush`.)

Do not reintroduce an upload/landing page as the default entry. Both paths
converge on one no-review ingest (`DashboardProvider → ingestParsed`): the instant
heuristic schema is shown, then the AI refine is swapped in behind it.

Bundled auto-load sequence (`components/DashboardProvider.tsx → loadAutoData`, **dev only**):

1. `fetch` **both** `/CURATEDV2-TESTING.xlsx` (rich inventory — the primary table,
   72 cols incl. Forklift Name, Serial 4, Mast, heights, media URLs) and
   `/CuratedFields-TEST.xlsx` (entity tables `email::`/`Staff::`/`round_robin::` +
   Fuel type + "Sales Names Sold by"). Parse each with SheetJS, then
   `mergeSources(v2, v1)` (`lib/mergeSources.ts`) joins them by **`Record UUID`**
   into one `ParsedFile` (V2 primary; V1 fills missing columns + carries entities).
2. `detectEntities` — split stacked tables by `prefix::` convention.
3. `heuristicSchema(rows)` — **instant**, client-side. Dispatch `INFERRING`
   (sets `parsed` + `entities`) **then** `READY_WITH_SCHEMA` (same tick) → the
   dashboard shows real numbers immediately. The "⚡ refining" header pill shows.
4. Background `inferSchemaClient` → `/api/infer-schema` (Claude) → `UPGRADE_SCHEMA`
   swaps the sharper AI schema in **without** disturbing the active tab/filter.
5. In parallel (non-blocking), `fetch` `/new-vals.xlsx` → `deriveMediaProduction`
   → `SET_MEDIA` for the Media tab's production-pipeline counts. Optional: the tab
   degrades gracefully if it's absent (mirrors the gated `fullnew.xlsx` fetch).

> ⚠️ **The #1 bug that has bitten this:** `READY_WITH_SCHEMA` only sets `schema`.
> If `parsed`/`entities` aren't set first, `app/page.tsx`'s
> `if (!parsed || !schema) return null` blanks the whole app (black screen).
> Always dispatch `INFERRING` before `READY_WITH_SCHEMA`.

## Architecture & data flow

```text
CURATEDV2 + CuratedFields ─parse + mergeSources(Record UUID)→ ParsedFile ─detectEntities→ EntitySet (base + email/staff/round_robin)
                                              │
                       heuristicSchema / Claude (inferSchemaClient) → SchemaProfile
                                              │
   deriveUnits → UnitRecord[] ─splitOctaneUnits→ {df, octane}   deriveSales → SalesSummary   deriveMetrics → OverviewMetrics
        │                                                       scoreUnits → ScoringResult
        └──────────────── all views render from these; AI only narrates ──────────────────┘
```

- **`lib/entities.ts`** partitions a sheet into the base (inventory) table plus
  prefixed entity tables (`email::`, `Staff::`, `round_robin::`). The base export
  here is ~40k rows total but only ~1,325 are inventory; entity splitting keeps
  the unit views reading the right rows.
- **`lib/deriveUnits.ts` / `deriveSales.ts` / `deriveMetrics.ts` / `score.ts`**
  are pure and deterministic. Column resolution goes through `conceptMap` +
  structural regex patterns, never hardcoded names. **Same export → same output,
  every time.**
- **`lib/deriveUnits.ts`** buckets each unit's **work stage from curated service
  checkpoints** (Diagnosed / Serviced / Final-sign-off / Equipment-on-rent /
  SOLD!), not a single status column — far more accurate than value-mapping one
  column. It also resolves the title fields (Forklift Name, Serial 4, year, fuel)
  and a `specs` block (mast, fork length, lowered/raised height, tires, hours,
  attachments, product/YouTube URLs) for the accordion drawers.
- **`lib/octane.ts`** splits OCTANE (a sub-brand, `Make === "OCTANE"`) out of the
  DF fleet so its ~89 units never blend into DF metrics; it gets its own bare tab.
- **`lib/location.ts`** buckets `FOB State`/location into the 4 main yards
  (Denver/Las Vegas/Phoenix/DFW) + "Other"; the global `LocationBar` filters on it.
- **`lib/categories.ts` / `categoryConfig.ts` / `pivot.ts`** power the *legacy*
  per-category router + "Find connections" explorer — **off the live render path**
  now (the live nav is the fixed tab set below). Keep, don't assume live.

## Navigation / tabs

`app/page.tsx` renders a **fixed tab** nav — **Overview · Work Stage ·
Sales Team · Media · OCTANE · Logs** — not one-tab-per-category. (The **Admin** tab
was removed from the nav 2026-07-17; `components/admin/AdminUploads.tsx` + the
`/admin` route still exist but are reachable only by direct URL — see "Data uploads
(Neon)" below.) (The old per-category router in `lib/categoryConfig.ts` +
`components/tabs/CategoryTab.tsx` + the `*Tab.tsx` layouts is **legacy and off the
live render path**; keep but don't assume live.)

> **UI overhaul (2026-07-17) — cross-cutting, live on `mainv2`.** Full record:
> `docs/UI_OVERHAUL_PLAN.md`. Key primitives + behaviors a fresh agent must know:
> - **`components/ui/DataTable.tsx`** is the ONE table shell — `SortHeader` +
>   25/page `Pager` + optional search box + a `ColDef` API (`render`, `sortValue`,
>   `href` link cells, `copy` click-to-copy cells, `printValue`) + a **Print / PDF**
>   button + accessible **expandable rows**. Every unit table renders through it
>   (`UnitsDrawer`, `MediaDrawer`, the Priority-Queue ranked list, Sales
>   `SoldUnitsDrawer` + Unsigned worklist). Don't hand-roll `<table>`s anymore.
> - **`components/ui/Drawer.tsx`** — the one full-screen modal shell (focus trap,
>   aria-modal, Esc-close, focus restore). The drill-down drawers compose it.
> - **`components/units/UnitDetail.tsx`** — the canonical unit view (specs +
>   click-through **and** copyable listing/video URLs). Opened from KPI drawers,
>   expandable rows, and search.
> - **Every KPI card in the app is clickable** → opens a drawer table of exactly
>   those units (Overview, Work Stage, Media, OCTANE, Sales [Total Sold / Total
>   Sales $ / Unsigned], the Priority-Queue tier cards, and the Overview + Work
>   Stage act-now banners).
> - **`components/GlobalSearch.tsx`** — sticky header combobox searching every unit
>   (serial/name/make/model/year/price/fuel/customer/soldBy) → `UnitDetail`.
> - **`components/ui/CopyText.tsx`** — click-to-copy (right-click is disabled in
>   prod), used for serials/customer/soldBy/URLs.
> - **In-app Back/Forward** (‹ ›) in the Header — a pointer-based `{tab, location}`
>   history in `DashboardProvider` (`navHistory`/`navPointer`,
>   `NAV_BACK`/`NAV_FORWARD`). No History API, no reload (won't trip the no-refresh
>   deterrent). Drawers still close via ✕ / Esc.
> - Layout widened `max-w-7xl` → **`max-w-[1600px]`** (Header/main/LocationBar/
>   Drawer) for the fixed PRO canvas; the location bar is filled chips (visually
>   distinct from the underline nav); per-tab IA was reordered (methodology moved
>   off Overview, queue-first on Work Stage, gap-first Media, etc.).
> - **Print-to-PDF** (`lib/printTable.ts`, isolated hidden-iframe `window.print()`)
>   still needs on-device confirmation the FileMaker Web Viewer shows a "Save as
>   PDF" dialog.

- **Overview** (`components/overview/OverviewGrid.tsx`): KPI cards (work-stage +
  payment buckets) + charts + per-yard snapshot + opt-in AI Insights. Every KPI
  card is **clickable → `UnitsDrawer`** (`components/overview/UnitsDrawer.tsx`), a
  searchable, 25/page table of the exact units behind that number — filtered by
  the *same* bucket `deriveMetrics` counts, so a card and its drawer can never disagree.
- **Work Stage** (`components/tabs/WorkStageView.tsx`): the **service pipeline**
  (`components/viz/ReconPipeline.tsx` — journey bar + bottleneck call-out) +
  readiness legend + priority queue. **All yards incl. "Other"** (owner ask) —
  shares Overview's location-filtered population + scoring; an empty filter shows a
  clear empty state.
- **Sales Team** (`components/sales/SalesTeam.tsx`): Roster sidebar (click a name
  → contact card: email/phone/location/units), Sales Race, Deal Close Health,
  Outreach-vs-Closes dual-axis chart, paginated leaderboard, round-robin,
  unsigned-doc chase, + opt-in AI (`SalesAI`). **Location-filterable** (owner ask):
  the global pill bar scopes the team to one yard **by each rep's home department**
  (DENVER SALES → Denver, etc.); KPIs/leaderboard/roster/race recompute from the
  in-scope reps. Round-robin + lead sources stay company-wide (queue/source totals,
  not per-rep). `SalesTeam` takes a `locationFilter` prop and derives a scoped
  `view` of the `SalesSummary` internally. *(2026-07-17: KPI cards Total Sold /
  Total Sales $ / Unsigned Docs drill into a `SoldUnitsDrawer`; the aggregates
  (Avg Sale, Reps Active) aren't clickable; the **"Emails Sent" KPI was removed**
  and the **"Unsigned Docs" KPI is hidden on the ALL + Other scopes**; the Unsigned
  worklist was hoisted above the reference band and the AI panel moved to the
  bottom. `SoldUnit` now carries `serial4`/`productUrl`/`youtubeUrl`.)*
- **Media** (`components/media/MediaView.tsx`): content-coverage command center.
  Two deliberately-separate sources. (1) Per-unit **coverage** — walkaround video +
  product-page URL from `UnitRecord.specs`, via `lib/deriveMedia.ts` — drives the
  clickable KPI cards (→ `MediaDrawer`, a sortable table with click-through
  video/page links) + the by-yard bars, and honors the location filter. Each yard
  card's "**N with no media**" line is a button → `MediaDrawer` of exactly those
  units for that yard. (2) The
  media-**production** pipeline (`public/new-vals.xlsx` → `lib/deriveMediaProduction.ts`)
  is shown as **company-wide counts only** — that export has **no unit key** (a
  positional join was tested and fails at ~4%), so it's explicitly labeled "not
  filtered by yard". Coverage is computed over **listable** units (`isListable`)
  so leaked round-robin / blank rows don't masquerade as "missing media", and the
  excluded count is disclosed. No AI on this tab.
- **OCTANE** (`components/tabs/OctaneView.tsx`): bare stat cards for the OCTANE
  sub-brand, kept out of DF metrics.
- **Financials** (`components/financials/SalesNumbersView.tsx`) — a gross-profit /
  "sales numbers" tab built from `public/fullnew.xlsx` (`lib/deriveFinancials.ts`:
  per-unit GP = sold − cost, 5 company-wide KPI constants, GP by year/yard,
  distribution). **HIDDEN by owner request behind `FINANCIALS_ENABLED` in
  `lib/features.ts` (currently `false`).** While off: no nav tab, no render, and
  `fullnew.xlsx` is never fetched — so none of the GP/cost/commission/SPIFF/KPI
  figures reach the browser. `fullnew.xlsx` is gitignored + removed from `public/`
  so the sensitive figures aren't downloadable. To re-enable: flip the flag to
  `true` AND restore `public/fullnew.xlsx`. (Data-honesty notes baked into
  `deriveFinancials`: `$0` sold prices are treated as not-sold; "GP Month" is
  unusable so "Date paid" is the time axis; OCTANE excluded from aggregates.)

- A global **location-filter pill bar** (`LocationBar.tsx`) filters Overview +
  Work Stage + Sales Team + Media + OCTANE — 4 yards (Denver/Las Vegas/Phoenix/DFW)
  + Other. Hidden on Financials + Admin. Tab badges use *unfiltered* totals so they don't jump on
  filter clicks. The nav tabs **and** this pill bar share one active treatment:
  brand-red underline + red active count (kept consistent on purpose).
- Long lists paginate **25/page** via the shared `components/ui/Pager` (priority
  queue, sales leaderboard, unsigned docs, the drill-down) and carry a search box.
- **"In Service"** is the agreed term for the service/recon pipeline — never use
  "recon" in user-facing copy (component is still named `ReconPipeline` internally).
- Unit titles read **`#<serial4> <forkliftName> · <year> <make> <type>`**
  (`unitTitle` in `components/tabs/shared.ts`; `PriorityRow` in `PriorityQueue.tsx`).

**Dedup principle (still enforced):** each chart/view has exactly ONE home —
Overview owns the headline distributions, Work Stage owns the pipeline + queue,
Sales Team owns the rep board + chase list. Don't reintroduce a view on two tabs.

## Data uploads (Neon) — DORMANT (superseded by the PRO push)

> **Status (owner decision):** the PRO/FileMaker push (above) renders in-memory
> per session, so Neon is no longer needed for any current feature. This whole
> path is left **dormant, not deleted** — it's a harmless no-op without
> `DATABASE_URL` (the route 503s), the Admin tab is already marked temporary, and
> keeping it makes persistence/history a re-enable rather than a rebuild
> (persistence is a "next logical step", not a go-live requirement). Everything
> below still describes how it works if `DATABASE_URL` is set.

The **Admin** tab / `/admin` route persists the daily report to **Neon
Postgres**. This predates the PRO push (it was a manual-upload stopgap).

- **`lib/db.ts`** — `neon()` HTTP client (server-only; `DATABASE_URL`) + idempotent
  `ensureSchema()` (`CREATE TABLE IF NOT EXISTS`, no migration step). Two tables:
  `inventory_rows` (`inventory_id` PK · full row as **JSONB** · `content_hash` ·
  audit fields) and `uploads` (`uploaded_by` default `Admin` · `uploaded_at` ·
  counts · `source`).
- **`lib/ingestCsv.ts`** — pure parse of CSV/xlsx → `{inventory_id, data, hash}`.
  Key = the id parsed from the **`Product Server URL`** (`…/inventory/8265`); the
  `Record UUID` is unusable (Excel mangles it to scientific notation). Rows with no
  URL id are skipped; same-id rows within one file collapse (last wins).
- **`app/api/upload/route.ts`** — `POST` upserts via `ON CONFLICT (inventory_id)
  DO UPDATE … WHERE content_hash <> EXCLUDED.content_hash`: unchanged rows ignored,
  changed updated, new inserted; counts recorded. `GET` returns last-upload + history.
- **`components/admin/AdminUploads.tsx`** — the panel (no auth yet; open to anyone),
  used by both the tab and the `/admin` route. Has a **Load test data** button that
  seeds from the bundled `CURATEDV2-TESTING.xlsx`.
- Requires `DATABASE_URL`; without it `/api/upload` returns a clear 503.

## Where AI is used (the business reads are opt-in)

**Nothing is sent to any model for the business reads until the user clicks** —
both are gated behind a button.

1. **Schema inference** — `/api/infer-schema` (Claude, `lib/anthropic.ts`),
   heuristic fallback in `lib/profile.ts`. Runs automatically in the background to
   refine the instant heuristic schema — but it's *schema-only*, no business
   numbers are interpreted.
2. **AI Insights (Overview)** — `/api/insights` (Claude only via `lib/anthropic.ts`,
   heuristic fallback in `lib/insightsClient.ts`). Opt-in via the **"Run AI
   Analysis"** button (`components/insights/InsightsTab.tsx`). *(The Grok + GPT
   second-opinion ensemble — `lib/secondOpinions.ts` — was removed; Claude is the
   sole analyzer.)*
3. **Sales Team summarize** — `components/sales/SalesAI.tsx` wraps the per-tab
   `SummarizePanel` → `/api/summarize` (Claude). Opt-in; sends only already-
   aggregated stats, never raw rows / customer PII.
4. **Find connections** — `/api/connect` (Claude) → `PivotSpec`, computed
   deterministically by `lib/pivot.ts`. Part of the *legacy* explorer path.

**Hard rule: AI never computes numbers or ranks units.** Scoring and all metrics
are deterministic; AI is a narrative/interpretation layer only.

## PRO integration (FileMaker Web Viewer — do not break the contract)

**PRO is Discount Forklift's FileMaker Pro system**, which runs this app inside a
**Web Viewer** (WebView2/Chromium on Windows) and **pushes** it the data. The
contract is defined by the company's lead developer (see
`InventoryAnalysis_JavaScript_Guide.html`). This is **not** a postMessage/iframe
handshake — FileMaker calls global `window` functions by name and we call back via
`FileMaker.PerformScriptWithOption`. The app can **NEVER pull/request data from
PRO**; it only receives a push and replies with a receipt.

**The bridge** is a **pre-hydration inline script** (`lib/proBridgeScript.ts →
PRO_BRIDGE_SCRIPT`, injected into `<head>` by `app/layout.tsx`) — plain JS, not a
React component, so the globals FileMaker calls by name exist from initial page
parse (before hydration). PRO pushes **only after our `ready` ping** (no
timer/cron), and FileMaker re-polls `fileMakerReady()` until it gets the ping, so
the handshake is race-free. It installs three global functions (names are
contract, case-sensitive):

- `fileMakerReceive(jsonString)` — FileMaker calls this with one JSON string
  `{ requestId, inventoryCsvData, staffCsvData }`. We validate both CSV blocks are
  present, send exactly one receipt (`alreadySent` guard), then hand the payload
  to the data layer — buffered on `window.__proPayload` **and** dispatched as a
  `pro:payload` event (`DashboardProvider` drains the buffer on mount and listens
  for later pushes, so a payload is caught whether it lands before or after mount).
- `fileMakerSend(requestId, responseAction, responseMessage)` — the receipt (all
  strings). Wraps `FileMaker.PerformScriptWithOption('Inventory Analysis Return',
  json, '5')` (option `'5'` = Suspend and Resume, the only one that runs the
  callback immediately). Deviation from the guide: the no-bridge branch
  `console.warn`s instead of writing to `document.body` (that would wipe the React
  root). `responseAction` ∈ `"success" | "error" | "ready"`.
- `fileMakerReady()` — health-check ping (`requestId: "health_check"`), sent last.

**The data contract** — two **headerless** CSV blocks with **fixed positional
columns** (order is part of the contract). `lib/fromProPayload.ts →
parseProPayload` maps them into the normal `ParsedFile`: 36 inventory columns
(`Record UUID`…`Photos Resized`), and 5 staff columns (`NAME, DEPARTMENT, TITLE,
EMAIL, DIRECT`) re-emitted under a `Staff::` prefix so `detectEntities` treats
them as the roster. Parsed with **PapaParse** (matches the guide's own parser).
All values are strings; empty → null. If FileMaker's export order changes, update
the arrays in `fromProPayload.ts`. (Staff is now this flat 5-field table only —
no `round_robin::`/`email::`/media-production feed — so Sales Team's activity
views degrade to empty states; EMAIL + DIRECT feed the contact card.)

**Hosted-mode auth gate** (`middleware.ts` + `lib/authToken.ts`) — the Web Viewer
loads us over https with a signed URL `?payload=<base64url>&signature=<hex>`
(payload = `inventory-analysis|<utcMillis>|<account>`; signature =
HMAC-SHA256 of the base64url payload with a shared secret). The middleware
(Edge runtime → **Web Crypto**, not node `crypto`) verifies the signature
(constant-time), the project (`inventory-analysis`), and a **60-second freshness
window**, then issues a self-signed HttpOnly session cookie (`df_pro_session`,
12h, stateless — no DB) and 307-redirects with the token stripped from the URL.
Subsequent requests pass on the cookie; `_next`/favicon/logo stay ungated.
Enablement via `gateEnabled()`: on in production when `INVENTORY_ANALYSIS_SECRET`
is set, off in dev (set `AUTH_GATE=on` to test locally), and off + warn if no
secret (fail-open, so a missing var can't brick the app). Verified against the
guide's reference signature vector. **After deploy, opening the prod URL directly
returns 401 by design** — the only way in is a fresh FileMaker-signed link.

> ⚠️ **The prod gate is temporarily OFF** (`AUTH_GATE=off` in Vercel) so the owner
> can view/style the deployed site during UI work — prod root currently returns
> 200 and is publicly viewable. **Revert to `AUTH_GATE=on` (or delete the var) +
> redeploy before go-live.** The secret is correct and unchanged; the "bad
> signature / FUCKYOU" the dev saw was his own deliberate gate test (the gate
> correctly rejected it), not a mismatch — don't re-diagnose it as a secret bug.

## Logs / observability (`/logs`)

A `/logs` viewer (`components/logs/LogsView.tsx`) records auth / performance /
system / error events to a Neon `logs` table in real time. Access is **not a
password** — it's the **same HMAC signed-URL method as the PRO gate** plus an
account allowlist (`LOGS_ACCOUNTS`, e.g. `matt`): open `/logs?payload=…&signature=…`
whose `account` is allowlisted → `middleware.ts → handleLogsAccess` verifies, issues
a `df_logs_session` cookie (8h), strips the token. `/logs` + `/api/logs` are exempt
from the FileMaker gate. Every request re-checks the allowlist (removing a name
revokes it). Logged: IP, user-agent (**FileMaker UAs flagged** — a FileMaker UA on
our public URL is a potential leak), **all headers except cookie/authorization**,
gate allow/deny, logs login ok/denied, and **HMAC/signature rejections as alerts**
(`gate.signature.rejected` etc. — feed the red `LogsAlertBadge` bubble; they carry
the received `rxPayload`/`rxSignature` in `meta` for diagnostics). Perf comes from
the AI routes wrapped with `withLogging` (`lib/apiLog.ts`); client events (PRO push)
post to `/api/logs/event`. Retention: keep everything, no cron. Helpers in
`lib/logsAuth.ts`; store in `lib/logStore.ts`. Needs `DATABASE_URL` +
`INVENTORY_ANALYSIS_SECRET`; without them the viewer 503s.

**Public mode (2026-07-17):** `logsPublic()` (`lib/logsAuth.ts`) opens the viewer
to anyone — the `/api/logs`, `/api/logs/auth`, `/api/logs/event` routes skip the
session + allowlist checks when it returns true. `LOGS_PUBLIC=true` forces it on,
`=false` forces it off, and **unset → follows the gate** (public whenever the
FileMaker gate is off — it mirrors `middleware.gateEnabled()` — and auto-secures
the moment `AUTH_GATE=on` + secret is set). So with the gate currently off, `/logs`
+ the Logs tab are public (verified live). ⚠️ Public mode exposes IPs / UAs /
headers / access events — testing only; the go-live gate flip re-secures it.

## Web Viewer deterrents (prod-only — deterrents, not enforcement)

The owner wanted the Web Viewer locked down. Shipped (deterrents only — the
authoritative reload/DevTools kill-switches live on the WebView2 host object and
are **not** reachable from page JS or by the FileMaker dev):

- **No-store caching** — `middleware.ts` stamps `Cache-Control: no-store` on EVERY
  response (pages, the 307 token-strip redirect, the 401 denied page); `/_next/static`
  stays `immutable` (excluded by `config.matcher`). This is the single source of
  cache headers (the old `next.config` `headers()` block was removed).
- **`HARDEN_SCRIPT`** (inline in `app/layout.tsx <head>`, `NODE_ENV==="production"`
  only so dev keeps its tools): capture-phase `preventDefault` on `contextmenu` +
  keydown for F12 / Ctrl/Cmd+Shift+I/J/C / Ctrl/Cmd+U (DevTools/view-source) and
  F5 / Ctrl/Cmd+R / Ctrl+Shift+R (keyboard refresh).
- **`overscroll-behavior-y: contain`** on `html, body` (kills pull-to-refresh).
- **Vercel Analytics** (`@vercel/analytics`).

Because right-click is disabled, **click-to-copy** (`components/ui/CopyText.tsx`)
and **in-app Back/Forward** history nav (‹ › in the Header, backed by a pointer
over a `{tab, location}` stack in `DashboardProvider`) were shipped 2026-07-17.

## House rules (from the Design System — apply to all UI)

Read `Discount Forklift Design System/{README.md,CLAUDE.md,colors_and_type.css}`.

- **Dark theme default. UI font is Inter** (`--font-sans`, loaded in
  `app/layout.tsx`). Big stat numerals ONLY use the **Anton** condensed display
  face (`font-display`).
  > ⚠️ The Design System doc still says "everything monospace (IBM Plex Mono)";
  > the switch to **Inter** is an intentional owner override — keep Inter, do not
  > reinstate the terminal monospace. The dark color theme is unchanged.
- **Brand red `#ff2b2b` is scarce** — logo, 2px top-rule, primary action, active
  tab/filter, act-now. Status palette is semantic and fixed (ready/working/diag/
  rent + pif/downpmt/govt) — see `lib/buckets.ts` and `tailwind.config.ts`.
- **NO pie/donut charts.** Bars, stacked bars, scatter, and CSS `DistributionBar`
  only. (A `DonutChart` was added and then deleted for violating this — don't
  bring it back.)
- **Icons are Unicode glyphs** (`⚠ ⚡ ↥ → ✓ ○ ☀ ☾ ↑ ↓ ↕ ▾ ▸ ● · —`). No icon
  fonts, no SVG icon sets, no decorative emoji.
- Cards: `--panel` bg, 1px `--line` border, 6px radius, almost no shadow. Copy is
  terse, imperative, honest about confidence ("heuristic" vs "AI" badges).
- Shared viz primitives live in `components/viz/`; reuse them.

## Accessibility (WCAG 2.2 AA — keep it conformant)

The app is verified to **0 axe-core violations** (WCAG 2.0/2.1/2.2 A+AA) on every
tab + the drill-down drawer + light theme. Don't regress it:

- **Status colors are theme-aware CSS vars** (`--ready`/`--working`/… as RGB
  channels in `globals.css`, surfaced via Tailwind `rgb(var(--x)/<alpha>)`). The
  dark values are vivid; the **light values are darkened** so color-as-text clears
  4.5:1 on white. Add a new status color in BOTH theme blocks, not as a raw hex.
- **Solid white-on-red buttons use `bg-brand-strong`** (`#e0202a`), not `bg-brand`
  (`#ff2b2b` only reaches 3.7:1 with white). `text-brand`/`border-brand` accents on
  dark still use `--brand`.
- `--ink-faint` (#84848c dark) and `--line` (#646470 dark) are tuned to pass
  4.5:1 (text) / 3:1 (borders). Don't darken them.
- **No clickable `<div>`/`<tr>`** — interactive rows are real `<button>`s (or
  `role="button"` + `tabIndex={0}` + Enter/Space `onKeyDown` + `aria-expanded`).
  Sortable `<th>` wrap a `<button>` + `aria-sort`.
- **Never `outline-none` without a replacement.** A global
  `:focus-visible { outline: 2px solid rgb(var(--brand)) }` lives in `globals.css`;
  don't suppress it on inputs/buttons.
- Inputs need an `aria-label`; icon-only buttons (✕, ☀/☾) need one too; decorative
  Unicode glyphs get `aria-hidden`. Recharts charts get `role="img"` + a data
  `aria-label` (see `OverviewCharts`/`EmailsChart`/`ChartPanel`'s `ariaLabel`).
- The `UnitsDrawer` modal traps focus, restores it on close, has `aria-modal` +
  `aria-labelledby`, and Esc-closes — keep that if you touch it.
- `globals.css` has a `prefers-reduced-motion` block; there's a skip-link in
  `app/page.tsx` to `#main-content`. Re-verify after UI changes with the axe run
  (`.axe.js` pattern: puppeteer-core + axe-core against `next start`).

## Directory map

```text
middleware.ts           Edge gate — wraps the FileMaker signed-URL/session gate + logs signed-token access; stamps Cache-Control: no-store on EVERY response; logs allow/deny + signature rejections via ev.waitUntil → /api/logs/ingest
app/
  layout.tsx            root layout — fonts (Inter + Anton), pre-hydration PRO bridge <script> in <head>, prod-only HARDEN_SCRIPT deterrents, <Analytics/>, provider
  page.tsx              entry — waits for PRO (prod) / auto-loads bundled (dev), fixed tab nav, location filter
  globals.css           design tokens (--ground/--panel/--ink…), grid texture, fade-up, overscroll-behavior-y: contain (kills pull-to-refresh)
  error.tsx / global-error.tsx   error boundaries (so a render error never black-screens)
  logs/page.tsx         standalone /logs viewer (renders LogsView; signed-token + LOGS_ACCOUNTS allowlist, gate-exempt)
  api/{infer-schema,insights,connect,summarize}/route.ts
  api/logs/{ingest,auth,route,alerts,event}/route.ts   log ingest + logs-auth check + query + alert-bubble poll + client event sink
components/
  DashboardProvider.tsx state machine (useReducer): idle→ready/waiting, ingestParsed (bundled + PRO), pro:payload listener, activeTab, location filter, nav history (back/forward)
  Header.tsx            logo, GlobalSearch slot, Back/Forward (‹ ›), AI Analysis (secondary), tabs, "updating numbers" pill
  GlobalSearch.tsx      sticky header unit search (accessible combobox → UnitDetail)
  overview/             OverviewGrid + MetricCard (clickable) + UnitsDrawer (KPI drill-down)
  charts/               OverviewCharts (sales-by-payment + brand bars)
  tabs/                 WorkStageView · OctaneView · shared.ts (unitTitle); legacy CategoryTab/*Tab router
  viz/                  shared primitives: ChartPanel, StatCards, CategoryBars, ReconPipeline (service pipeline), DistributionBar, chartTheme
  sales/                SalesTeam + SalesAI (opt-in summarize)
  media/                MediaView (coverage + production pipeline) + MediaDrawer (links drill-down)
  priority/             PriorityQueue (clickable tier KPIs + act-now banner → drawer; sortable DataTable ranked list; score breakdown + specs in the row expand)
  insights/             AiAnalysisModal (header → company-wide read) + AiAnalysisCard (per-tab, opt-in) + AiInsightsBody (shared); InsightsTab = deterministic scoring methodology
  logs/                 LogsView (typed sub-tabs, sortable, paginated, meta drill-down) + LogsAlertBadge (red bubble: FileMaker-UA + denied logins)
  ui/                   Pills, Pager (25/page), SortHeader, CopyText (click-to-copy), DataTable (the shared sortable/searchable/paginated table — link + copy cells, Print/PDF, expandable rows), Drawer (shared focus-trap modal shell)
  units/                UnitDetail (canonical unit-detail view — specs + copyable serial/URLs)
lib/                    types, parseFile, mergeSources (Record-UUID join), fromProPayload (PRO CSV→ParsedFile),
                        proBridgeScript (pre-hydration FileMaker bridge, injected in layout head),
                        authToken (HMAC-SHA256 gate + session cookie), logsAuth (LOGS_ACCOUNTS allowlist helpers),
                        logStore (Neon logs read/write) + apiLog (safeLog / withLogging), profile (heuristic),
                        bucketize, buckets, entities, location, octane,
                        deriveUnits/deriveSales/deriveMetrics, deriveFinancials,
                        deriveMedia/deriveMediaProduction, score, categories,
                        categoryConfig, pivot, anthropic, *Client.ts, printTable (isolated-iframe print→PDF), format, features, sampleData
public/                CURATEDV2-TESTING.xlsx (primary inventory) + CuratedFields-TEST.xlsx (entities)
                       + new-vals.xlsx (media-production tracker), logo.png, favicon.ico
Discount Forklift Design System/   brand system + UI kit reference (not built by next)
```

Legacy but present: the per-category router (`tabs/CategoryTab.tsx` + `*Tab.tsx`),
`components/explore/`, `components/FileUpload.tsx`, `lib/sampleData.ts`, and
`components/all/AllUnits.tsx` are not wired into the live tab nav; keep or
reuse, don't assume they're live.

## Environment variables (set in Vercel)

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude — schema inference + insights + summarize + connect. Heuristic fallback without it. |
| `ANTHROPIC_MODEL` | optional, default `claude-sonnet-4-6` |
| `INVENTORY_ANALYSIS_SECRET` | **Shared secret for the hosted-mode auth gate** (HMAC-SHA256 signed-URL verification — see "PRO integration"). 64 hex chars, from the lead dev; server-only, never `NEXT_PUBLIC_`. When set in production the gate is ON; unset → gate OFF (fail-open). |
| `AUTH_GATE` | optional override: `"on"` / `"off"`. Default: on in production (if the secret is set), off in dev. Set `AUTH_GATE=on` locally to test the gate. |
| `NEXT_PUBLIC_AUTO_LOAD_BUNDLED` | optional `"true"`/`"false"` — force the bundled-data auto-load on/off. Default: on in dev, off in production (prod waits for a PRO push). |
| `LOGS_ACCOUNTS` | comma-separated account names allowed into `/logs` (e.g. `matt`), case-insensitive. Access is a signed link (same HMAC method as the gate) whose `account` is on this list; needs `INVENTORY_ANALYSIS_SECRET` (to verify) + `DATABASE_URL` (to read logs). Removing a name revokes access on the next request. |
| `LOGS_PUBLIC` | optional `"true"`/`"false"`. `true` opens `/logs` + the Logs tab to **anyone** (no signed link / allowlist); `false` forces it gated. **Unset → follows the auth gate** (public whenever the gate is off, auto-secured when `AUTH_GATE=on` + secret). ⚠️ Public mode exposes IPs/UAs/headers — testing only. |
| `DATABASE_URL` | Neon Postgres. **Now used by the logs viewer** (the `logs` table records in real time). Still dormant for the Admin CSV uploads (`/api/upload`). Without it the logs viewer + upload route 503; nothing else is affected. (`POSTGRES_URL` is accepted as an alias.) |

(The `XAI_*` / `OPENAI_*` keys are no longer used — the Grok/GPT second-opinion
analyzers were removed. Safe to delete from Vercel.)

All keys are server-side only (read inside API routes), never exposed to the
browser. Locally, put them in `.env.local` (gitignored).

## Deploy

Production branch is **`mainv2`**; pushing it triggers the Vercel git integration
(project `df-ai-data-visualizerv2`, scope `discountforkliftmedia`). Required
Vercel build settings: **Root Directory `.`**, **Framework Next.js**, **Output
Directory default** (NOT `app`/`Other`/`public` — those caused 404s). Verify a
deploy with `vercel ls df-ai-data-visualizerv2` + curl the production domain.

Pushes from the working machine go over **SSH using a deploy key**, because the
authenticated GitHub tokens lack write access to the repo.

## Known gotchas

- **Black screen** → almost always the `parsed`/`entities` not-set bug above, or a
  render throw with no boundary (we added `app/error.tsx`).
- **`next dev` caches `public/` at startup** — after adding a file to `public/`,
  restart the dev server or it 404s (production is fine).
- **Heuristic schema is instant but coarse** (work-stage/sale buckets); some
  counts (e.g. SOLD, NEEDS DIAGNOSIS) sharpen when the background AI refine lands
  and the badge flips heuristic → AI.
- **xAI/OpenAI are OpenAI-compatible REST**, called via `fetch` (no SDK). Model
  names change fast — they're env-configurable; verify with `GET /v1/models`.
- Recharts `ResponsiveContainer` needs a fixed-height parent (`ChartPanel`
  provides it); `isAnimationActive={false}` everywhere.
