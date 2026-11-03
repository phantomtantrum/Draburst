# Page override — `/tools/portfolio`

Read `../MASTER.md` first. Hard Constraints always apply.

## Layout
`02 / PORTFOLIO` header. Controls left | 3D stage. Below: frontier 2D chart,
weights table (portfolio columns: MIN-VAR, MAX-SHARPE, EQUAL, CUSTOM),
correlation heatmap, risk-contribution bars, metrics.

## Controls
Asset multi-select 2–20 (chips as bracketed mono labels `[ BTC × ]`), lookback,
risk-free rate (%), covariance estimator (`SAMPLE` | `LEDOIT-WOLF`), long-only
toggle, min/max weight per asset (global + per-row override), random portfolios
count (1k–20k), seed, custom weights editor (sums shown, must = 100%).
Calendar note shown when mixing crypto + stocks: `ALIGNED ON 1,251 COMMON
TRADING DAYS · CRYPTO RESAMPLED TO NYSE CALENDAR`.

## Visual encoding
- Random cloud: points, size uniform, luminance ∝ Sharpe (not hue), x = vol,
  y = return, z = Sharpe.
- Efficient frontier: white tube/ridge, 2px; inefficient lower branch dashed.
- Markers: MIN-VAR ■ solid square, MAX-SHARPE ● solid disc, EQUAL ◆, CUSTOM
  ○ outlined; same glyphs in 2D legend and table headers.
- Correlation: 3D bar field (height = ρ, negative ρ bars hang below plane,
  wireframe); 2D heatmap prints ρ in each cell, hatch for ρ < 0.
- Hover/focus a point → tooltip with weights table (top 5 + "others").
- Risk contribution: horizontal bars, solid; negative contributions hatched.
