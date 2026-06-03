# CLAUDE.md — Discount Forklift Inventory Intelligence

Project context for an AI agent picking this up cold. Read this first, then
`README.md` (human overview) and `Discount Forklift Design System/` (the brand /
visual rules — non-negotiable; see "House rules").

## What this is

An internal **operations dashboard** for Discount Forklift, a used-forklift
dealer. It ingests a messy, multi-table inventory export and renders a dark,
terminal-styled "command center" — fleet KPIs, per-category deep-dive tabs, a
deterministic priority queue, and a multi-model AI read on top.

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
`public/CuratedFields-TEST.xlsx` with `xlsx`, then run the `lib/derive*`/`lib/score`
functions); the UI is best checked with a headless screenshot of the deployed
URL.

## How it runs (important — this is unusual)

**No upload splash, no schema-review screen.** On load the app immediately
fetches `public/CuratedFields-TEST.xlsx`, parses it, and lands straight on the dashboard.
This is intentional: in production an external system called **PRO** will push
the data; the bundled xlsx is the stand-in test data, used *as if it were live
PRO data*. Do not reintroduce an upload/landing page as the default entry.

Auto-load sequence (`components/DashboardProvider.tsx → loadAutoData`):

1. `fetch("/CuratedFields-TEST.xlsx")` → `parseSpreadsheet` (SheetJS, in-browser).
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
CuratedFields-TEST.xlsx ─parseFile→ ParsedFile ─detectEntities→ EntitySet (base + email/staff/round_robin)
                                              │
                       heuristicSchema / Claude (inferSchemaClient) → SchemaProfile
                                              │
   deriveUnits → UnitRecord[]   deriveSales → SalesSummary   deriveMetrics → OverviewMetrics
        │                                                    scoreUnits → ScoringResult
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
- **`lib/categories.ts`** is the single source of truth for grouping columns into
  categories (role for base columns, entity prefix for the rest). Both the (now
  unused) schema-review screen and the dashboard tabs build from it.
- **`lib/pivot.ts`** is a deterministic group-by/cross-tab engine powering the
  "Find connections" explorer; AI only picks the spec, the math is auditable.

## Navigation / tabs

`app/page.tsx` renders a global **Overview** tab first, then **one tab per
inferred category**, ordered by `lib/categoryConfig.ts` (workflow priority):
Work Stage · Sale Type · Location · Metric · Staff · Other · Email · Round Robin
· ID · Flag.

- Rich/hand-tuned layouts: `components/tabs/{WorkStage,SaleType,Location,Metric,Staff,Other}Tab.tsx`.
- Everything else falls back to `ExploreTab.tsx` (the generic pivot/connection explorer).
- A global **location-filter pill bar** (`LocationBar.tsx`) filters the *entire*
  dashboard (page-level `filteredUnits` is passed to every tab + Overview).
- Each tab carries `TabAI.tsx` = ✦ Summarize + Find connections.

**Dedup principle (enforced):** each chart/view has exactly ONE home. Overview
owns the headline distributions (work-stage mix, sales-by-payment, brand,
per-yard snapshot); Location owns work-stage×location + price-by-yard; Staff owns
the rep leaderboard + unsigned chase. Don't reintroduce the same view on multiple
tabs.

## Where AI is used (4 places)

1. **Schema inference** — `/api/infer-schema` (Claude, `lib/anthropic.ts`),
   heuristic fallback in `lib/profile.ts`. Refines the instant heuristic schema.
2. **AI Insights (Overview)** — `/api/insights` runs a **multi-model ensemble**:
   Claude (primary) + Grok + GPT (second opinions) **in parallel**, shown side by
   side with a "where they diverge, look closer" note. `lib/secondOpinions.ts` is
   provider-agnostic, key-gated, and isolates failures (a bad model string never
   blocks the report). Heuristic fallback when no Anthropic key.
3. **Per-tab Summarize** — `/api/summarize` (Claude), grounded narrative + chips.
4. **Find connections** — `/api/connect` (Claude) turns a plain-English question
   into a `PivotSpec`; `lib/pivot.ts` computes it deterministically.

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

- **Dark theme default; everything monospace (IBM Plex Mono).** Big stat numerals
  ONLY use the **Anton** condensed display face (`font-display`). Table data
  values use `system-ui` sans.
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
  layout.tsx            root layout — fonts (Plex Mono + Anton), <ProBridge/>, provider
  page.tsx              entry — auto-loads data, builds tabs, renders Header + active tab
  globals.css           design tokens (--ground/--panel/--ink…), grid texture, fade-up
  error.tsx / global-error.tsx   error boundaries (so a render error never black-screens)
  api/{infer-schema,insights,connect,summarize}/route.ts
components/
  DashboardProvider.tsx state machine (useReducer): idle→ready, auto-load, activeTab, location filter
  Header.tsx            logo, light/dark toggle, ⚡ AI Analysis, tabs, "refining" pill
  ProBridge.tsx         PRO postMessage handshake
  overview/, charts/    rich Overview (metric cards + OverviewCharts + yard snapshot)
  tabs/                 CategoryTab router + per-category layouts + TabAI/SummarizePanel
  viz/                  shared primitives: ChartPanel, StatCards, CategoryBars, ScatterPanel, Leaderboard, DistributionBar, chartTheme
  explore/CategoryExplorer.tsx   AI pivot/connection builder
  sales/, all/, priority/, insights/   SalesTeam, AllUnits, PriorityQueue, InsightsTab (reused by tabs)
lib/                    types, parseFile, profile (heuristic), bucketize, buckets, entities,
                        deriveUnits/deriveSales/deriveMetrics, score, categories, categoryConfig,
                        pivot, anthropic, secondOpinions, *Client.ts, format, sampleData
public/                CuratedFields-TEST.xlsx (test data, auto-loaded), logo.png
Discount Forklift Design System/   brand system + UI kit reference (not built by next)
```

Legacy but present: `components/FileUpload.tsx` and `lib/sampleData.ts` (the old
upload/sample path) and `components/all/AllUnits.tsx` are not currently wired into
a tab; keep or reuse, don't assume they're live.

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
