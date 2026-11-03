import { describe, expect, it } from 'vitest';
import ref from './__fixtures__/reference.json';
import { fromRows, quadForm } from './linalg';
import { createRng } from './prng';
import {
  efficientFrontier,
  feasible,
  makeBounds,
  maxReturn,
  minVariance,
  portfolioStats,
  projectSimplexBox,
  randomPortfolios,
  riskContributions,
} from './optimize';

const cov = fromRows(ref.opt.cov);
const mu = ref.opt.mu;
const rf = ref.opt.rf;
const near = (a: ArrayLike<number>, b: ArrayLike<number>, tol: number) => {
  for (let i = 0; i < b.length; i++) expect(Math.abs(a[i]! - b[i]!)).toBeLessThan(tol);
};

describe('projection onto {Σw=1, lo≤w≤hi}', () => {
  it('produces feasible points and is idempotent', () => {
    const b = makeBounds(4, 0.05, 0.6);
    const p = projectSimplexBox([3, -2, 0.4, 0.1], b);
    expect(p.reduce((a, c) => a + c, 0)).toBeCloseTo(1, 14);
    p.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0.05 - 1e-15);
      expect(v).toBeLessThanOrEqual(0.6 + 1e-15);
    });
    near(projectSimplexBox(p, b), p, 1e-14);
  });
  it('simplex projection of a uniform shift is the uniform point', () => {
    near(projectSimplexBox([5, 5, 5, 5], makeBounds(4, 0, 1)), [0.25, 0.25, 0.25, 0.25], 1e-14);
  });
  it('detects infeasible bounds', () => {
    expect(feasible(makeBounds(3, 0.4, 1))).toBe(false); // Σlo = 1.2
    expect(feasible(makeBounds(3, 0, 0.3))).toBe(false); // Σhi = 0.9
    expect(feasible(makeBounds(3, 0, 1))).toBe(true);
  });
});

describe('mean–variance optimization vs closed form and scipy SLSQP', () => {
  const wide = makeBounds(4, -5, 5);
  it('min-variance (unconstrained) = Σ⁻¹1 / 1ᵀΣ⁻¹1', () => {
    near(minVariance(cov, wide), ref.opt.minVarUnconstrained, 1e-8);
  });
  it('max-Sharpe (unconstrained) = tangency Σ⁻¹(μ−rf) normalized', () => {
    near(efficientFrontier(cov, mu, wide, rf).maxSharpe.weights, ref.opt.tangencyUnconstrained, 1e-4);
  });
  it('long-only max-Sharpe when the constraint binds (asset 0 → 0)', () => {
    const f = efficientFrontier(cov, ref.opt2.mu, makeBounds(4, 0, 1), rf);
    near(f.maxSharpe.weights, ref.opt2.tangencyLongOnly, 2e-4);
    expect(f.maxSharpe.sharpe).toBeGreaterThan(ref.opt2.tangencyLongOnlySharpe - 1e-7);
    expect(f.maxSharpe.weights[0]).toBeLessThan(1e-9);
  });
  it('box-constrained min-variance (upper bound binds)', () => {
    near(minVariance(cov, makeBounds(4, 0.1, 0.4)), ref.opt.minVarBox, 1e-6);
  });
  it('box-constrained max-Sharpe (upper bound binds)', () => {
    const f = efficientFrontier(cov, mu, makeBounds(4, 0.05, 0.3), rf);
    near(f.maxSharpe.weights, ref.opt.tangencyBox, 2e-4);
    expect(f.maxSharpe.sharpe).toBeGreaterThan(ref.opt.tangencyBoxSharpe - 1e-7);
  });
  it('frontier is sorted by return, starts at min-variance, ends at max-return, and dominates random portfolios', () => {
    const b = makeBounds(4, 0, 1);
    const f = efficientFrontier(cov, mu, b, rf);
    for (let i = 1; i < f.points.length; i++) expect(f.points[i]!.ret).toBeGreaterThan(f.points[i - 1]!.ret);
    expect(f.points[0]!.vol).toBeCloseTo(f.minVar.vol, 12);
    expect(f.points.at(-1)!.ret).toBeCloseTo(portfolioStats(cov, mu, maxReturn(mu, b), rf).ret, 10);
    const rnd = randomPortfolios(cov, mu, b, rf, 3000, createRng(1));
    for (let k = 0; k < 3000; k++) expect(rnd.sharpe[k]!).toBeLessThanOrEqual(f.maxSharpe.sharpe + 1e-6);
    // no random portfolio has lower vol than min-var
    for (let k = 0; k < 3000; k++) expect(rnd.vol[k]!).toBeGreaterThanOrEqual(f.minVar.vol - 1e-6);
  });
});

describe('portfolio utilities', () => {
  it('maxReturn fills the best assets up to their caps', () => {
    near(maxReturn([0.1, 0.3, 0.2], makeBounds(3, 0, 0.5)), [0, 0.5, 0.5], 1e-15);
    near(maxReturn([0.1, 0.3, 0.2], makeBounds(3, 0.1, 0.6)), [0.1, 0.6, 0.3], 1e-15);
  });
  it('risk contributions sum to σ_p and shares to 1; equal for symmetric case', () => {
    const w = [0.25, 0.25, 0.25, 0.25];
    const rc = riskContributions(cov, w);
    expect(rc.abs.reduce((a, b) => a + b, 0)).toBeCloseTo(Math.sqrt(quadForm(cov, w)), 14);
    expect(rc.pct.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 14);
    const I = fromRows([
      [0.04, 0],
      [0, 0.04],
    ]);
    const r2 = riskContributions(I, [0.5, 0.5]);
    expect(r2.pct[0]).toBeCloseTo(0.5, 15);
  });
  it('random portfolios respect bounds and budget', () => {
    const b = makeBounds(4, 0.05, 0.5);
    const r = randomPortfolios(cov, mu, b, rf, 500, createRng(9));
    for (let k = 0; k < 500; k++) {
      let s = 0;
      for (let i = 0; i < 4; i++) {
        const w = r.weights[k * 4 + i]!;
        expect(w).toBeGreaterThanOrEqual(0.05 - 1e-6);
        expect(w).toBeLessThanOrEqual(0.5 + 1e-6);
        s += w;
      }
      expect(s).toBeCloseTo(1, 5);
    }
  });
});
