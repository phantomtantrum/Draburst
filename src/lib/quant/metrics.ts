import { covariance, mean, std, variance, type Num } from './stats';

/**
 * Performance metrics. Conventions (documented on /methodology):
 * - inputs are periodic SIMPLE returns unless stated; `ppy` = periods per year
 * - volatility annualized by √ppy; Sharpe uses arithmetic mean excess return × ppy / σ_ann
 * - risk-free `rf` is an ANNUAL rate, converted per period as (1+rf)^(1/ppy) − 1
 */

export function perPeriodRf(rfAnnual: number, ppy: number): number {
  return Math.pow(1 + rfAnnual, 1 / ppy) - 1;
}

/** CAGR from an equity curve whose points are `ppy`-spaced. */
export function cagr(equity: Num, ppy: number): number {
  const n = equity.length;
  if (n < 2) return NaN;
  const years = (n - 1) / ppy;
  const start = equity[0]!;
  const end = equity[n - 1]!;
  if (start <= 0) return NaN;
  if (end <= 0) return -1;
  return Math.pow(end / start, 1 / years) - 1;
}

export function annualizedVol(returns: Num, ppy: number): number {
  return std(returns) * Math.sqrt(ppy);
}

/** Annualized arithmetic mean return. */
export function annualizedMean(returns: Num, ppy: number): number {
  return mean(returns) * ppy;
}

export function sharpe(returns: Num, ppy: number, rfAnnual = 0): number {
  const rf = perPeriodRf(rfAnnual, ppy);
  const n = returns.length;
  const ex = new Float64Array(n);
  for (let i = 0; i < n; i++) ex[i] = returns[i]! - rf;
  const s = std(ex);
  if (!(s > 0)) return NaN;
  return (mean(ex) / s) * Math.sqrt(ppy);
}

/**
 * Sortino ratio. Downside deviation uses ALL observations (Sortino & Price):
 * DD = sqrt( (1/n) Σ min(r_t − MAR, 0)² ), MAR = per-period risk-free.
 */
export function sortino(returns: Num, ppy: number, rfAnnual = 0): number {
  const mar = perPeriodRf(rfAnnual, ppy);
  const n = returns.length;
  if (n < 2) return NaN;
  let dd = 0,
    ex = 0;
  for (let i = 0; i < n; i++) {
    const d = returns[i]! - mar;
    ex += d;
    if (d < 0) dd += d * d;
  }
  const ddev = Math.sqrt(dd / n);
  if (!(ddev > 0)) return NaN;
  return (ex / n / ddev) * Math.sqrt(ppy);
}

export interface Drawdown {
  /** maximum drawdown as a positive fraction, e.g. 0.35 = −35% */
  maxDrawdown: number;
  peakIndex: number;
  troughIndex: number;
  /** index where equity regained the prior peak, or −1 if never */
  recoveryIndex: number;
  /** bars from peak to recovery (or to the last bar if unrecovered) */
  durationBars: number;
  /** longest peak→recovery span of any drawdown, in bars */
  longestDurationBars: number;
  /** drawdown series (≤ 0), same length as equity */
  series: Float64Array;
}

export function drawdown(equity: Num): Drawdown {
  const n = equity.length;
  const series = new Float64Array(n);
  let peak = -Infinity,
    peakIdx = 0;
  let mdd = 0,
    mddPeak = 0,
    mddTrough = 0;
  let curStart = -1,
    longest = 0;
  for (let i = 0; i < n; i++) {
    const v = equity[i]!;
    if (v >= peak) {
      if (curStart >= 0) longest = Math.max(longest, i - curStart);
      curStart = -1;
      peak = v;
      peakIdx = i;
    } else if (curStart < 0) {
      curStart = peakIdx;
    }
    const dd = v / peak - 1;
    series[i] = dd;
    if (-dd > mdd) {
      mdd = -dd;
      mddPeak = peakIdx;
      mddTrough = i;
    }
  }
  if (curStart >= 0) longest = Math.max(longest, n - 1 - curStart);
  let recovery = -1;
  if (mdd > 0) {
    const peakVal = equity[mddPeak]!;
    for (let i = mddTrough + 1; i < n; i++) {
      if (equity[i]! >= peakVal) {
        recovery = i;
        break;
      }
    }
  }
  return {
    maxDrawdown: mdd,
    peakIndex: mddPeak,
    troughIndex: mddTrough,
    recoveryIndex: recovery,
    durationBars: mdd > 0 ? (recovery >= 0 ? recovery : n - 1) - mddPeak : 0,
    longestDurationBars: longest,
    series,
  };
}

export function calmar(equity: Num, ppy: number): number {
  const dd = drawdown(equity).maxDrawdown;
  if (!(dd > 0)) return NaN;
  return cagr(equity, ppy) / dd;
}

/** β = Cov(r, r_b) / Var(r_b) on aligned periodic returns. */
export function beta(returns: Num, benchmark: Num): number {
  const v = variance(benchmark);
  if (!(v > 0)) return NaN;
  return covariance(returns, benchmark) / v;
}
