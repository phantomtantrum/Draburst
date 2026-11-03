import { describe, expect, it } from 'vitest';
import ref from './__fixtures__/reference.json';
import { correlationFromCov, ledoitWolf, sampleCovariance } from './covariance';
import { toRows } from './linalg';

const close = (a: number[][], b: number[][], tol: number) =>
  a.forEach((row, i) => row.forEach((v, j) => expect(Math.abs(v - b[i]![j]!)).toBeLessThan(tol)));

describe('covariance', () => {
  it('sample covariance equals numpy.cov (ddof=1)', () => {
    close(toRows(sampleCovariance(ref.cov.cols)), ref.cov.sample, 1e-15);
  });
  it('Ledoit–Wolf equals sklearn.covariance.ledoit_wolf (T > N)', () => {
    const lw = ledoitWolf(ref.cov.cols);
    expect(lw.shrinkage).toBeCloseTo(ref.cov.lwShrinkage, 12);
    close(toRows(lw.cov), ref.cov.lw, 1e-15);
  });
  it('Ledoit–Wolf equals sklearn when T < N (high shrinkage, PD result)', () => {
    const lw = ledoitWolf(ref.cov.small.cols);
    expect(lw.shrinkage).toBeCloseTo(ref.cov.small.lwShrinkage, 12);
    close(toRows(lw.cov), ref.cov.small.lw, 1e-15);
    expect(lw.shrinkage).toBeGreaterThan(0.5);
  });
  it('correlation has unit diagonal and |ρ| ≤ 1', () => {
    const c = toRows(correlationFromCov(sampleCovariance(ref.cov.cols)));
    c.forEach((row, i) => row.forEach((v, j) => (i === j ? expect(v).toBe(1) : expect(Math.abs(v)).toBeLessThanOrEqual(1))));
  });
});
