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
SheetJS (`xlsx`) · Anthropic SDK · xAI + OpenAI via OpenAI-compatible REST.

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

**No upload splash, no schema-review screen.** On load the app immediately
fetches the **two** bundled spreadsheets, merges them, parses, and lands straight
on the dashboard. This is intentional: in production an external system called
**PRO** will push the data; the bundled xlsx files are stand-in test data, used
*as if they were live PRO data*. Do not reintroduce an upload/landing page as the
default entry.

Auto-load sequence (`components/DashboardProvider.tsx → loadAutoData`):

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
  now (the live nav is the fixed 4 tabs below). Keep, don't assume live.

## Navigation / tabs

`app/page.tsx` renders a **fixed four-tab** nav — **Overview · Work Stage ·
Sales Team · OCTANE** — not one-tab-per-category. (The old per-category router in
`lib/categoryConfig.ts` + `components/tabs/CategoryTab.tsx` + the `*Tab.tsx`
layouts is **legacy and off the live render path**; keep but don't assume live.)

- **Overview** (`components/overview/OverviewGrid.tsx`): KPI cards (work-stage +
  payment buckets) + charts + per-yard snapshot + opt-in AI Insights. Every KPI
  card is **clickable → `UnitsDrawer`** (`components/overview/UnitsDrawer.tsx`), a
  searchable, 25/page table of the exact units behind that number — filtered by
  the *same* bucket `deriveMetrics` counts, so a card and its drawer can never disagree.
- **Work Stage** (`components/tabs/WorkStageView.tsx`): the **service pipeline**
  (`components/viz/ReconPipeline.tsx` — journey bar + bottleneck call-out) +
  readiness legend + priority queue. **Main yards only** — units bucketing to
  "Other" are excluded (`dfMain` in `app/page.tsx`) and the "Other" location pill
  is hidden here; an empty filter shows a clear empty state.
- **Sales Team** (`components/sales/SalesTeam.tsx`): Roster sidebar (click a name
  → contact card: email/phone/location/units), Sales Race, Deal Close Health,
  Outreach-vs-Closes dual-axis chart, paginated leaderboard, round-robin,
  unsigned-doc chase, + opt-in AI (`SalesAI`). **Company-wide** — the location bar
  is hidden here.
- **OCTANE** (`components/tabs/OctaneView.tsx`): bare stat cards for the OCTANE
  sub-brand, kept out of DF metrics.

- A global **location-filter pill bar** (`LocationBar.tsx`) filters Overview +
  Work Stage + OCTANE — 4 yards (Denver/Las Vegas/Phoenix/DFW) + Other. Hidden on
  Sales Team. Tab badges use *unfiltered* totals so they don't jump on filter clicks.
- Long lists paginate **25/page** via the shared `components/ui/Pager` (priority
  queue, sales leaderboard, unsigned docs, the drill-down) and carry a search box.
- **"In Service"** is the agreed term for the service/recon pipeline — never use
  "recon" in user-facing copy (component is still named `ReconPipeline` internally).
- Unit titles read **`#<serial4> <forkliftName> · <year> <make> <type>`**
  (`unitTitle` in `components/tabs/shared.ts`; `PriorityRow` in `PriorityQueue.tsx`).

**Dedup principle (still enforced):** each chart/view has exactly ONE home —
Overview owns the headline distributions, Work Stage owns the pipeline + queue,
Sales Team owns the rep board + chase list. Don't reintroduce a view on two tabs.

## Where AI is used (the business reads are opt-in)

**Nothing is sent to any model for the business reads until the user clicks** —
both are gated behind a button.

1. **Schema inference** — `/api/infer-schema` (Claude, `lib/anthropic.ts`),
   heuristic fallback in `lib/profile.ts`. Runs automatically in the background to
   refine the instant heuristic schema — but it's *schema-only*, no business
   numbers are interpreted.
2. **AI Insights (Overview)** — `/api/insights` runs a **multi-model ensemble**:
   Claude (primary) + Grok + GPT (second opinions) **in parallel**, side by side
   with a "where they diverge, look closer" note. `lib/secondOpinions.ts` is
   provider-agnostic, key-gated, isolates failures. Opt-in via the **"Run AI
   Analysis"** button (`components/insights/InsightsTab.tsx`).
3. **Sales Team summarize** — `components/sales/SalesAI.tsx` wraps the per-tab
   `SummarizePanel` → `/api/summarize` (Claude). Opt-in; sends only already-
   aggregated stats, never raw rows / customer PII.
4. **Find connections** — `/api/connect` (Claude) → `PivotSpec`, computed
   deterministically by `lib/pivot.ts`. Part of the *legacy* explorer path.

**Hard rule: AI never computes numbers or ranks units.** Scoring and all metrics
are deterministic; AI is a narrative/interpretation layer only.

## PRO integration (roadmapped — do not break the contract)

`components/ProBridge.tsx` (mounted in `app/layout.tsx`) is the handshake with
**PRO**, the parent system that will push data live via `postMessage`.

- The app can **NEVER pull/request data from PRO.** Its only outbound signals are
  (1) `{ type: "READY" }` — ready to receive (NOT a request) — and
  (2) `{ type: "PAYLOAD_ACK", ok: true|false }` — received successfully or not.
- PRO pushes `{ source: "PRO", type: "PAYLOAD", payload }`; the app re-emits it as
  a `pro:payload` window event for the data layer to consume (wiring TBD).
- `ALLOWED_ORIGINS` is currently `"*"` — lock it to PRO's real origin once known.

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

## Directory map

```text
app/
  layout.tsx            root layout — fonts (Inter + Anton), <ProBridge/>, provider
  page.tsx              entry — auto-loads + merges data, fixed 4-tab nav, location filter
  globals.css           design tokens (--ground/--panel/--ink…), grid texture, fade-up
  error.tsx / global-error.tsx   error boundaries (so a render error never black-screens)
  api/{infer-schema,insights,connect,summarize}/route.ts
components/
  DashboardProvider.tsx state machine (useReducer): idle→ready, auto-load+merge, activeTab, location filter
  Header.tsx            logo, light/dark toggle, ⚡ AI Analysis, tabs, "refining" pill
  ProBridge.tsx         PRO postMessage handshake
  overview/             OverviewGrid + MetricCard (clickable) + UnitsDrawer (KPI drill-down)
  charts/               OverviewCharts (sales-by-payment + brand bars)
  tabs/                 WorkStageView · OctaneView · shared.ts (unitTitle); legacy CategoryTab/*Tab router
  viz/                  shared primitives: ChartPanel, StatCards, CategoryBars, ReconPipeline (service pipeline), DistributionBar, chartTheme
  sales/                SalesTeam + SalesAI (opt-in summarize)
  priority/             PriorityQueue (search + 25/page + accordion specs)
  insights/             InsightsTab (opt-in multi-model ensemble)
  ui/                   Pills, Pager (shared 25/page pager)
lib/                    types, parseFile, mergeSources (Record-UUID join), profile (heuristic),
                        bucketize, buckets, entities, location, octane,
                        deriveUnits/deriveSales/deriveMetrics, score, categories, categoryConfig,
                        pivot, anthropic, secondOpinions, *Client.ts, format, sampleData
public/                CURATEDV2-TESTING.xlsx (primary inventory) + CuratedFields-TEST.xlsx (entities), logo.png
Discount Forklift Design System/   brand system + UI kit reference (not built by next)
```

Legacy but present: the per-category router (`tabs/CategoryTab.tsx` + `*Tab.tsx`),
`components/explore/`, `components/FileUpload.tsx`, `lib/sampleData.ts`, and
`components/all/AllUnits.tsx` are not wired into the live 4-tab nav; keep or
reuse, don't assume they're live.

## Environment variables (set in Vercel)

| Var | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Claude — schema inference + insights + summarize + connect. Heuristic fallback without it. |
| `ANTHROPIC_MODEL` | optional, default `claude-sonnet-4-6` |
| `XAI_API_KEY` | Grok second opinion |
| `XAI_MODEL` | optional, default `grok-4.20-0309-reasoning` |
| `OPENAI_API_KEY` | GPT second opinion |
| `OPENAI_MODEL` | optional, default `gpt-4o` |

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
