# Page override — `/tools/backtest`

Read `../MASTER.md` first. Hard Constraints always apply.

## Layout
`03 / BACKTEST` header. Controls left | 3D stage (tabs: `RIBBON` | `SWEEP`).
Below: equity vs benchmark (strategy solid, benchmark dotted), drawdown
(hatched area), monthly returns heatmap, trade list (virtualized), metrics
table (strategy vs benchmark columns).

## Controls
Asset, date range, strategy preset (BUY & HOLD, SMA/EMA CROSS, TS MOMENTUM,
RSI MEAN REVERSION, BOLLINGER BREAKOUT, PORTFOLIO REBALANCE (monthly, from a
saved/linked portfolio)), preset params, commission bps, slippage bps, sizing
(% equity / fixed notional / vol target), stop-loss %, sweep axes (choose 2
params + ranges, ≤ 40×40 grid).
Always-visible realism note: `SIGNAL @ CLOSE(t) → FILL @ OPEN(t+1)`.

## Visual encoding
- Ribbon: equity extruded along time, width = exposure; drawdowns carved
  underneath as voids with dither texture. Trades as ticks on ribbon edge:
  entries ▲ solid, exits ▼ outlined.
- Sweep surface: x/y = params, height = Sharpe, wireframe where Sharpe < 0,
  solid where > 0; current param set marked with a white pin. Click a cell →
  loads params (also URL); keyboard: arrow keys move across grid, Enter loads.
  Overfitting caution label permanently shown on the sweep: `IN-SAMPLE · BEST
  CELL IS OPTIMISTIC`.
- Monthly heatmap: luminance = |return|, hatch = negative, value printed.

## Trade list columns
#, side, entry date, entry px, exit date, exit px, bars held, return %, P&L
(sign + ▲/▼), exit reason (SIGNAL | STOP | END).
