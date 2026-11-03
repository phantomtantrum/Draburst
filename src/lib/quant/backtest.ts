import { bollinger, ema, realizedVol, rsi, sma, trailingReturn } from './indicators';
import { beta as betaFn, cagr, calmar, drawdown, sharpe, sortino, annualizedVol } from './metrics';
import { historicalCVaR, historicalVaR, parametricCVaR, parametricVaR } from './risk';
import { simpleReturns } from './returns';

/**
 * Single-asset, long/flat backtester with NO LOOK-AHEAD:
 *   • the signal is computed on the CLOSE of bar t using data ≤ t
 *   • orders fill at the OPEN of bar t+1 (± slippage), commission on notional
 *   • optional stop-loss is checked intrabar on bar lows; gaps fill at the open
 * Prices must be split/dividend-adjusted OHLC.
 */

export interface Bar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type StrategySpec =
  | { kind: 'buyhold' }
  | { kind: 'macross'; fast: number; slow: number; ma: 'sma' | 'ema' }
  | { kind: 'momentum'; lookback: number; threshold: number }
  | { kind: 'rsi'; period: number; lower: number; upper: number }
  | { kind: 'bollinger'; period: number; k: number };

export type Sizing = { mode: 'percent'; fraction: number } | { mode: 'voltarget'; target: number; lookback: number; maxLeverage: number };

export interface BacktestParams {
  strategy: StrategySpec;
  commissionBps: number;
  slippageBps: number;
  sizing: Sizing;
  /** e.g. 0.1 = exit when price falls 10% below entry; null = off */
  stopLoss: number | null;
  initialCapital: number;
  ppy: number;
  rf: number;
}

export interface Trade {
  entryIndex: number;
  entryTime: number;
  entryPrice: number;
  exitIndex: number;
  exitTime: number;
  exitPrice: number;
  units: number;
  barsHeld: number;
  /** net return on the position incl. both legs' costs */
  ret: number;
  pnl: number;
  reason: 'signal' | 'stop' | 'end';
}

export interface BacktestMetrics {
  totalReturn: number;
  cagr: number;
  vol: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  maxDrawdownBars: number;
  calmar: number;
  var95: number;
  cvar95: number;
  pVar95: number;
  pCvar95: number;
  beta: number;
  exposure: number;
  trades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  costs: number;
}

export interface BacktestResult {
  equity: Float64Array;
  exposure: Float64Array;
  drawdown: Float64Array;
  benchmark: Float64Array;
  benchmarkDrawdown: Float64Array;
  trades: Trade[];
  metrics: BacktestMetrics;
  benchmarkMetrics: BacktestMetrics;
  monthly: MonthlyReturn[];
}

export interface MonthlyReturn {
  year: number;
  month: number; // 1–12
  ret: number;
}

/** Desired exposure (0/1) decided at each bar's CLOSE, using data ≤ t only. */
export function signals(bars: ReadonlyArray<Bar>, s: StrategySpec): Uint8Array {
  const n = bars.length;
  const close = Float64Array.from(bars, (b) => b.c);
  const out = new Uint8Array(n);
  switch (s.kind) {
    case 'buyhold':
      out.fill(1);
      return out;
    case 'macross': {
      const f = s.ma === 'ema' ? ema(close, s.fast) : sma(close, s.fast);
      const sl = s.ma === 'ema' ? ema(close, s.slow) : sma(close, s.slow);
      for (let i = 0; i < n; i++) out[i] = f[i]! > sl[i]! ? 1 : 0; // NaN compares false → flat
      return out;
    }
    case 'momentum': {
      const r = trailingReturn(close, s.lookback);
      for (let i = 0; i < n; i++) out[i] = r[i]! > s.threshold ? 1 : 0;
      return out;
    }
    case 'rsi': {
      const r = rsi(close, s.period);
      let pos = 0;
      for (let i = 0; i < n; i++) {
        const v = r[i]!;
        if (pos === 0 && v < s.lower) pos = 1;
        else if (pos === 1 && v > s.upper) pos = 0;
        out[i] = pos;
      }
      return out;
    }
    case 'bollinger': {
      const b = bollinger(close, s.period, s.k);
      let pos = 0;
      for (let i = 0; i < n; i++) {
        if (pos === 0 && close[i]! > b.upper[i]!) pos = 1;
        else if (pos === 1 && close[i]! < b.mid[i]!) pos = 0;
        out[i] = pos;
      }
      return out;
    }
  }
}

export function runBacktest(bars: ReadonlyArray<Bar>, p: BacktestParams, benchmarkReturns?: ArrayLike<number>): BacktestResult {
  const core = simulateSingle(bars, p, signals(bars, p.strategy));
  const bh = simulateSingle(bars, { ...p, strategy: { kind: 'buyhold' }, stopLoss: null, sizing: { mode: 'percent', fraction: 1 } }, signals(bars, { kind: 'buyhold' }));
  const bench = benchmarkReturns ?? simpleReturns(bh.equity);
  return {
    equity: core.equity,
    exposure: core.exposure,
    drawdown: drawdown(core.equity).series,
    benchmark: bh.equity,
    benchmarkDrawdown: drawdown(bh.equity).series,
    trades: core.trades,
    metrics: computeMetrics(core.equity, core.exposure, core.trades, core.costs, p, bench),
    benchmarkMetrics: computeMetrics(bh.equity, bh.exposure, bh.trades, bh.costs, p, bench),
    monthly: monthlyReturns(bars.map((b) => b.t), core.equity),
  };
}

