---
name: discount-forklift-design
description: Use this skill to generate well-branded interfaces and assets for Discount Forklift — the internal "Inventory Intelligence" operations tooling — either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping in the dark, terminal-styled, monospace house style.
user-invocable: true
---

Read the `README.md` file within this skill, and explore the other available files.

This design system describes Discount Forklift's internal data tooling — a dark,
monospace, terminal-styled operations aesthetic with a single hot-red brand
accent (`#ff2b2b`), a strict status-color palette, hairline-bordered flat cards,
and Unicode-glyph iconography. IBM Plex Mono is the only typeface.

Key files:
- `README.md` — product context, content + visual foundations, iconography.
- `colors_and_type.css` — all design tokens (import first).
- `assets/wordmark.html` — the text wordmark (no logo image exists in source).
- `preview/` — specimen cards for colors, type, components.
- `ui_kits/dashboard/` — interactive recreation of the Inventory Intelligence
  Dashboard, with reusable JSX components and its own README.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy
assets out and create static HTML files for the user to view. If working on
production code, you can copy assets and read the rules here to become an expert
in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they
want to build or design, ask some questions, and act as an expert designer who
outputs HTML artifacts _or_ production code, depending on the need.

House rules worth repeating:
- Dark theme is the default; everything is monospace (IBM Plex Mono).
- Brand red is scarce — wordmark, top-rule, primary action, active state, act-now.
- Status colors are semantic and consistent (ready/working/diag/rent + pif/downpmt/govt).
- **No pie charts.** Bars, scatter, stacked bars, CSS distribution bars only.
- Icons are Unicode glyphs (`⚠ ⚡ ↥ → ✓ ○ ☀ ☾ ↑ ↓ ↕ ▾ ▸ · —`); no icon font, no decorative emoji.
- Cards: `--panel` bg, 1px `--line` border, 6px radius. Almost no drop shadows.
- Copy is terse, imperative, honest about data confidence; em-dash and `·` are signature.
