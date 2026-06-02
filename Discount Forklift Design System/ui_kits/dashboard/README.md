# UI Kit — Inventory Intelligence Dashboard

A high-fidelity, interactive recreation of Discount Forklift's **Inventory
Intelligence Dashboard** — the dark, terminal-styled web app that ingests messy
fleet exports, infers their schema with AI, and renders an operational command
center.

Source of truth: `discountmedia/df-ai-data_visualizerv2` (`mainv2`) **plus
screenshots of the current live build**, which is ahead of that branch. This kit
is a cosmetic, click-through recreation — the visuals and interactions match the
product; the data pipeline (SheetJS parsing, the real Claude schema-inference
API) is faked with curated sample data and canonical headline KPIs.

## The flow (click-through)

1. **Upload** — drop zone, or "Load messy sample data". Either advances.
2. **Schema Review** — audit the AI-inferred columns; toggle Keep/Veto; confirm.
3. **Dashboard** — ten tabs over a global location filter:
   - **Overview** — 12 big-number metric cards (fleet + payment mix + leads), an
     alert banner with VIEW NOW, a per-yard Locations Snapshot (segment bar +
     colored count grid), and plain-English explainer cards.
   - **Act Now** — deterministic priority queue; click a row for its score breakdown.
   - **All Units** — sortable / filterable / searchable table.
   - **Locations** — units by yard, sellable-vs-in-work, per-yard snapshot bars.
   - **Sales Team** — rep leaderboard, round-robin board, lead sources, unsigned list.
   - **Leads** — lead KPIs (DFB vs Octane), sources, conversion.
   - **Media** — AI image-QA: Gemini-vs-GPT-4o verdicts + artifact checklist.
   - **Sold** — KPI cards + the rich per-unit table with `P1–P9` work-status pills.
   - **On Rent** — rental fleet + revenue.
   - **AI Insights** — narrative + "how scores were calculated".
   - Header has a working **dark / light theme toggle** and **Re-Analyze**.

## Files

| File | What it holds |
| ---- | ------------- |
| `index.html` | Mounts React + Babel and the modules below. |
| `styles.css` | Tokens + globals (grid texture, card, pill, btn, chip, fade-up). |
| `data.jsx` | Canonical headline KPIs (`FLEET`, `LEADS`, `LOCATIONS`) + curated sample rows (`SOLD_ROWS`, `UNITS`, `REPS`) + label/color maps + the `P1–P9` work-status model. Exposed on `window`. |
| `components.jsx` | Primitives: `fmt/fmtMoney/cn`, pills (`WorkPill`, `SalePill`, `TierPill`, **`WorkStatusPill`**, **`SaleTypeCell`**), `MetricCard` (display numerals), `DistributionBar`, `BarsH/BarsV`, `Panel`, `scoreUnits`. |
| `Header.jsx` | Sticky header (real logo, Re-Analyze, 10-tab nav with count chips + Act-Now dot) + `LocationBar`. |
| `screens-entry.jsx` | `FileUpload`, `SchemaReview`, `LoadingState`. |
| `screens-overview.jsx` | `Overview` (12 cards + snapshot + explainers), `AllUnits`. |
| `screens-sold.jsx` | `SoldTab` (rich table), `LeadsTab`, `LocationsTab`, `MediaTab`, `OnRentTab`. |
| `screens-tabs.jsx` | `PriorityQueue` (Act Now), `SalesTeam`, `InsightsTab`. |
| `app.jsx` | State machine (idle → parsing → review → ready) + tab routing. |
| `logo.png` | The real Discount Forklift® logo (also at `/assets/logo.png`). |

## Component conventions (reuse these)

- Every component reads design tokens from CSS vars (`var(--brand)`, `var(--ready)`, …).
- Components export onto `window` via `Object.assign(window, {...})` at file end —
  this is required because each `<script type="text/babel">` is its own scope.
- Numbers always carry `.nums` (tabular). Labels use `.eyebrow`. Pills pair
  full-strength colored text with a 40%-opacity colored border.
- **No pie charts** — bars, stacked bars, and CSS distribution bars only.

## Notes & caveats

- The logo (`logo.png`) was cropped from a screenshot — low-res, dark field.
- Big stat numerals use **Anton** (a substitution for the product's condensed
  display face). Table data values use the OS sans (`system-ui`); all other
  chrome is IBM Plex Mono.
- Headline KPIs are canonical constants (matching the screenshots); table rows
  are a curated representative sample, generated deterministically.
- Charts are hand-built (CSS/flex), not Recharts — same spare bar look.
- **Deferred / not yet built:** the sibling **Metric · seasonality** view (GP
  trajectory + year×month heatmap) and the **Ledger · Daily Activity** cash
  dashboard. The per-tab ✦ *Summarize* / *Find connections* AI actions are
  documented but not wired.
