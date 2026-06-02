# Discount Forklift — Design System

A design system for **Discount Forklift's internal operations tooling**, derived
from the *Inventory Intelligence Dashboard* — a dark, terminal-styled web app
that ingests messy multi-location forklift inventory exports, infers their
schema with Claude, and renders an operational command center for the yards and
the sales team.

This system captures the product's visual language: a **monospace, data-dense,
dark-terminal aesthetic** with a single hot-red brand accent, a disciplined
status-color palette, hairline-bordered cards, and Unicode-glyph iconography.
It exists so design agents can build new screens, mocks, and assets that look
like they shipped from the same codebase.

> **Note on scope.** Discount Forklift is a used-forklift dealer; this design
> system describes the look of their *internal data tooling*, not a public
> marketing site. There is **one product** represented: the inventory dashboard.

---

## Sources

This system was reverse-engineered from the repository below, then **corrected
and extended against screenshots of the live, current product** (the running
build is well ahead of the `mainv2` branch — it now adds Leads, a Media AI-QA
tab, a sibling "Ledger / Daily Activity" surface, a Metric seasonality view,
priority-coded `P1–P9` work-status pills, a real logo, and a heavy condensed
display face for big numbers). Where screenshots and repo disagree, **the
screenshots win** — they are the current truth.

The reader is encouraged to explore the repo directly for component logic:

- **GitHub:** `discountmedia/df-ai-data_visualizerv2` (branch `mainv2`)
  - <https://github.com/discountmedia/df-ai-data_visualizerv2>
  - Next.js 15 (App Router) · React 19 · TypeScript · Tailwind 3 · Recharts · SheetJS · Anthropic SDK
  - Key files read: `app/globals.css`, `tailwind.config.ts`, `app/layout.tsx`,
    `app/page.tsx`, `components/Header.tsx`, `components/FileUpload.tsx`,
    `components/overview/*`, `components/charts/OverviewCharts.tsx`,
    `components/all/AllUnits.tsx`, `components/priority/PriorityQueue.tsx`,
    `components/sales/SalesTeam.tsx`, `components/insights/InsightsTab.tsx`,
    `components/viz/*`, `components/ui/Pills.tsx`, `lib/buckets.ts`, `lib/format.ts`.

Related repos in the same org (`discountmedia`) suggest a family of internal
spreadsheet/AI tools — CleanShot, datasift, Inventory-Reporting-Dashboard,
dfGPT, artifactiq — but only `df-ai-data_visualizerv2` was used to build this
system.

---

## What this product does (context)

The dashboard takes a real `.xlsx / .xls / .csv` fleet export, parses it in the
browser, and asks Claude to label each column's role and trust (with a heuristic
fallback when no API key is set, clearly badged "heuristic"). The operator
**reviews and vetoes** the inferred schema before any number is computed, then
lands on a set of operational tabs:

**Tab navigation (current build).** After upload the dashboard is a tab bar over
a global location filter. Observed order and counts (from screenshots):
`Overview` · `● Act Now [n]` · `All Units [n]` · `Locations [n]` · `Sales Team [n]`
· `Leads [n]` · `Media` · `Sold [n]` · `On Rent [n]` · `AI Insights [n]`. Each
count sits in a small gray chip; the active tab is red text + red underline;
`Act Now` carries a pulsing red dot.

- **Overview** — two rows of big-number metric cards (fleet KPIs + payment mix +
  leads), a top alert banner ("N sold units still need work — VIEW NOW"), a
  per-yard **Locations Snapshot** (segment bar + colored count grid), and
  plain-English explainer cards.
- **Act Now** — the deterministic, fully-explainable priority queue (every point
  itemized per row); leads with given forklift names.
- **All Units** — sortable/filterable/searchable `table-fixed` with status pills.
- **Locations** — units by yard, sellable-vs-in-work, avg price, per-yard bars.
- **Sales Team** — rep leaderboard, round-robin board, lead sources, email activity.
- **Leads** — lead volume / source / conversion KPIs (DFB vs Octane sub-brands).
- **Media** — AI image-QA (the "slop detector"): per-image Gemini-vs-GPT-4o
  Pass/Fail verdicts, an artifact checklist (forks, mast, seat, wheels, text,
  shadows…), and flagged issues.
- **Sold** — KPI cards + a rich per-unit table (Name · Serial 4 · Make · Type ·
  Cap · Location · Sale Type · Sold To · Rep · Invoiced · PandaDoc · **Work
  Status** priority pills).
- **On Rent** — rental fleet + revenue.
- **AI Insights** — portfolio narrative + the "how scores were calculated" panel.

