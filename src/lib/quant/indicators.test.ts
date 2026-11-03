import { describe, expect, it } from 'vitest';
import { bollinger, ema, rsi, sma, trailingReturn } from './indicators';

describe('indicators', () => {
  it('SMA', () => {
    const s = sma([1, 2, 3, 4, 5], 3);
    expect(Number.isNaN(s[1]!)).toBe(true);
    expect(Array.from(s.slice(2))).toEqual([2, 3, 4]);
  });
  it('EMA seeded by SMA (TA-Lib convention), α = 2/(n+1)', () => {
    const e = ema([1, 2, 3, 4, 5, 6], 3); // α = 0.5
    expect(e[2]).toBe(2);
    expect(e[3]).toBe(3); // 0.5·4 + 0.5·2
    expect(e[4]).toBe(4);
    expect(e[5]).toBe(5);
  });
  it('RSI(14) hand check on rounded closes: avg gain 3.34/14, avg loss 1.40/14 → 70.464', () => {
    const p = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    expect(rsi(p, 14)[14]).toBeCloseTo(100 - 100 / (1 + 3.34 / 1.4), 10);
  });
  it('RSI(14) matches the StockCharts/Wilder worked example', () => {
    // unrounded closes from the StockCharts RSI spreadsheet
    const p = [
      44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245, 45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282,
      46.282, 46.0028, 46.0328, 46.4116, 46.2222, 45.6439,
    ];
    const r = rsi(p, 14);
    expect(r[14]).toBeCloseTo(70.53, 1);
    expect(r[15]).toBeCloseTo(66.32, 1);
    expect(r[16]).toBeCloseTo(66.55, 1);
    expect(r[17]).toBeCloseTo(69.41, 1);
    expect(r[18]).toBeCloseTo(66.36, 1);
    expect(r[19]).toBeCloseTo(57.97, 1);
  });
  it('Bollinger uses population σ', () => {
    const b = bollinger([1, 2, 3, 4], 4, 2);
    const sd = Math.sqrt(1.25);
    expect(b.mid[3]).toBe(2.5);
    expect(b.upper[3]).toBeCloseTo(2.5 + 2 * sd, 14);
  });
  it('causality: appending data never changes past values', () => {
    const a = [10, 11, 12, 11, 13, 14, 13, 15, 16, 15, 14, 16, 17, 18, 17, 19];
    const b = [...a, 1000, 0.01];
    const pairs: Array<[Float64Array, Float64Array]> = [
      [sma(a, 5), sma(b, 5)],
      [ema(a, 5), ema(b, 5)],
      [rsi(a, 5), rsi(b, 5)],
      [trailingReturn(a, 3), trailingReturn(b, 3)],
    ];
    for (const [x, y] of pairs) for (let i = 0; i < a.length; i++) expect(Object.is(x[i], y[i]) || x[i] === y[i]).toBe(true);
  });
});
