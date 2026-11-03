# Page override — `/` (home)

Read `../MASTER.md` first. Rules here override MASTER only where stated.
Hard Constraints (MASTER §1) always apply.

## Purpose
First contact. Prove "real data, gallery-grade 3D, rigorous quant" in 10 s.

## Section order
1. **00 / HERO — LIVE MARKET SCULPTURE** (100svh). Full-bleed R3F canvas.
   Wordmark `quantphantom` in `display-xl`, bottom-left, mix-blend `difference`.
   Corner readouts: UTC clock, `SRC BINANCE WS`, connection state
   `[ LIVE ]`/`[ STALE 12s ]`, fps (dev only), cursor coordinates.
2. **Live tickers strip** — sticky under hero on scroll; mono; `BTC 68,412.10 ▲ +1.24%`;
   pause button (`aria-label="Pause ticker"`), respects reduced motion (static list).
3. **01–03 / SCROLL INTRO** — pinned canvas; scroll morphs sculpture
   → fan (Monte Carlo) → cloud (Portfolio) → ribbon (Backtest). Each step has a
   left text column (`display-m` title + 2-line body + metric example) and a
   `OPEN TOOL →` link.
4. **04 / TOOLS** — 3-column index (1 column mobile), hairline-separated,
   each with a static dithered thumbnail (pre-rendered PNG, grayscale).
5. **05 / METHOD** — 3 formulas teaser (KaTeX static render), link to `/methodology`.
6. Footer — data attributions, disclaimer, legal links.

## Overrides
- Spacing: marketing scale (48–128px vertical rhythm) — overrides tool density.
- Hero canvas is the only element allowed to exceed the 12-col grid.
- Motion allowance: hero may run continuous animation (it is the brand), but
  pauses when offscreen / tab hidden; reduced motion → static dithered frame
  rendered from the last real snapshot (or pre-baked image if no data).
- Lighthouse targets do **not** apply to `/` (brief §9) but LCP element must be
  the wordmark (text), not the canvas; canvas lazy-mounted after first paint.

## Data
Binance combined stream: `btcusdt@miniTicker`, `ethusdt@miniTicker`,
`solusdt@miniTicker`, + `bnb`, `xrp`, `ada`, `doge`, `avax`. Stocks: last EOD close
(SPY, QQQ, AAPL, NVDA) labelled `[ EOD ]`.
Encoding: turbulence = realized vol (rolling 1h of 1m klines), scale = 24h quote
volume, mutual attraction = rolling correlation of 1m returns, tick → ripple whose
amplitude = |Δp/p|; up-tick ripple solid ring, down-tick dashed ring.