interface SimOut {
  equity: Float64Array;
  exposure: Float64Array;
  trades: Trade[];
  costs: number;
}

export function simulateSingle(bars: ReadonlyArray<Bar>, p: BacktestParams, sig: Uint8Array): SimOut {
  const n = bars.length;
  const equity = new Float64Array(n);
  const exposure = new Float64Array(n);
  const trades: Trade[] = [];
  const comm = p.commissionBps / 1e4;
  const slip = p.slippageBps / 1e4;
  const close = Float64Array.from(bars, (b) => b.c);
  const rv = p.sizing.mode === 'voltarget' ? realizedVol(close, p.sizing.lookback, p.ppy) : null;

  let cash = p.initialCapital;
  let units = 0;
  let entry: { i: number; px: number; cost: number; units: number } | null = null;
  let stopped = false; // after a stop, wait for the signal to reset before re-entering
  let costs = 0;
  if (n === 0) return { equity, exposure, trades, costs };
  equity[0] = cash;

  const exit = (i: number, rawPx: number, reason: Trade['reason']) => {
    const px = reason === 'end' ? rawPx : rawPx * (1 - slip);
    const gross = units * px;
    const c = reason === 'end' ? 0 : gross * comm;
    cash += gross - c;
    costs += c;
    const e = entry!;
    const pnl = gross - c - (e.units * e.px + e.cost);
    trades.push({
      entryIndex: e.i,
      entryTime: bars[e.i]!.t,
      entryPrice: e.px,
      exitIndex: i,
      exitTime: bars[i]!.t,
      exitPrice: px,
      units: e.units,
      barsHeld: i - e.i,
      ret: pnl / (e.units * e.px + e.cost),
      pnl,
      reason,
    });
    units = 0;
    entry = null;
  };

  for (let t = 1; t < n; t++) {
    const bar = bars[t]!;
    const want = sig[t - 1]!; // decided at previous close
    if (want === 0) stopped = false;

    // 1) execute at the open
    if (units > 0 && want === 0) exit(t, bar.o, 'signal');
    else if (units === 0 && want === 1 && !stopped) {
      let frac = 1;
      if (p.sizing.mode === 'percent') frac = p.sizing.fraction;
      else {
        const v = rv![t - 1]!;
        frac = Number.isFinite(v) && v > 0 ? Math.min(p.sizing.maxLeverage, p.sizing.target / v) : 0;
      }
      if (frac > 0) {
        const px = bar.o * (1 + slip);
        const eq = cash; // flat → equity = cash
        const notional = (eq * frac) / (1 + comm);
        units = notional / px;
        const c = notional * comm;
        cash -= notional + c;
        costs += c;
        entry = { i: t, px, cost: c, units };
      }
    }

    // 2) intrabar stop-loss on the low (gap below the stop fills at the open)
    if (units > 0 && p.stopLoss != null && entry) {
      const stopPx = (entry as { px: number }).px * (1 - p.stopLoss);
      if (bar.l <= stopPx) {
        exit(t, Math.min(bar.o, stopPx), 'stop');
        stopped = true;
      }
    }

    // 3) mark to market at the close
    equity[t] = cash + units * bar.c;
    exposure[t] = equity[t]! > 0 ? (units * bar.c) / equity[t]! : 0;
  }
  if (units > 0) exit(n - 1, bars[n - 1]!.c, 'end');
  return { equity, exposure, trades, costs };
}

export function computeMetrics(
  equity: Float64Array,
  exposure: Float64Array,
  trades: Trade[],
  costs: number,
  p: Pick<BacktestParams, 'ppy' | 'rf' | 'initialCapital'>,
  benchmarkReturns: ArrayLike<number>,
): BacktestMetrics {
  const r = simpleReturns(equity);
  const dd = drawdown(equity);
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);
  const grossWin = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = -losses.reduce((s, t) => s + t.pnl, 0);
  let exp = 0;
  for (let i = 1; i < exposure.length; i++) exp += exposure[i]! > 0 ? 1 : 0;
  return {
    totalReturn: equity[equity.length - 1]! / equity[0]! - 1,
    cagr: cagr(equity, p.ppy),
    vol: annualizedVol(r, p.ppy),
    sharpe: sharpe(r, p.ppy, p.rf),
    sortino: sortino(r, p.ppy, p.rf),
    maxDrawdown: dd.maxDrawdown,
    maxDrawdownBars: dd.durationBars,
    calmar: calmar(equity, p.ppy),
    var95: historicalVaR(r, 0.95),
    cvar95: historicalCVaR(r, 0.95),
    pVar95: parametricVaR(r, 0.95),
    pCvar95: parametricCVaR(r, 0.95),
    beta: betaFn(r, benchmarkReturns),
    exposure: exposure.length > 1 ? exp / (exposure.length - 1) : 0,
    trades: trades.length,
    winRate: trades.length ? wins.length / trades.length : NaN,
    avgWin: wins.length ? wins.reduce((s, t) => s + t.ret, 0) / wins.length : NaN,
    avgLoss: losses.length ? losses.reduce((s, t) => s + t.ret, 0) / losses.length : NaN,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : NaN,
    costs,
  };
}

