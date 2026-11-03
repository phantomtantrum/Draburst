import { describe, expect, it } from 'vitest';
import { beta, cagr, calmar, drawdown, perPeriodRf, sharpe, sortino, annualizedVol } from './metrics';
import { equityFromReturns, logReturns, periodsPerYear, simpleReturns, totalReturn } from './returns';

describe('returns', () => {
  it('simple and log returns', () => {
    const r = simpleReturns([100, 110, 99]);
    expect(r[0]).toBeCloseTo(0.1, 15);
    expect(r[1]).toBeCloseTo(-0.1, 15);
    const l = logReturns([100, 110, 99]);
    expect(l[0]).toBeCloseTo(Math.log(1.1), 15);
    expect(l[0]! + l[1]!).toBeCloseTo(Math.log(0.99), 15);
  });
  it('annualization basis: 252 stocks, 365 crypto, 252 mixed', () => {
    expect(periodsPerYear('stock')).toBe(252);
    expect(periodsPerYear('crypto')).toBe(365);
    expect(periodsPerYear(['crypto', 'crypto'])).toBe(365);
    expect(periodsPerYear(['crypto', 'stock'])).toBe(252);
  });
  it('equity round-trip and total return', () => {
    const r = [0.1, -0.1, 0.05];
    const eq = equityFromReturns(r, 100);
    expect(eq[3]).toBeCloseTo(100 * 1.1 * 0.9 * 1.05, 12);
    expect(totalReturn(r)).toBeCloseTo(1.1 * 0.9 * 1.05 - 1, 14);
  });
});

describe('metrics — hand-computed', () => {
  it('CAGR', () => {
    expect(cagr([100, 121], 1)).toBeCloseTo(0.21, 14);
    expect(cagr([100, 110, 121], 2)).toBeCloseTo(0.21, 14);
    // 2 years doubling → √2 − 1
    expect(cagr([100, 150, 200], 1)).toBeCloseTo(Math.SQRT2 - 1, 14);
    expect(cagr([100, 50, 0], 1)).toBe(-1);
  });

  it('Sharpe: r=[1%,2%,−1%,3%], ppy=4 → 0.0125/0.0170783·2', () => {
    const r = [0.01, 0.02, -0.01, 0.03];
    // var = (6.25e-6 + 5.625e-5 + 5.0625e-4 + 3.0625e-4)/3 = 2.916667e-4
    const s = Math.sqrt(8.75e-4 / 3);
    expect(sharpe(r, 4)).toBeCloseTo((0.0125 / s) * 2, 12);
    expect(sharpe(r, 4)).toBeCloseTo(1.4638501, 6);
  });

  it('Sharpe with annual rf converts to per-period geometrically', () => {
    expect(perPeriodRf(0.0816, 2)).toBeCloseTo(0.04, 12);
    const r = [0.05, 0.03, 0.06, 0.02];
    const rf = 0.0816;
    const ex = r.map((x) => x - 0.04);
    const m = ex.reduce((a, b) => a + b) / 4;
    const sd = Math.sqrt(ex.reduce((a, b) => a + (b - m) ** 2, 0) / 3);
    expect(sharpe(r, 2, rf)).toBeCloseTo((m / sd) * Math.SQRT2, 12);
  });

  it('Sortino: only −1% is downside → DD = √(1e-4/4) = 0.005 → 0.0125/0.005·2 = 5', () => {
    expect(sortino([0.01, 0.02, -0.01, 0.03], 4)).toBeCloseTo(5, 12);
  });

  it('annualized vol', () => {
    expect(annualizedVol([0.01, -0.01, 0.01, -0.01], 252)).toBeCloseTo(Math.sqrt(4e-4 / 3) * Math.sqrt(252), 12);
  });

  it('max drawdown, indices, recovery and duration', () => {
    const eq = [100, 110, 99, 120, 108, 90, 95];
    const d = drawdown(eq);
    expect(d.maxDrawdown).toBeCloseTo(0.25, 14); // 120 → 90
    expect(d.peakIndex).toBe(3);
    expect(d.troughIndex).toBe(5);
    expect(d.recoveryIndex).toBe(-1);
    expect(d.durationBars).toBe(3); // unrecovered: peak(3) → last(6)
    expect(d.series[2]).toBeCloseTo(-0.1, 14);
    expect(d.series[1]).toBe(0);
  });

  it('drawdown that recovers', () => {
    const d = drawdown([100, 80, 90, 100, 105]);
    expect(d.maxDrawdown).toBeCloseTo(0.2, 14);
    expect(d.recoveryIndex).toBe(3);
    expect(d.durationBars).toBe(3);
    expect(d.longestDurationBars).toBe(3);
  });

  it('monotonic equity has zero drawdown, NaN Calmar', () => {
    const d = drawdown([1, 2, 3]);
    expect(d.maxDrawdown).toBe(0);
    expect(d.durationBars).toBe(0);
    expect(Number.isNaN(calmar([1, 2, 3], 1))).toBe(true);
  });

  it('Calmar = CAGR / |MDD|', () => {
    const eq = [100, 80, 121];
    expect(calmar(eq, 2)).toBeCloseTo(0.21 / 0.2, 12);
  });

  it('beta of a levered series is the leverage', () => {
    const b = [0.01, -0.02, 0.015, 0.003, -0.007];
    const r = b.map((x) => 2 * x + 0.001);
    expect(beta(r, b)).toBeCloseTo(2, 12);
    expect(beta(b, b)).toBeCloseTo(1, 14);
  });
});

import { fmtNum, fmtPct, fmtSigned } from '@/lib/format';
describe('format', () => {
  it('uses U+2212 minus and never prints −0', () => {
    expect(fmtNum(-1.5, 1)).toBe('−1.5');
    expect(fmtNum(-0.00001, 1)).toBe('0.0');
    expect(fmtPct(-0.0000001, 1)).toBe('0.0%');
    expect(fmtSigned(0.012, 2)).toBe('+0.01');
    expect(fmtSigned(-0.0001, 2)).toBe('0.00');
  });
});
