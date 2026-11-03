import { describe, expect, it } from 'vitest';
import { backtestRebalance, monthlyReturns, runBacktest, signals, simulateSingle, sweep, type Bar, type BacktestParams } from './backtest';
import { createRng } from './prng';

const DAY = 86_400_000;
const T0 = Date.UTC(2024, 0, 1);
const bar = (i: number, o: number, c: number, h = Math.max(o, c), l = Math.min(o, c)): Bar => ({ t: T0 + i * DAY, o, h, l, c });

const base: BacktestParams = {
  strategy: { kind: 'buyhold' },
  commissionBps: 0,
  slippageBps: 0,
  sizing: { mode: 'percent', fraction: 1 },
  stopLoss: null,
  initialCapital: 10_000,
  ppy: 252,
  rf: 0,
};

function randomBars(n: number, seed = 1): Bar[] {
  const rng = createRng(seed);
  let p = 100;
  return Array.from({ length: n }, (_, i) => {
    const o = p * (1 + 0.003 * rng.normal());
    const c = o * (1 + 0.015 * rng.normal());
    const h = Math.max(o, c) * (1 + 0.004 * rng.next());
    const l = Math.min(o, c) * (1 - 0.004 * rng.next());
    p = c;
    return { t: T0 + i * DAY, o, h, l, c };
  });
}

describe('backtest — execution model', () => {
  const bars = [bar(0, 100, 100), bar(1, 102, 104), bar(2, 104, 110), bar(3, 111, 108)];

  it('buy & hold: signal at close(0) fills at open(1); final = capital·close/open₁', () => {
    const r = runBacktest(bars, base);
    expect(r.equity[0]).toBe(10_000);
    expect(r.equity[1]).toBeCloseTo((10_000 / 102) * 104, 9);
    expect(r.equity[3]).toBeCloseTo((10_000 / 102) * 108, 9);
    expect(r.trades).toHaveLength(1);
    expect(r.trades[0]!.entryIndex).toBe(1);
    expect(r.trades[0]!.reason).toBe('end');
  });

  it('commission and slippage are charged on entry notional', () => {
    const r = runBacktest(bars, { ...base, commissionBps: 10, slippageBps: 20 });
    const px = 102 * 1.002;
    const units = 10_000 / 1.001 / px;
    expect(r.equity[3]).toBeCloseTo(units * 108, 8);
    expect(r.metrics.costs).toBeCloseTo((10_000 / 1.001) * 0.001, 8);
  });

  it('NO LOOK-AHEAD: changing bar t (close/high/low) never changes the position held in bar t', () => {
    const bs = randomBars(300, 3);
    const p: BacktestParams = { ...base, strategy: { kind: 'macross', fast: 5, slow: 20, ma: 'sma' } };
    const a = simulateSingle(bs, p, signals(bs, p.strategy));
    for (const t of [50, 120, 299]) {
      const mod = bs.map((b, i) => (i === t ? { ...b, c: b.c * 1.5, h: b.h * 1.5 } : b));
      const b2 = simulateSingle(mod, p, signals(mod, p.strategy));
      // position (units) held through bar t is decided before bar t's close is known
      const unitsA = a.equity[t - 1]! > 0 ? a.exposure[t]! / bs[t]!.c : 0;
      const unitsB = b2.equity[t - 1]! > 0 ? b2.exposure[t]! / mod[t]!.c : 0;
      expect(unitsA === 0).toBe(unitsB === 0);
      for (let i = 0; i < t; i++) expect(b2.equity[i]).toBe(a.equity[i]);
    }
  });

  it('signals are causal: prefix of a longer series gives identical signals', () => {
    const bs = randomBars(400, 4);
    for (const s of [
      { kind: 'macross', fast: 10, slow: 30, ma: 'ema' } as const,
      { kind: 'momentum', lookback: 20, threshold: 0 } as const,
      { kind: 'rsi', period: 14, lower: 30, upper: 55 } as const,
      { kind: 'bollinger', period: 20, k: 2 } as const,
    ]) {
      const full = signals(bs, s);
      const pre = signals(bs.slice(0, 250), s);
      expect(Array.from(full.slice(0, 250))).toEqual(Array.from(pre));
    }
  });

  it('stop-loss exits intrabar at the stop price', () => {
    const bs = [bar(0, 100, 100), bar(1, 100, 101), bar(2, 101, 99, 101, 89), bar(3, 99, 100)];
    const r = runBacktest(bs, { ...base, stopLoss: 0.1 });
    expect(r.trades[0]!.reason).toBe('stop');
    expect(r.trades[0]!.exitPrice).toBeCloseTo(90, 12);
    expect(r.equity[3]).toBeCloseTo(9_000, 9); // flat after stop, no re-entry while signal stays on
  });

  it('stop-loss gap: open below the stop fills at the open', () => {
    const bs = [bar(0, 100, 100), bar(1, 100, 101), bar(2, 80, 82, 83, 79), bar(3, 82, 85)];
    const r = runBacktest(bs, { ...base, stopLoss: 0.1 });
    expect(r.trades[0]!.exitPrice).toBe(80);
  });

  it('vol-target sizing scales exposure inversely to realized vol', () => {
    const bs = randomBars(200, 8);
    const r = runBacktest(bs, { ...base, sizing: { mode: 'voltarget', target: 0.05, lookback: 20, maxLeverage: 1 } });
    expect(r.metrics.exposure).toBeCloseTo(179 / 199, 12); // flat only during the 20-bar vol warm-up
    expect(r.exposure[50]).toBeLessThan(0.5); // ~24% vol asset at 5% target
  });

  it('metrics: buy & hold benchmark has beta 1 vs itself; trade stats consistent', () => {
    const bs = randomBars(500, 9);
    const r = runBacktest(bs, { ...base, strategy: { kind: 'macross', fast: 10, slow: 40, ma: 'sma' }, commissionBps: 5 });
    expect(r.benchmarkMetrics.beta).toBeCloseTo(1, 12);
    expect(r.metrics.trades).toBe(r.trades.length);
    const sumPnl = r.trades.reduce((s, t) => s + t.pnl, 0);
    expect(r.equity.at(-1)! - 10_000).toBeCloseTo(sumPnl, 6);
  });
});

