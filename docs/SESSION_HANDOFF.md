# Session handoff — 2026-07-17 (updated end of UI-overhaul session)

Context dump so a fresh chat can pick up cold. Also read `CLAUDE.md`,
`docs/UI_OVERHAUL_PLAN.md` (the full overhaul record), and the auto-loaded memory
files (`pro-*`, `pro-fixed-viewport-and-ui-overhaul`, `logs-observability-feature`,
`webviewer-lockdown-and-deterrents`, `ui-consistency-audit`).

## Where things stand
- **Everything is committed to `mainv2` and deployed** to Vercel
  (`df-ai-data-visualizerv2.vercel.app`, scope `discountforkliftmedia`). Deploy =
  push `mainv2`. Vercel CLI is authed (`npx vercel …`).
- **Live PRO integration works** — FileMaker pushes inventory + staff over the Web
  Viewer bridge (confirmed 1,389 rows). Data is in-memory per session.
- **A large UI overhaul shipped this session** (see `docs/UI_OVERHAUL_PLAN.md`):
  shared primitives `ui/DataTable` + `ui/Drawer` + `ui/CopyText` +
  `units/UnitDetail` + `GlobalSearch` + `lib/printTable`; **every KPI card drills
  into a table**; **global header search**; **click-to-copy**; **listing-URL column
  + Print/PDF** on every unit table; **salesman + customer columns** on
  sold/down-payment cuts; **in-app Back/Forward** nav; the Priority Queue is a
  **sortable table** with clickable tier cards + clickable act-now banner; layout
  **widened to `max-w-[1600px]`**; per-tab IA reorg. Follow-ons: **Admin tab removed
  from the nav** (route + component remain URL-only); **Logs made public** while the
  gate is off; nav buttons enlarged; Sales **"Emails Sent" KPI removed** and
  **"Unsigned Docs" KPI hidden on the ALL + Other scopes**.

## ⚠️ Must-do before go-live (still in the testing state)
1. **Auth gate is OFF** (`AUTH_GATE=off` in Vercel) so the site is publicly
   viewable for testing. Set it back to `on` (or delete the var) + redeploy.
   **Note:** flipping the gate on ALSO re-secures the Logs viewer (logs are public
   only while the gate is off — see below).
2. **Verify `NEXT_PUBLIC_AUTO_LOAD_BUNDLED`** — must be `false`/removed for live PRO
   data (`true` shows bundled TEST data). The bundled test `.xlsx` were stripped
   from `public/` this session, so dev auto-load no longer has data locally.
3. **Logs public** is intentional for testing (`LOGS_PUBLIC` unset → follows the
   gate). It exposes IPs/UAs/headers — it re-secures automatically when the gate
   goes on, or set `LOGS_PUBLIC=false` to force it gated.
4. **Secret is correct — do NOT change it** (the old "FUCKYOU" was a dev gate test).

## Deploy gotcha seen this session
Pushing `mainv2` normally triggers the Vercel git integration, but there was a lag
where pushes didn't auto-deploy for a while (live build sat ~50 min behind). If a
push doesn't deploy: `npx vercel --prod` from the repo (the auto-mode classifier
blocks prod-infra CLI for the agent, so the **owner** runs it), or Redeploy from
the Vercel dashboard, or check Settings → Git (repo is `discountmedia/…`, scope is
`discountforkliftmedia`).

## Remaining backlog (nothing blocking)
- **Phase-3 polish** (bottom of `docs/UI_OVERHAUL_PLAN.md`): ReconPipeline
  triple-redundancy collapse, unify "$ Behind the Shop" ≡ "Act Now", Sales
  race↔leaderboard link, rep email/phone click-to-copy on the contact card,
  tab-bar segmentation, and removing the dead leaderboard "Emails" column +
  Outreach chart (email data isn't in the PRO staff contract).
- **Print-to-PDF** needs on-device confirmation the FileMaker Web Viewer surfaces a
  "Save as PDF" dialog (`lib/printTable.ts` uses an isolated hidden-iframe print).
- **Uncommitted, intentionally excluded** (still in the working tree): `public/public.7z`
  (a ~3 MB archive that would be publicly downloadable — do NOT commit; delete or
  gitignore), `public/DF Data View Logo.png` (2.9 MB, unreferenced),
  `scripts/gen-pro-url.mjs` (signed-URL minter). Optionally fully remove the
  now-hidden `/admin` route + the unauthenticated `/api/upload` writer before go-live.

## Handy facts
- Verify prod gate: `curl -sS -o /dev/null -w "%{http_code}" https://df-ai-data-visualizerv2.vercel.app/` (200 = gate off, 401 = on).
- Verify logs public: `curl -sS https://df-ai-data-visualizerv2.vercel.app/api/logs/auth` → `{"configured":true,"authed":true}` when public.
- Verify changes: `npm run typecheck` + `npm run build`. No test suite.
- `scripts/gen-pro-url.mjs https://<host>/logs matt` mints a signed logs link (for when logs are gated again).
