# Discount Forklift — Inventory Intelligence Dashboard

A dark, clean **operations command center** for Discount Forklift (a used-forklift
dealer). It ingests a messy, multi-table inventory export, infers its structure at
runtime, and renders fleet KPIs with click-through drill-downs, a service pipeline,
a deterministic priority queue, a sales-team board, and an opt-in multi-model AI
read — all schema-agnostic (no column names are ever hardcoded).

Built with **Next.js 15 (App Router), React 19, TypeScript, Tailwind, Recharts,
SheetJS, and the Anthropic / xAI / OpenAI APIs.**

> Agents: read **`CLAUDE.md`** for the full architecture + conventions, and the
> **`Discount Forklift Design System/`** folder for the non-negotiable brand
> rules.

## How it works

**It loads straight into the data — no upload screen.** On startup the app fetches
**two** bundled spreadsheets — `public/CURATEDV2-TESTING.xlsx` (rich inventory) and
`public/CuratedFields-TEST.xlsx` (email / staff / round-robin entities + fuel type +
sales rep) — merges them by `Record UUID` in the browser, and lands directly on the
dashboard. This mirrors production, where an external system (**PRO**) will push the
data live; the bundled sheets are stand-in test data, used as if they were live.
(The app never *pulls* from PRO — it only signals "ready to receive" and
acknowledges receipt success/failure. See `CLAUDE.md → PRO integration`.)

Loading is two-stage so you see real numbers instantly:

1. An **instant heuristic schema** (client-side) renders the dashboard immediately.
2. **Claude refines the schema in the background** and swaps the sharper version
   in seamlessly (a "⚡ refining" pill shows while it runs; the badge flips
   `heuristic → AI`).

### Multi-table ingestion

Real exports stack several tables in one sheet via a `prefix::field` convention
(inventory rows + `email::`, `Staff::`, `round_robin::`). The app detects these
**structurally** (by prefix, never by name) and partitions the sheet into
entities — so the unit views read only inventory rows (~1,325 of ~40k), while the
Staff/Sales views read the email, roster, and round-robin slices.

## Features

- **Overview** — at-a-glance command center: fleet + payment metric cards (big
  Anton numerals), an "act first" alert banner, sales-by-payment / inventory-by-
  brand charts, a per-yard snapshot, and an opt-in AI Insights read. **Every KPI
  card is clickable** — drill into a searchable, 25/page table of the exact units
  behind that number.
- **Work Stage** — the **service pipeline** (a journey bar + bottleneck call-out),
  a readiness legend, and the priority queue. Covers the 4 main yards only.
- **Sales Team** — a **Roster** sidebar (click a rep for their contact card), a
  Sales Race leaderboard, deal-close health, an outreach-vs-closes chart, the rep
  leaderboard, round-robin, and an unsigned-doc chase list — plus an opt-in AI read.
- **OCTANE** — the OCTANE sub-brand on its own tab, kept out of the main fleet metrics.
- **Global location filter** — one pill bar (Denver / Las Vegas / Phoenix / DFW +
  Other) filters Overview, Work Stage, and OCTANE.
- **Priority / Act-Now queue** — deterministic, fully-explainable scoring; every
  point a unit earns is itemized. Searchable, paginated, with an accordion of each
  unit's specs (mast, fork length, heights, tires, product & video links).
- **AI Insights — multi-model ensemble** — Claude (primary) plus **Grok** and
  **GPT** as independent second opinions, side by side. Opt-in (nothing is sent
  until you click); rule-based fallback when no key is set.
- **Light / dark theme**, the real logo, and the Discount Forklift design language
  (Inter UI font, Anton for big numbers, scarce brand red, semantic status colors,
  **no pie charts**, Unicode-glyph icons).

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Optionally add keys to `.env.local` (the app runs on heuristics without them):

```bash
ANTHROPIC_API_KEY=sk-ant-...     # Claude: schema inference + insights + summarize + connect
XAI_API_KEY=...                  # Grok second opinion   (XAI_MODEL optional)
OPENAI_API_KEY=...               # GPT second opinion    (OPENAI_MODEL optional, default gpt-4o)
```

> Note: `next dev` caches the `public/` listing at startup — if you change the
> bundled data file, restart the dev server.

## Deploy (Vercel)

Push to **`mainv2`**; the Vercel git integration auto-deploys. Required build
settings: **Root Directory `.`**, **Framework Next.js**, **Output Directory
default**. Set the API keys above as Environment Variables (server-side only —
never exposed to the browser).

## Conventions (apply to all work)

- **No pie/donut charts.** Bars, stacked bars, scatter, and CSS distribution bars
  only — visuals that show magnitude and comparison.
- **AI never computes numbers or ranks units.** Scoring and every metric are
  deterministic (same export → same result); AI adds narrative/interpretation only.
- **Each view has one home** — don't show the same chart on multiple tabs.
- **"In Service"** is the term for the service/recon pipeline in user-facing copy.
- **Design tokens are fixed** (`tailwind.config.ts`): dark theme, Inter UI font,
  Anton for big numbers, brand red scarce, semantic status colors.

## Notes & limitations

- The heuristic schema is instant but coarse; some counts sharpen once the
  background AI refine completes.
- Aged-inventory signals aren't a scoring factor yet (most exports lack a reliable
  date column).
- Rep ↔ roster ↔ email matching is best-effort (names are padded with employee IDs
  and joined via the staff roster).
- All processing is in-memory per session; nothing is persisted server-side. The
  live PRO data pipeline is roadmapped.
