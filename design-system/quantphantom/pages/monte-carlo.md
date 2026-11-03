# Page override — `/tools/monte-carlo`

Read `../MASTER.md` first. Hard Constraints always apply.

## Layout
`01 / MONTE CARLO` header row with asset, model, seed, N readouts.
≥1024: controls (320px left) | 3D stage (fills, min 560px tall) ; below: 2D
companions in 2 columns (fan chart w/ percentile bands; terminal histogram) →
metrics table → methodology drawer trigger → Explain panel.
<1024: stage (60svh) → collapsible controls sheet → charts stacked.

## Controls (order)
Asset search (crypto|stock tabs) · Lookback (1Y/2Y/5Y/custom) · Horizon (days) ·
Paths (100–50,000, log slider, shows est. compute time) · Model segmented
(`GBM` | `BOOTSTRAP`) · μ, σ (estimated, editable, `≈` prefix until edited, RESET) ·
Block size (bootstrap only) · Target price · Seed (hex, `↻` randomize) · RUN.

## Visual encoding
- Percentile bands: 5–95 as Bayer-dither fill (sparse), 25–75 denser dither,
  median solid 2px white. Target line dotted with label.
- Paths ending above start: solid; below: dashed (2D, sample of ≤200 paths).
- 3D fan: x = time, y = price, z = rank by terminal value; lines additive
  white at low alpha → density emerges; fog/dither in post. Terminal histogram
  wall at x = T: bars above start price solid, below wireframe/hatched.
- Streaming: paths appear in batches as worker posts chunks; progress readout
  `PATHS 4,096 / 10,000`.

## Metrics table (mono)
Median, mean, P5/P25/P75/P95 terminal, P(S_T > target), P(S_T < S_0),
VaR 95/99, CVaR 95/99 at horizon (both historical-sim and parametric where
applicable), μ, σ (annualized), annualization basis (252 / 365).

## Overrides
Density: tool scale (8–32px). Stage aspect never collapses below 320px height.
