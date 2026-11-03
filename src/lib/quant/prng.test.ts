import { describe, expect, it } from 'vitest';
import { createRng, parseSeed } from './prng';
import { mean, variance, skewness, excessKurtosis } from './stats';

describe('seedable PRNG (xoshiro128**)', () => {
  it('is deterministic for a seed and differs across seeds', () => {
    const a = createRng(42),
      b = createRng(42),
      c = createRng(43);
    const sa = Array.from({ length: 8 }, () => a.next());
    const sb = Array.from({ length: 8 }, () => b.next());
    const sc = Array.from({ length: 8 }, () => c.next());
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
  });
  it('regression snapshot — sequence must never change (saved seeds must replay)', () => {
    const r = createRng(0x3f2a);
    const v = Array.from({ length: 4 }, () => Math.round(r.next() * 1e9));
    expect(v).toMatchInlineSnapshot(`
      [
        949522367,
        59203678,
        303232926,
        529658480,
      ]
    `);
  });
  it('uniform in [0,1) with correct moments', () => {
    const r = createRng(7);
    const u = Float64Array.from({ length: 200_000 }, () => r.next());
    let lo = Infinity,
      hi = -Infinity;
    for (const v of u) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThan(1);
    expect(mean(u)).toBeCloseTo(0.5, 2);
    expect(variance(u)).toBeCloseTo(1 / 12, 3);
  });
  it('normal() has mean 0, var 1, skew 0, excess kurtosis 0', () => {
    const r = createRng(11);
    const z = Float64Array.from({ length: 400_000 }, () => r.normal());
    expect(Math.abs(mean(z))).toBeLessThan(0.006);
    expect(Math.abs(variance(z) - 1)).toBeLessThan(0.01);
    expect(Math.abs(skewness(z))).toBeLessThan(0.02);
    expect(Math.abs(excessKurtosis(z))).toBeLessThan(0.04);
  });
  it('int(n) covers [0,n) uniformly', () => {
    const r = createRng(3);
    const counts = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) counts[r.int(10)]++;
    for (const c of counts) expect(Math.abs(c - 10_000)).toBeLessThan(450);
  });
  it('parseSeed accepts hex and decimal, rejects garbage', () => {
    expect(parseSeed('0x3F2A')).toBe(0x3f2a);
    expect(parseSeed('16170')).toBe(16170);
    expect(parseSeed('0xFFFFFFFF')).toBe(0xffffffff);
    expect(parseSeed('nope')).toBeNull();
    expect(parseSeed('0x100000000')).toBeNull();
  });
});