/** Calendar-month returns (UTC) from an equity curve aligned to timestamps. */
export function monthlyReturns(times: ArrayLike<number>, equity: ArrayLike<number>): MonthlyReturn[] {
  const out: MonthlyReturn[] = [];
  if (equity.length === 0) return out;
  let prevEnd = equity[0]!;
  let cur = monthKey(times[0]!);
  let lastEq = equity[0]!;
  for (let i = 1; i < equity.length; i++) {
    const k = monthKey(times[i]!);
    if (k.key !== cur.key) {
      out.push({ year: cur.y, month: cur.m, ret: lastEq / prevEnd - 1 });
      prevEnd = lastEq;
      cur = k;
    }
    lastEq = equity[i]!;
  }
  out.push({ year: cur.y, month: cur.m, ret: lastEq / prevEnd - 1 });
  return out;
}

function monthKey(t: number) {
  const d = new Date(t);
  const y = d.getUTCFullYear(),
    m = d.getUTCMonth() + 1;
  return { y, m, key: y * 100 + m };
}

/* ── Monthly-rebalanced multi-asset portfolio ── */

export interface RebalanceParams {
  weights: ArrayLike<number>;
  commissionBps: number;
  slippageBps: number;
  initialCapital: number;
}

/**
 * Rebalance to target weights at the OPEN of the first bar of each month
 * (decided from the previous month's last close). `bars[a][t]` must be
 * calendar-aligned across assets.
 */
export function backtestRebalance(bars: ReadonlyArray<ReadonlyArray<Bar>>, p: RebalanceParams): { equity: Float64Array; turnover: number; costs: number } {
  const A = bars.length;
  const n = A ? bars[0]!.length : 0;
  const equity = new Float64Array(n);
  const units = new Float64Array(A);
  const cost = (p.commissionBps + p.slippageBps) / 1e4;
  let cash = p.initialCapital;
  let turnover = 0,
    costs = 0;
  let lastMonth = -1;
  for (let t = 0; t < n; t++) {
    const m = new Date(bars[0]![t]!.t).getUTCMonth();
    if (t > 0 && m !== lastMonth) {
      // value at the open
      let eq = cash;
      for (let a = 0; a < A; a++) eq += units[a]! * bars[a]![t]!.o;
      let tradeNotional = 0;
      const targetUnits = new Float64Array(A);
      for (let a = 0; a < A; a++) {
        targetUnits[a] = (eq * p.weights[a]!) / bars[a]![t]!.o;
        tradeNotional += Math.abs(targetUnits[a]! - units[a]!) * bars[a]![t]!.o;
      }
      const c = tradeNotional * cost;
      // scale down so that costs are paid from the portfolio
      const k = eq > 0 ? (eq - c) / eq : 0;
      cash = eq;
      for (let a = 0; a < A; a++) {
        units[a] = targetUnits[a]! * k;
        cash -= units[a]! * bars[a]![t]!.o;
      }
      cash -= c;
      turnover += eq > 0 ? tradeNotional / eq : 0;
      costs += c;
    }
    lastMonth = m;
    let eq = cash;
    for (let a = 0; a < A; a++) eq += units[a]! * bars[a]![t]!.c;
    equity[t] = eq;
  }
  return { equity, turnover, costs };
}

/* ── Parameter sweep ── */

export interface SweepAxis {
  key: string;
  values: number[];
}

export function sweep(
  bars: ReadonlyArray<Bar>,
  base: BacktestParams,
  x: SweepAxis,
  y: SweepAxis,
  /** build the strategy for a cell; return null for invalid combinations */
  build: (xv: number, yv: number) => StrategySpec | null,
): { sharpe: Float64Array; cagr: Float64Array; maxDrawdown: Float64Array } {
  const nx = x.values.length,
    ny = y.values.length;
  const sh = new Float64Array(nx * ny).fill(NaN);
  const cg = new Float64Array(nx * ny).fill(NaN);
  const md = new Float64Array(nx * ny).fill(NaN);
  for (let j = 0; j < ny; j++)
    for (let i = 0; i < nx; i++) {
      const s = build(x.values[i]!, y.values[j]!);
      if (!s) continue;
      const sim = simulateSingle(bars, { ...base, strategy: s }, signals(bars, s));
      const r = simpleReturns(sim.equity);
      sh[j * nx + i] = sharpe(r, base.ppy, base.rf);
      cg[j * nx + i] = cagr(sim.equity, base.ppy);
      md[j * nx + i] = drawdown(sim.equity).maxDrawdown;
    }
  return { sharpe: sh, cagr: cg, maxDrawdown: md };
}
