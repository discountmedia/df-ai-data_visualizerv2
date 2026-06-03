# Discount Forklift — Inventory Intelligence Dashboard

A dark, terminal-styled **operations command center** for Discount Forklift (a
used-forklift dealer). It ingests a messy, multi-table inventory export, infers
its structure at runtime, and renders fleet KPIs, per-category deep-dive tabs, a
deterministic priority queue, and a multi-model AI read — all schema-agnostic
(no column names are ever hardcoded).

Built with **Next.js 15 (App Router), React 19, TypeScript, Tailwind, Recharts,
SheetJS, and the Anthropic / xAI / OpenAI APIs.**

> Agents: read **`CLAUDE.md`** for the full architecture + conventions, and the
> **`Discount Forklift Design System/`** folder for the non-negotiable brand
> rules.

## How it works

**It loads straight into the data — no upload screen.** On startup the app fetches
the bundled `public/CuratedFields-TEST.xlsx`, parses it in the browser, and lands directly
on the dashboard. This mirrors production, where an external system (**PRO**) will
push the data live; the bundled sheet is the stand-in test data, used as if it
were live. (The app never *pulls* from PRO — it only signals "ready to receive"
and acknowledges receipt success/failure. See `CLAUDE.md → PRO integration`.)

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
  Anton numerals), an "act first" alert banner, work-stage / sales-by-payment /
  inventory-by-brand bar charts, a per-yard snapshot, and the AI Insights read.
- **Per-category tabs** — one tab per inferred category (Work Stage, Sale Type,
  Location, Metric, Staff, Other, Email, Round Robin, …), each with hand-tuned,
  meaningful charts (leaderboards, scatter, distributions) and a per-tab AI
  **Summarize** + **Find connections** (a deterministic pivot/cross-tab explorer
  the AI just *configures*).
- **Global location filter** — one pill bar filters the entire dashboard.
- **Priority / Act-Now queue** — deterministic, fully-explainable scoring; every
  point a unit earns is itemized, and the rules are shown in the Insights panel.
- **AI Insights — multi-model ensemble** — Claude (primary) plus **Grok** and
  **GPT** as independent second opinions, side by side, so where the models
  diverge becomes the signal. Rule-based fallback when no key is set.
- **Light / dark theme**, the real logo, and the full Discount Forklift design
  language (monospace, scarce brand red, semantic status colors, **no pie charts**,
  Unicode-glyph icons).

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
- **Design tokens are fixed** (`Discount Forklift Design System/colors_and_type.css`,
  `tailwind.config.ts`): dark, monospace, brand red scarce, Anton for big numbers.

## Notes & limitations

- The heuristic schema is instant but coarse; some counts sharpen once the
  background AI refine completes.
- Aged-inventory signals aren't a scoring factor yet (most exports lack a reliable
  date column).
- Rep ↔ roster ↔ email matching is best-effort (names are padded with employee IDs
  and joined via the staff roster).
- All processing is in-memory per session; nothing is persisted server-side. The
  live PRO data pipeline is roadmapped.
