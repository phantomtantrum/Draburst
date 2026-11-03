import { correlationFromCov, ledoitWolf, sampleCovariance, scaleMat } from './covariance';
import { toRows, type Mat } from './linalg';
import { efficientFrontier, feasible, makeBounds, portfolioStats, projectSimplexBox, randomPortfolios, riskContributions, type PortfolioStats } from './optimize';
import { createRng } from './prng';
import { simpleReturns } from './returns';
import { mean } from './stats';

/**
 * Portfolio analysis on calendar-ALIGNED closes.
 * μ = annualized arithmetic mean of simple returns (× P);
 * Σ = annualized covariance (× P), sample or Ledoit–Wolf.
 */
export interface PortfolioInput {
  closes: number[][]; // [asset][t]
  ppy: number;
  rf: number;
  estimator: 'sample' | 'lw';
  lo: number[];
  hi: number[];
  custom: number[] | null;
  nRandom: number;
  seed: number;
}

export interface NamedPortfolio extends PortfolioStats {
  key: 'minvar' | 'maxsharpe' | 'equal' | 'custom';
  riskPct: number[];
}

export interface PortfolioOutput {
  mu: number[];
  vol: number[];
  cov: number[][];
  corr: number[][];
  shrinkage: number | null;
  frontier: Array<{ ret: number; vol: number; sharpe: number; weights: number[] }>;
  portfolios: NamedPortfolio[];
  cloud: { weights: Float32Array; ret: Float32Array; vol: Float32Array; sharpe: Float32Array };
  observations: number;
}

export function analyzePortfolio(inp: PortfolioInput): PortfolioOutput {
  const N = inp.closes.length;
  const rets = inp.closes.map((c) => simpleReturns(c));
  const T = rets[0]?.length ?? 0;
  if (N < 2 || T < 20) throw new Error('Need at least 2 assets and 20 aligned observations');
  const mu = rets.map((r) => mean(r) * inp.ppy);
  let cov: Mat;
  let shrinkage: number | null = null;
  if (inp.estimator === 'lw') {
    const lw = ledoitWolf(rets);
    // LW uses the MLE (÷T) covariance; rescale to the unbiased (÷T−1) level for consistency
    cov = scaleMat(lw.cov, (inp.ppy * T) / (T - 1));
    shrinkage = lw.shrinkage;
  } else cov = scaleMat(sampleCovariance(rets), inp.ppy);
  const b = makeBounds(N, inp.lo, inp.hi);
  if (!feasible(b)) throw new Error('Weight bounds are infeasible: Σmin must be ≤ 100% ≤ Σmax');

  const f = efficientFrontier(cov, mu, b, inp.rf, 40);
  const eq = projectSimplexBox(new Float64Array(N).fill(1 / N), b);
  const named = (key: NamedPortfolio['key'], p: PortfolioStats): NamedPortfolio => ({
    ...p,
    key,
    riskPct: Array.from(riskContributions(cov, p.weights).pct),
  });
  const portfolios: NamedPortfolio[] = [
    named('minvar', f.minVar),
    named('maxsharpe', f.maxSharpe),
    named('equal', portfolioStats(cov, mu, eq, inp.rf)),
  ];
  if (inp.custom && inp.custom.length === N) {
    const s = inp.custom.reduce((a, c) => a + c, 0);
    if (s > 0) portfolios.push(named('custom', portfolioStats(cov, mu, Float64Array.from(inp.custom, (w) => w / s), inp.rf)));
  }
  const cloud = randomPortfolios(cov, mu, b, inp.rf, inp.nRandom, createRng(inp.seed));
  return {
    mu,
    vol: Array.from({ length: N }, (_, i) => Math.sqrt(cov.d[i * N + i]!)),
    cov: toRows(cov),
    corr: toRows(correlationFromCov(cov)),
    shrinkage,
    frontier: f.points.map((p) => ({ ret: p.ret, vol: p.vol, sharpe: p.sharpe, weights: Array.from(p.weights) })),
    portfolios: portfolios.map((p) => ({ ...p, weights: p.weights })),
    cloud,
    observations: T,
  };
}
