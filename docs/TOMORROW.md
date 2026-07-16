# Tomorrow — Plan

Ordered by leverage. The critical path is gated on a real PRO test push, so I unblock that first, then work the parallel UI track while it's pending.

## 1 · Unblock the critical path (first thing)
- [ ] Send the FileMaker compliance doc (`docs/FILEMAKER_COMPLIANCE.html`) to the dev / email chain.
- [ ] Get sign-off on the two flagged adaptations: the `typeof Papa` readiness gate, and the `document.body` → `console.warn` no-bridge branch.
- [ ] Confirm with the dev: PRO polls `fileMakerReady()` and only calls `fileMakerReceive` after the `ready` ping.
- [ ] Schedule a **real PRO test push** (even a small one) so data validation isn't stalled.

## 2 · Commit today's work
- [ ] Branch off `mainv2`, then commit the PRO adapter, bridge, auth gate, access logging, and the two docs (nothing left uncommitted).

## 3 · UI consistency queue — parallel track (needs no external input)
Source: `docs/UI_CONSISTENCY_AUDIT.md`.
- [ ] **P1** — fix the priority-queue `nested-interactive` a11y break (clickable `<div>` with nested links → real `<button>` + sibling detail row).
- [ ] **P3-1** — one shared stat-card primitive (resolves the per-tab KPI-numeral size drift + `card-hover` misuse).
- [ ] **P3-2** — one shared `SortHeader` (removes the 3 duplicate implementations).
- [ ] Sweep the **P2** live items (raw hex in live charts, Unsigned list search box, `fmt`/`fmtMoney` bypasses, drifted `unitTitle`, `✦` glyph).

## 4 · Validate against real data (once a push lands)
- [ ] Walk each tab's numbers with the owner to confirm they match reality.
- [ ] Fix whatever the real payload surfaces (unexpected values, edge cases).

## 5 · Live FileMaker Web Viewer smoke test (with the dev)
- [ ] Confirm the handshake, the waiting-screen → data transition, and the receipt callback from a real FileMaker client.

## 6 · Logging (Option A) — if time
- [ ] Wire a Vercel log drain with an alert on the FileMaker-user-agent line.