Sibling surfaces (separate files, same design language): a **Metric /
seasonality** view (GP trajectory line charts + a year×month heatmap) and a
**Ledger · Daily Activity** cash-position dashboard.

**Per-tab AI.** Every tab has a ✦ *Summarize this tab* action (grounded
narrative + suggested cross-tab questions) and *Find connections* (a pivot
explorer).

**Hard product conventions** (they shape every design decision): **no pie
charts** — only bar / scatter / delta views that show magnitude and comparison;
tables use `table-fixed` so rows reorder in place with no reflow; scoring must
be *operationally usable*, never decorative.

---

## CONTENT FUNDAMENTALS

The voice is that of a **terse operations tool built by engineers for the people
who run the yards** — direct, lowercase-leaning, confident, and allergic to
fluff. It tells you what to do next, not how it feels.

**Tone & vibe.** Operational and plainspoken. Reads like a well-written CLI or a
sharp internal memo. No marketing gloss, no exclamation points, no hype. When it
gives an instruction it is blunt: *"These go first."*, *"Act first."*, *"Fix
now."*, *"Chase These."*

**Person.** Addresses the operator in the **imperative** ("Load a fleet export
to begin", "Drag & drop, or browse", "click a header to sort"). Avoids "I". Uses
"we" sparingly for the system's own actions ("We parse it in the browser, then
infer the schema with AI"). The user is never "you" in copy — they're just told
what to do.

**Casing.** Three deliberate registers:
- **UPPERCASE + wide tracking** for the wordmark, eyebrows/labels, buttons, tabs,
  and pills (e.g. `INVENTORY INTELLIGENCE`, `READY TO SELL`, `ACT NOW`).
- **Title Case** for card labels and metric names ("Total Fleet", "Paid in
  Full", "Round-Robin — Next Up").
- **sentence case** for descriptive body and hints ("Committed-but-unfinished
  units lead the queue…").

**Punctuation & symbols.** The em-dash (`—`) is a signature connector, both in
titles ("Sales Team — Leaderboard", "Round-Robin — Next Up") and as the
universal **empty/null value** ("—"). Middots (`·`) join inline facts
("make · model · type"). A bullet `·` prefixes methodology lines.

**Numbers.** Always `tabular-nums` and locale-grouped (`12,480`). Money is
abbreviated (`$1.2M`, `$8.5K`, `$420`). Counts are spelled with their noun
("units", "on team", "Attributed units").

**Honesty about data.** The product is unusually candid about its own limits and
labels its confidence inline: "heuristic" vs "AI" badges, "Low confidence —
column not mapped", "Activity = emails sent." (proxy), "Live pointer per queue —
not a lead-distribution history." Copy should always disclose assumptions rather
than imply false precision.

**Emoji.** None in the marketing sense. The product uses a small set of
**Unicode glyphs as functional icons** (see ICONOGRAPHY) — `⚠ ⚡ ↥ → ✓ ○ ☀ ☾` —
never decorative emoji.

**Example strings (verbatim from the product):**
- "Load a fleet export to begin"
- "Drop a messy .xlsx / .xls / .csv export. We parse it in the browser, then infer the schema with AI — you review and veto columns before any scoring runs."
- "⚠ 12 sold units still need work completed"
- "Committed-but-unfinished units lead the queue — a customer has paid or committed and the unit isn't deliverable. These go first."
- "click a unit for its score breakdown"
- "Priority is computed deterministically — no AI ranks any unit. Same export, same order, every time."

---

## VISUAL FOUNDATIONS

**Overall.** A **dark operations terminal.** Near-black ground, faint engineering
grid texture, hairline-bordered flat cards, one hot-red accent, and a strict
status palette. Everything is monospace. Density is high and intentional —
this is a tool for reading a lot of numbers fast, not a landing page.

**Color.** See `colors_and_type.css` for the full token set.
- Dark theme is the default (`data-theme="dark"`); a light theme exists and
  swaps only the surface/ink ramp — brand and status colors are constant.
- Surfaces step subtly: `--ground #0a0a0b` → `--panel #121214` → `--panel-2
  #17171a`, separated by a single `--line #2a2a2e` hairline. There are no large
  filled color blocks.
- One brand color: **`--brand #ff2b2b`** (hot red). Used only for the wordmark,
  the 2px top-rule, primary buttons, active tabs/filters, and "Act Now" — it is
  scarce and always means *attention / primary*.
- Status palette is semantic and consistent everywhere (cards, pills, bars,
  charts): ready `#3ddc84` (green), working `#ffc02e` (amber), needs-diagnosis
  `#ff3b46` (red), on-rent `#3aa0ff` (blue), paid-in-full `#ff8a3d` (orange),
  down-payment `#ffb86b`, govt-PO `#b07cff` (violet).
- Chart palette (Recharts): `["#ff2b2b","#3aa0ff","#3ddc84","#ffc02e","#b07cff","#ff8a3d","#9a9aa0"]`.

**Type.** A coordinated three-role system:
- **IBM Plex Mono** (weights 400–700) carries all *chrome*: the wordmark fallback,
  eyebrow labels, metric labels, column headers, nav, buttons, pills, and
  descriptive copy. This is the dominant voice and the terminal signature.
- **Anton** (a heavy *condensed black* display face) is used **only for big stat
  numerals** — the giant `1256 / 117 / 290` on metric cards. This is what gives
  the dashboard its punchy, industrial scoreboard feel. *(Substitution — see
  Fonts.)*
- A **proportional sans** (`system-ui` — the OS default, Segoe UI on the source
  Windows build) renders **table DATA values**: company names, unit types, rep
  names. Labels stay mono; the data they describe is sans.

Hierarchy = size + weight + the uppercase tracked "eyebrow" (`10px / 0.14em`).

**Spacing & layout.** Centered `max-w-7xl` column, `px-5` gutters. Card padding
is `p-3`/`p-4`. Grids use Tailwind `gap-3`. Sticky header with the brand
top-rule; a horizontal location-filter bar sits directly beneath it; tabs are an
underline nav. Tables are `table-fixed` with explicit `<col>` widths and a
constant-width sort indicator so rows reorder without reflow.

**Backgrounds.** No imagery, no photos, no gradients-as-decoration. The only
background treatment is a **faint engineering grid**: two 1px line-gradients at
`48px` tile, `opacity: 0.06`, fixed and pointer-events-none, sitting behind
everything. Alert/callout cards use a 5%-tint of their accent (`bg-brand/5`,
`bg-diag/5`) with a 2px left border.

**Borders & cards.** The card is *the* unit of layout: `background: --panel; 1px
solid --line; border-radius: 6px`. Corners are a single shared **6px** radius
(`--radius-card`) — never pill-rounded, never sharp-square. Pills/badges and
inputs are effectively square (radius 0–2px).

**Shadows / elevation.** Almost flat. The one defined shadow is subtle and used
mainly on tooltips/popovers: `0 1px 0 0 rgba(255,255,255,0.02) inset, 0 8px 24px
-16px rgba(0,0,0,0.8)`. Elevation is communicated by the surface ramp and
borders, not big drop shadows.

**Hover states.** Restrained and fast (`120ms`). Cards: border lightens
(`--line` → `#3a3a40`). Buttons/tabs/filters: border goes brand-red and text
goes from `ink-dim` → `ink`. Table rows: background lifts to `panel-2`. Primary
red button: `opacity: 0.9`. No scale-up on hover for most elements.

**Press / active states.** Active tab, filter chip, and location button all
adopt a **brand-red border + full-strength ink text**; inactive siblings are
transparent-bordered `ink-dim`. There is no shrink-on-press; selection is shown
by the red border, not motion.

**Pills & badges.** `inline-block; border; px-1.5 py-0.5; 10px; uppercase;
tracking-wide`. Colored variants pair **full-strength colored text** with a
**40%-opacity colored border** (`text-ready border-ready/40`); tier pills add a
5–10% tinted fill. The `—` glyph stands in for any "no value" pill.

**Work-status priority pills (Sold tab).** A signature component: a rounded
amber/orange-outlined badge of the form **`P{n}  {label}`**, where `P{n}` is the
deterministic priority rank (P1 = most urgent … P9) rendered in heavier weight,
followed by a state label — e.g. `P4 Down Pmt — Open Work`, `P1 ● PIF — Open
Work`, `P9 Paid in Full ✓`. A leading `●` dot or trailing `✓` encodes
open-work vs done. Highest-priority/open-work pills read hottest (red), settled
ones cool to muted amber. Corners ~4px, padding `4px 8px`.

**Charts.** Recharts, deliberately spare: thin axes (`#9a9aa0`), faint grid
(`#2a2a2e`), `isAnimationActive={false}`, `radius` 2px on bar ends, custom dark
tooltip. **Never pie charts** — horizontal bars, vertical bars, stacked bars,
scatter, and pure-CSS proportional `DistributionBar`s only.

**Motion.** Minimal and functional. One entrance animation: **`fade-up`** —
`opacity 0 → 1` + `translateY(6px) → 0` over `280ms ease`, applied to views as
they mount. The loading state is three brand-red dots pulsing on staggered
140ms delays. Charts do **not** animate. No bounces, no parallax, no looping
decoration.

**Transparency & blur.** Used sparingly and purposefully: the sticky header is
`bg-ground/90 backdrop-blur`; cursor/hover fills on charts are
`rgba(255,255,255,0.03)`; tinted callout backgrounds are 5% accent. Blur appears
*only* on the sticky header.

**Imagery vibe.** There is none — this is a pure data UI. If imagery is ever
added, it should stay cool, dark, and high-contrast to match the terminal feel;
default to charts and tables over pictures.

---

## ICONOGRAPHY

**The product ships no icon font, no SVG icon set, and no image icons.** All
iconography is **Unicode glyphs** rendered inline in IBM Plex Mono. This is a
defining trait — keep it. Do **not** introduce Lucide/Heroicons/etc. or
hand-drawn SVGs unless a new surface genuinely needs them; if you must, match a
thin, monochrome, single-weight style and **flag the substitution**.

Glyphs in active use (copy these, don't redraw):

| Glyph | Meaning / usage |
| ----- | --------------- |
| `⚡`   | AI Analysis button |
| `⚠`   | Alert / act-now callout |
| `↥`   | Upload (file drop zone) |
| `→`   | Metric card "drill" arrow |
| `✓` / `○` | Signed / unsigned PandaDoc |
| `↑` `↓` `↕` | Sort: ascending / descending / sortable |
| `▾` `▸` | Expanded / collapsed disclosure row |
| `☀` / `☾` | Light / dark theme toggle |
| `▲` `▼` | Compact sort indicators (Leaderboard) |
| `·`   | Inline fact separator & methodology bullet |
| `—`   | Em-dash: title connector **and** universal null value |

**Logo / wordmark.** The live product uses a real logo: **`Discount Forklift®`**
in bold *italic* red with a thin white keyline, on the dark header. It was
extracted from a product screenshot and lives at **`assets/logo.png`** — use
that file. (It sits on a near-black field; on the light theme it needs a
transparent/inverted version — see the flag below.) A text-wordmark fallback
(`assets/wordmark.html`) remains for cases where the raster can't be used:
`DISCOUNT FORKLIFT`, IBM Plex Mono **700**, uppercase, colored `--brand`. Prefer
the real logo, not the text fallback, wherever possible.

> **Flag for the user:** the logo at `assets/logo.png` was cropped from a
> screenshot, so it is low-resolution and sits on a dark field (fine on the
> default dark header, wrong on the light theme). Please attach the original
> vector/PNG logo (and a favicon) if you'd like a crisp, theme-aware mark.

---

## Fonts

Two families are loaded from the **Google Fonts CDN**; data values use the OS
sans (no file needed):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Anton&display=swap" rel="stylesheet">
```

- **IBM Plex Mono** — the exact family the product uses for all chrome. Faithful
  match, not a substitution.
- **Anton** — used for the big condensed display numerals. **This is a
  substitution.** The product's actual display face is a heavy condensed black
  grotesque that I could not positively identify from screenshots; Anton is the
  closest free match (Saira Condensed / Oswald are decent alternates and are in
  the fallback stack).
- **`system-ui`** — table data values render in the OS default sans, matching
  the source build (Segoe UI on Windows). Nothing to load.

> **Flag for the user:** please confirm the display font for the big stat
> numbers — if it's a specific licensed face (e.g. a custom condensed), name it
> or attach it and I'll swap Anton out. Also say the word if you want
> self-hosted/offline `.woff2` files vendored into `fonts/`.

---

## Index — what's in this folder

| Path | What it is |
| ---- | ---------- |
| `README.md` | This file — context, content + visual foundations, iconography. |
| `colors_and_type.css` | All design tokens: color ramp, status palette, type roles, radii, shadow, motion. Import this first. |
| `SKILL.md` | Agent-Skills manifest so this folder works as a downloadable Claude skill. |
| `assets/logo.png` | The real `Discount Forklift®` logo (cropped from a product screenshot — low-res, dark field). |
| `assets/wordmark.html` | Text-wordmark fallback for when the raster can't be used. |
| `preview/` | Small HTML specimen cards that populate the Design System tab (colors, type, components, etc.). |
| `ui_kits/dashboard/` | High-fidelity, interactive recreation of the Inventory Intelligence Dashboard. See its own `README.md`. |

### UI kits
- **`ui_kits/dashboard/`** — the Inventory Intelligence Dashboard. `index.html`
  is a click-through prototype (upload → schema review → overview / units /
  priority / sales / insights). Built from reusable JSX components
  (`Header`, `MetricCard`, `Pill`, `DistributionBar`, `UnitsTable`,
  `PriorityQueue`, `SalesLeaderboard`, etc.).

_No slide template was provided in the source, so no `slides/` were created._
