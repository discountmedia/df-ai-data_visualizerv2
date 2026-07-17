# Discount Forklift — Inventory Intelligence Dashboard

A dark, clean **operations command center** for Discount Forklift (a used-forklift
dealer). It ingests a messy, multi-table inventory export, infers its structure at
runtime, and renders fleet KPIs with click-through drill-downs, a service pipeline,
a deterministic priority queue, a sales-team board, and an opt-in multi-model AI
read — all schema-agnostic (no column names are ever hardcoded).

Built with **Next.js 15 (App Router), React 19, TypeScript, Tailwind, Recharts,
SheetJS, PapaParse, the Anthropic API, and Web Crypto (the hosted-mode auth gate).**

> Agents: read **`CLAUDE.md`** for the full architecture + conventions, and the
> **`Discount Forklift Design System/`** folder for the non-negotiable brand
> rules.

## How it works

**No upload screen.** How data arrives depends on the environment:

- **Production** — the app **waits for a push from PRO**, Discount Forklift's
  **FileMaker Pro** system, which runs this app inside a Web Viewer and pushes the
  inventory + staff data in (two headerless CSV blocks). The app never *pulls* from
  PRO — it only signals "ready to receive" and acknowledges the receipt. Access is
  gated by a signed, time-limited URL (see below). See `CLAUDE.md → PRO integration`.
- **Dev / local** — the app auto-loads **two** bundled spreadsheets
  (`public/CURATEDV2-TESTING.xlsx` + `public/CuratedFields-TEST.xlsx`), merges them
  by `Record UUID`, and lands directly on the dashboard, so the UI is populated
  without FileMaker. These are stand-in test data. (A "Simulate PRO push" button in
  the waiting state exercises the real ingest path without FileMaker.)

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

Under the **PRO (FileMaker) contract** the staff table is simplified to a flat
5-field roster (`NAME, DEPARTMENT, TITLE, EMAIL, DIRECT`), which the adapter
re-emits under the `Staff::` prefix so the same entity pipeline applies. There's
no `email::`/`round_robin::` feed in that contract, so Sales Team's activity
views (emails-sent, round-robin, lead sources) show empty states, while the
roster's real email + phone feed each rep's contact card.

## Features

- **Overview** — at-a-glance command center: fleet + payment metric cards (big
  Anton numerals), an "act first" alert banner, sales-by-payment / inventory-by-
  brand charts, a per-yard snapshot, and an opt-in AI Insights read. **Every KPI
  card is clickable** — drill into a searchable, 25/page table of the exact units
  behind that number.
- **Search, drill-downs & export** — a sticky **global search** in the header finds
  any unit (serial / name / make / model / year / price) and opens its full detail;
  **every KPI card drills into a table** of the exact units behind it; unit tables
  carry a **listing-URL column**, **click-to-copy** on serials / URLs / names
  (right-click is disabled in the Web Viewer), and a **Print / PDF** button; and
  **in-app Back / Forward** buttons navigate the chromeless viewer.
- **Work Stage** — the **service pipeline** (a journey bar + bottleneck call-out),
  a readiness legend, and the priority queue (a sortable table; click any tier KPI
  or the act-now banner to drill into those units). Covers all yards, incl. Other.
- **Sales Team** — a **Roster** sidebar (click a rep for their contact card), a
  Sales Race leaderboard, deal-close health, an outreach-vs-closes chart, the rep
  leaderboard, round-robin, and an unsigned-doc chase list — plus an opt-in AI read.
- **Media** — a content-coverage command center: per-unit walkaround-video +
  product-page coverage (clickable KPI cards → a drill-down of exactly which units
  are missing media, by yard) alongside the company-wide media-production pipeline.
- **OCTANE** — the OCTANE sub-brand on its own tab, kept out of the main fleet
  metrics; its cards drill into the underlying units.
- **Global location filter** — one pill bar (Denver / Las Vegas / Phoenix / DFW +
  Other) filters Overview, Work Stage, Sales Team, Media, and OCTANE.
- **Priority / Act-Now queue** — deterministic, fully-explainable scoring; every
  point a unit earns is itemized. A sortable, searchable, paginated table; expand a
  row for its score breakdown + full specs (mast, fork length, heights, tires,
  product & video links).
- **AI Insights** — a Claude read of the fleet, opt-in (nothing is sent until you
  click); rule-based fallback when no key is set.
- **Light / dark theme**, the real logo, and the Discount Forklift design language
  (Inter UI font, Anton for big numbers, scarce brand red, semantic status colors,
  **no pie charts**, Unicode-glyph icons).
- **Logs / observability** (`/logs`) — auth / performance / system / error events
  recorded to Neon in real time, viewable by an allowlisted account via a signed
  link (same HMAC method as the gate). Flags any FileMaker user-agent hitting the
  public URL and surfaces signature rejections as alerts. During testing the viewer
  can be opened to anyone via `LOGS_PUBLIC` (or whenever the auth gate is off); it
  re-secures automatically at go-live. See `CLAUDE.md → Logs`.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Optionally add keys to `.env.local` (the app runs on heuristics without them):

```bash
ANTHROPIC_API_KEY=sk-ant-...     # Claude: schema inference + insights + summarize + connect
INVENTORY_ANALYSIS_SECRET=...    # shared secret for the hosted-mode auth gate (prod only)
```

In dev the app auto-loads the bundled data and the **auth gate is off**, so no
secret is needed locally. To exercise the gate locally, set `AUTH_GATE=on` (and
`INVENTORY_ANALYSIS_SECRET`).

> Note: `next dev` caches the `public/` listing at startup — if you change the
> bundled data file, restart the dev server.

## Deploy (Vercel)

Push to **`mainv2`**; the Vercel git integration auto-deploys. Required build
settings: **Root Directory `.`**, **Framework Next.js**, **Output Directory
default**. Set the API keys above as Environment Variables (server-side only —
never exposed to the browser), including `INVENTORY_ANALYSIS_SECRET`.

> **Heads up:** with the secret set, the production build turns the **auth gate
> on**. Opening the prod URL directly in a browser returns **401 by design** — the
> only way in is a fresh, FileMaker-signed link (60-second freshness window). And
> production **waits for a PRO push** rather than showing bundled data.

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
- Inventory data is in-memory per session; the CSV itself isn't persisted (the
  live PRO push + hosted-mode auth gate are implemented and confirmed working in
  prod). Only the **logs** are persisted (to Neon); optional day-over-day inventory
  persistence via the dormant Neon path is a later step.
- In production the Web Viewer is locked down with **deterrents** (no-store caching,
  disabled right-click / DevTools shortcuts / keyboard refresh, no pull-to-refresh).
  These are deterrents, not hard enforcement — the authoritative controls live on
  the WebView2 host, not in page JS.
