# Page override — `/dashboard`

Read `../MASTER.md` first. Hard Constraints always apply.

## Purpose
List and manage saved runs. Auth required; redirect to `/login?next=/dashboard`.

## Layout
`04 / DASHBOARD` header with user email (mono) and SIGN OUT.
Filter tabs: `ALL` `MONTE CARLO` `PORTFOLIO` `BACKTEST` (+ counts).
Table/list (no cards): name (inline rename), tool, asset(s), key metric
(e.g. P(S_T>target), Sharpe, CAGR), seed, created, actions:
OPEN · DUPLICATE · RENAME · DELETE (icon buttons with aria-labels; delete asks
for confirmation in an inline row state, not a modal).
Mobile: rows collapse into stacked hairline blocks.

## Overrides
- Density: highest (8–24px). No 3D on this page; optional 64×24 grayscale
  sparkline thumbnails rendered from stored summary only (no price arrays).
- Empty state: ASCII-dither placeholder + three `START →` links.
- Lighthouse: Performance ≥ 90, Accessibility ≥ 95 (stricter than MASTER).