describe('monthly returns', () => {
  it('chains month-end equity', () => {
    const t = [Date.UTC(2024, 0, 2), Date.UTC(2024, 0, 31), Date.UTC(2024, 1, 1), Date.UTC(2024, 1, 29), Date.UTC(2024, 2, 1)];
    const eq = [100, 110, 105, 121, 121];
    const m = monthlyReturns(t, eq);
    expect(m).toHaveLength(3);
    expect(m[0]!.ret).toBeCloseTo(0.1, 14);
    expect(m[1]!.ret).toBeCloseTo(0.1, 14);
    expect(m[2]!.ret).toBe(0);
  });
});

describe('monthly rebalance', () => {
  it('constant prices → equity constant minus costs', () => {
    const mk = (p: number) => Array.from({ length: 70 }, (_, i) => bar(i, p, p));
    const r = backtestRebalance([mk(10), mk(20)], { weights: [0.6, 0.4], commissionBps: 0, slippageBps: 0, initialCapital: 1000 });
    expect(r.equity.at(-1)).toBeCloseTo(1000, 9);
    const c = backtestRebalance([mk(10), mk(20)], { weights: [0.6, 0.4], commissionBps: 10, slippageBps: 0, initialCapital: 1000 });
    expect(c.equity.at(-1)!).toBeLessThan(1000);
    expect(c.costs).toBeGreaterThan(0);
  });
});

describe('rebalance allocation timing', () => {
  it('invests at the open of bar 1, not at the first month boundary', () => {
    // asset doubles in the first week of January
    const a = Array.from({ length: 40 }, (_, i) => bar(i, i < 2 ? 100 : 200, i < 1 ? 100 : 200));
    const b = Array.from({ length: 40 }, (_, i) => bar(i, 50, 50));
    const r = backtestRebalance([a, b], { weights: [0.5, 0.5], commissionBps: 0, slippageBps: 0, initialCapital: 1000 });
    // bought A at open(1)=100 → 5 units × 200 + 500 in B = 1500
    expect(r.equity[5]).toBeCloseTo(1500, 9);
  });
  it("mode 'none' lets weights drift (no further trades)", () => {
    const up = Array.from({ length: 70 }, (_, i) => bar(i, 100 * 1.01 ** i, 100 * 1.01 ** i));
    const flat = Array.from({ length: 70 }, (_, i) => bar(i, 100, 100));
    const drift = backtestRebalance([up, flat], { weights: [0.5, 0.5], commissionBps: 10, slippageBps: 0, initialCapital: 1000, mode: 'none' });
    const monthly = backtestRebalance([up, flat], { weights: [0.5, 0.5], commissionBps: 10, slippageBps: 0, initialCapital: 1000 });
    expect(drift.turnover).toBeCloseTo(1, 9); // only the initial buy
    expect(monthly.turnover).toBeGreaterThan(1);
  });
});

describe('parameter sweep', () => {
  it('fills valid cells, NaN for invalid (fast ≥ slow)', () => {
    const bs = randomBars(300, 12);
    const res = sweep(
      bs,
      { ...base, strategy: { kind: 'macross', fast: 5, slow: 20, ma: 'sma' } },
      { key: 'fast', values: [5, 10, 30] },
      { key: 'slow', values: [20, 40] },
      (fast, slow) => (fast < slow ? { kind: 'macross', fast, slow, ma: 'sma' } : null),
    );
    expect(Number.isFinite(res.sharpe[0]!)).toBe(true); // 5/20
    expect(Number.isNaN(res.sharpe[2]!)).toBe(true); // 30/20 invalid
    expect(Number.isFinite(res.sharpe[5]!)).toBe(true); // 30/40
  });
});
