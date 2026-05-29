# Discount Forklift — Inventory Intelligence Dashboard

Ingests a messy multi-location forklift inventory export (.xlsx / .xls / .csv),
infers its schema with Claude (you review and veto columns), and renders a dark
terminal-styled operations dashboard. Built with Next.js (App Router), React,
TypeScript, Tailwind, SheetJS, and the Anthropic API.

## What's in this build

- **Upload & parse** — drag/drop, parsed in the browser with SheetJS.
- **AI schema inference** — `/api/infer-schema` calls Claude to label column
  roles/trust and map raw values to buckets. Falls back to a heuristic engine
  when no API key is set (clearly labeled).
- **Schema review** — audit the inferred structure and veto columns before
  anything is computed.
- **Overview** — grain-aware metric cards (ready / being worked on / needs
  diagnosis / on rent / sold, plus payment mix) and a per-location snapshot.
- **Sales Team** *(new)* — rep leaderboard with drill-down (what each rep sold),
  unsigned-PandaDoc worklist, live round-robin queue board, and lead sources.

### Multi-table ingestion (important)

Real exports often stack several tables in one sheet using a `prefix::field`
naming convention (inventory rows + `email::`, `round_robin::`, `Staff::`, …).
The app detects these **structurally** (by prefix — never by hardcoded names)
and partitions the sheet into entities, so:

- the **Overview** counts only *inventory* rows (not the ~40k related rows), and
- the **Sales Team** tab reads the email table (outreach volume), the
  round-robin snapshot, the staff roster (rep → location), and the sold-by /
  PandaDoc fields on the unit rows.

### Sales metric decisions baked in

- **Activity = emails sent.** This export has no call log; per-rep email volume
  is used as the outreach proxy.
- **Unsigned-doc worklist** counts only genuine open deals (down-payment /
  paid-in-full with no signature). Govt POs (use a PO, not a PandaDoc) and
  Removed-from-Inventory rows are excluded.
- **Round-robin** shows the current *next-up* assignee per queue. This export
  carries a single live pointer, not a lead-distribution history.

## Run locally

```bash
npm install
cp .env.example .env.local      # add ANTHROPIC_API_KEY (optional; heuristics work without it)
npm run dev                     # http://localhost:3000
```

Click **Load messy sample data (multi-table)** to try it with no file/key.

## Deploy to Vercel

Push to GitHub and import the repo (zero-config). Set the environment variable:

| Variable            | Required | Notes                                                    |
| ------------------- | -------- | -------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | no*      | Enables AI schema inference. Server-side only.           |
| `ANTHROPIC_MODEL`   | no       | Defaults to `claude-sonnet-4-6`.                         |

*Without it the app runs on the heuristic engine and labels itself accordingly.
The key is read only in the API route and is never exposed to the browser.

## Conventions (apply to all current and future work)

- **Charts:** no pie charts. Bar, scatter, percentage-point and delta views only — visuals that show magnitude and comparison.
- **Tables:** sort by clicking a header; `table-fixed` + explicit column widths + a constant-width sort indicator mean rows reorder in place with no jump, resize, or reflow.
- **Scoring:** criteria must be operationally usable (drive what a yard actually works next), never decorative.

## Roadmap

- [x] Upload + parse + AI schema inference + veto + Overview
- [x] Multi-table ingestion + **Sales Team** tab
- [x] Sortable / filterable **All Units** table with status pills
- [x] **Charts** (work-stage mix, by location, sales by payment type) on Overview
- [x] **Priority / Act-Now** queue — deterministic scoring with per-unit breakdown
- [x] **AI Insights** tab with a visible "how scores were calculated" panel

### How priority scoring works

Scoring is **deterministic and fully explainable** — no unit is ranked by AI.
The single question it answers is *which units should the yard work next?* The
dominant driver is **committed-but-unfinished** units (a customer has paid or
committed but the unit isn't deliverable, so revenue is stuck); work-stage
urgency orders the rest. Every point a unit earns is itemised on its row, and
the exact rules/weights are shown in the Insights tab's *How Scores Were
Calculated* panel. The **AI Insights** layer adds a portfolio-level narrative on
top in one batched call (with a rule-based fallback when no API key is set); it
never computes the score.

## Notes & limitations

- Priority scoring is deterministic — the same export always produces the same
  ranking. The AI layer adds narrative only; it does not rank units.
- Aged-inventory signals (e.g. how long a Ready unit has sat) are not yet a
  scoring factor — they need a reliable date column, which most exports lack.
- Rep ↔ roster ↔ email matching is best-effort (names are padded with employee
  IDs and joined via the staff roster); odd names may not map to a location.
- All processing is in-memory per session; nothing is persisted server-side.
