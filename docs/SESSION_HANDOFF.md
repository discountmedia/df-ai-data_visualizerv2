# Session handoff — 2026-07-17

Context dump so a fresh chat can pick up cold. Also see the auto-loaded memory files (`pro-*`, `logs-observability-feature`, `webviewer-lockdown-and-deterrents`, `ui-consistency-audit`) and `CLAUDE.md`.

## Where things stand
- **Everything is committed to `mainv2` and deployed** to Vercel (`df-ai-data-visualizerv2.vercel.app`, team `discountforkliftmedia`). Deploy = push `mainv2` (SSH). Vercel CLI is authed here (`npx vercel …`).
- **Live PRO integration works end-to-end** — FileMaker pushed **1,389 rows / 41 cols** on 2026-07-16 (`pro.push.received` ×16 in the logs). Data is in-memory per session (not persisted); a fresh load waits for the next push.
- Built this session: the FileMaker Web Viewer bridge + positional-CSV adapter, the schema-agnostic derive pipeline hookup, the hosted-mode **HMAC auth gate** (`middleware.ts`/`lib/authToken.ts`), the **logs viewer** (signed-token + `LOGS_ACCOUNTS` allowlist, Neon-backed), and **prod deterrents** (no-store, block refresh/right-click/DevTools) + Vercel Analytics.

## ⚠️ Must-do before go-live (currently in a temporary testing state)
1. **Auth gate is OFF right now** — `AUTH_GATE=off` in Vercel (prod root returns 200, publicly viewable) so the owner could do UI work. **Revert to `AUTH_GATE=on` (or delete the var) + redeploy.** `AUTH_GATE` accepts exactly `on`/`off`.
2. **Verify `NEXT_PUBLIC_AUTO_LOAD_BUNDLED`** — it's set in Vercel (value hidden). For LIVE PRO data it must be `false`/removed; `true` makes prod show bundled TEST data. Check before go-live.
3. **Secret is correct — do NOT change it.** The "bad signature / FUCKYOU" the dev saw was his deliberate gate test; our gate correctly rejected it. Vercel's `INVENTORY_ANALYSIS_SECRET` == FileMaker's real secret (verified). The dev just needs to stop testing with `FUCKYOU` and use a real signature.

## Next-chat task queue
1. **Revert the go-live items above** once UI/testing is done.
2. **KPI drill-down → listing + specs (owner request).** In `components/overview/UnitsDrawer.tsx` (the table opened from clickable KPI cards, e.g. "Needs Diagnosis"), make each unit row let you **open its discountforklift.us listing** (`UnitRecord.specs.productUrl` — the Product Server URL) and **show all available info** about the lift. The data is already on each `UnitRecord`: top-level (make/model/type/year/fuel/serial4/forkliftName/location/capacity/soldBy/price/customer) + `.specs` (mast, forkLength, lowered/raisedHeight, tires, hours, attachments, warehouse, productUrl, youtubeUrl). Precedent: `components/media/MediaDrawer.tsx` already renders click-through product/video links with `rel="noopener noreferrer"`, and `PriorityQueue.tsx` has an accordion specs panel — reuse those patterns (keep it accessible: real `<button>` toggle + sibling detail row, per the a11y rules; note the P1 nested-interactive fix in the UI audit).
3. **Make the logs tab public for the testing phase (owner request).** Add a `LOGS_PUBLIC` env flag: when `LOGS_PUBLIC==="true"`, `/api/logs/auth` GET returns `{configured:true, authed:true}`, `/api/logs` GET skips the cookie+allowlist check, and `/api/logs/event` `authorized()` allows it — so `/logs` shows data to anyone (LogsView already goes to "ready" when `authed:true`). ⚠️ Exposes IPs/UAs/headers/access events publicly — testing only; revert before go-live. Files: `lib/logsAuth.ts` (add `logsPublic()`), `app/api/logs/route.ts`, `app/api/logs/auth/route.ts`, `app/api/logs/event/route.ts`.
4. **In-app back/forward buttons (owner request).** The Web Viewer is chromeless (no browser nav) and we disabled refresh, so the app needs its own history nav so users can go back a page. Tabs are state (`activeTab` in `DashboardProvider`), not routes, and drawers/accordions are state too. Cleanest: track a nav stack (tab + open-drawer transitions) in `DashboardProvider` and add Back/Forward buttons in `Header.tsx` that pop/push it — or use the History API (`pushState` on tab/drawer change + buttons calling `history.back()/forward()`), which works in a chromeless viewer and isn't a reload (so it doesn't trip the no-refresh deterrent). Include closing a drawer / returning to the previous tab as "back".
5. **Click-to-copy affordances (owner request).** Right-click is disabled (deterrent), so users can't right-click→copy. Add a reusable copy control (hover "copy" affordance / small button using `navigator.clipboard.writeText` + a "copied" tooltip) on copyable text fields — serials, the product/YouTube URLs, rep email/phone, customer names, etc. Apply across the drawers, tables, and the Sales contact card. Keep it accessible (real `<button>` + `aria-label`).
6. **UI/UX consistency queue** — `docs/UI_CONSISTENCY_AUDIT.md` (ranked; P1 = the priority-queue `nested-interactive` a11y fix; P3 = shared stat-card + shared SortHeader).

## Handy facts
- Verify prod gate: `curl -sS -o /dev/null -w "%{http_code}" https://df-ai-data-visualizerv2.vercel.app/` (200 = gate off, 401 = on).
- Read prod logs from Neon locally: query the `logs` table via `POSTGRES_URL` from `.env.local` (see the throwaway scripts used this session; `scripts/gen-pro-url.mjs` mints a signed test URL).
- Verify changes: `npm run typecheck` + `npm run build`. No test suite.
- Uncommitted-and-intentionally-left: `public/*.xlsx` deletions + `public/public.7z`, `AGENTS.md` (stale dup), `scripts/gen-pro-url.mjs`.
