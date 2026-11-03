import type { Num } from './stats';

export type AssetClass = 'crypto' | 'stock';

/** Trading periods per year: 252 for exchange-traded, 365 for 24/7 crypto. */
export function periodsPerYear(cls: AssetClass | ReadonlyArray<AssetClass>): number {
  const list = typeof cls === 'string' ? [cls] : cls;
  // Mixed portfolios are aligned to the exchange calendar → 252.
  return list.length > 0 && list.every((c) => c === 'crypto') ? 365 : 252;
}

/** r_t = P_t / P_{t-1} − 1 ; length n − 1 */
export function simpleReturns(prices: Num): Float64Array {
  const n = prices.length;
  const out = new Float64Array(Math.max(0, n - 1));
  for (let i = 1; i < n; i++) out[i - 1] = prices[i]! / prices[i - 1]! - 1;
  return out;
}

/** r_t = ln(P_t / P_{t-1}) ; length n − 1 */
export function logReturns(prices: Num): Float64Array {
  const n = prices.length;
  const out = new Float64Array(Math.max(0, n - 1));
  for (let i = 1; i < n; i++) out[i - 1] = Math.log(prices[i]! / prices[i - 1]!);
  return out;
}

export const simpleToLog = (r: number) => Math.log1p(r);
export const logToSimple = (r: number) => Math.expm1(r);

/** Equity curve from simple returns, starting at `start`. Length n + 1. */
export function equityFromReturns(returns: Num, start = 1): Float64Array {
  const out = new Float64Array(returns.length + 1);
  out[0] = start;
  for (let i = 0; i < returns.length; i++) out[i + 1] = out[i]! * (1 + returns[i]!);
  return out;
}

/** Total compounded return of a simple-return series. */
export function totalReturn(returns: Num): number {
  let g = 0;
  for (let i = 0; i < returns.length; i++) g += Math.log1p(returns[i]!);
  return Math.expm1(g);
}
