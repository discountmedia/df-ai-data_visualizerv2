# CLAUDE.md — Discount Forklift Design System

Standing instructions for **every** design task in this project. This is the
brand's internal operations-tooling design system (dark, monospace, terminal
aesthetic). Read `README.md` for the full brief; `colors_and_type.css` for
tokens; `ui_kits/dashboard/` for component patterns.

## Always
- **Use the design tokens** in `colors_and_type.css` — never invent new colors.
  Brand red `#ff2b2b` is scarce (wordmark, top-rule, primary action, active
  state, act-now). Status colors are semantic and fixed.
- **Type system:** IBM Plex Mono for all chrome (labels, nav, buttons, copy,
  column headers); the condensed display face (Anton, pending the real font)
  for big stat numerals **only**; `system-ui` sans for table data values.
- **Dark theme is the default.** Light theme only swaps the surface/ink ramp.
- **Use the real logo** at `assets/logo.png`, not the text wordmark, when the
  raster works (it's dark-field, so it suits the dark header).
- **Icons are Unicode glyphs** (`⚠ ⚡ ↥ → ✓ ○ ☀ ☾ ↑ ↓ ↕ ▾ ▸ ● · —`). No icon
  fonts, no hand-drawn SVG icons, no decorative emoji.
- **Cards:** `--panel` bg, 1px `--line` border, 6px radius, almost no drop
  shadow. Pills pair colored text with a ~40%-opacity colored border.
- **Copy** is terse, imperative, honest about data confidence. Em-dash and `·`
  are signature separators; `—` is also the universal null value.

## Never
- **No pie charts.** Bars, stacked bars, scatter, and CSS distribution bars only.
- No gradients-as-decoration, no rounded-pill corners, no AI-slop tropes.
- Don't put the condensed display font on anything except big numbers.

## When building
- Prefer adding to / reusing `ui_kits/dashboard/` components over reinventing.
- New visual artifacts (mocks, slides) → copy assets out and produce static HTML.
- Flag any substitution (especially the display font) and ask before adding
  new content sections.

## Known gaps (ask the user)
- Display font is a substitution (Anton) — confirm the real face.
- Logo is a low-res screenshot crop — request a vector + favicon.
- Not yet built: the **Metric · seasonality** view and the **Ledger · Daily
  Activity** dashboard.
