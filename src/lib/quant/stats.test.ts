import { describe, expect, it } from 'vitest';
import ref from './__fixtures__/reference.json';
import { excessKurtosis, mean, normCdf, normInv, quantile, skewness, std, sum, variance } from './stats';

const x = ref.stats.x;

describe('stats vs numpy/scipy', () => {
  it('mean / variance / std (ddof=1)', () => {
    expect(mean(x)).toBeCloseTo(ref.stats.mean, 14);
    expect(variance(x)).toBeCloseTo(ref.stats.var, 14);
    expect(std(x)).toBeCloseTo(ref.stats.std, 14);
  });
  it('quantiles (type 7 linear interpolation)', () => {
    for (const [p, v] of Object.entries(ref.stats.q)) expect(quantile(x, Number(p))).toBeCloseTo(v, 14);
  });
  it('skewness and excess kurtosis (population moments)', () => {
    expect(skewness(x)).toBeCloseTo(ref.stats.skew, 10);
    expect(excessKurtosis(x)).toBeCloseTo(ref.stats.exkurt, 10);
  });
  it('compensated sum is exact on adversarial input', () => {
    expect(sum([1e16, 1, -1e16])).toBe(1);
  });
});

describe('normal distribution vs scipy.stats.norm', () => {
  it('Φ⁻¹(p) relative error < 1e-9 across the range incl. deep tails', () => {
    ref.norm.p.forEach((p, i) => {
      const want = ref.norm.ppf[i]!;
      const got = normInv(p);
      expect(Math.abs(got - want) / Math.max(1, Math.abs(want))).toBeLessThan(1e-9);
    });
  });
  it('Φ(z) absolute error < 2e-7', () => {
    ref.norm.z.forEach((z, i) => expect(Math.abs(normCdf(z) - ref.norm.cdf[i]!)).toBeLessThan(2e-7));
  });
  it('textbook values', () => {
    expect(normInv(0.975)).toBeCloseTo(1.959963984540054, 12);
    expect(normInv(0.5)).toBe(0);
  });
});
