/**
 * Causal technical indicators. Value at index t uses only x[0..t].
 * Warm-up positions are NaN.
 */
export type Num = ArrayLike<number>;

export function sma(x: Num, n: number): Float64Array {
  const out = new Float64Array(x.length).fill(NaN);
  if (n < 1) return out;
  let s = 0;
  for (let i = 0; i < x.length; i++) {
    s += x[i]!;
    if (i >= n) s -= x[i - n]!;
    if (i >= n - 1) out[i] = s / n;
  }
  return out;
}

/** EMA with α = 2/(n+1), seeded by the SMA of the first n values (TA-Lib convention). */
export function ema(x: Num, n: number): Float64Array {
  const out = new Float64Array(x.length).fill(NaN);
  if (n < 1 || x.length < n) return out;
  const a = 2 / (n + 1);
  let s = 0;
  for (let i = 0; i < n; i++) s += x[i]!;
  let e = s / n;
  out[n - 1] = e;
  for (let i = n; i < x.length; i++) {
    e = a * x[i]! + (1 - a) * e;
    out[i] = e;
  }
  return out;
}

/** Rolling standard deviation (population, ddof = 0 — Bollinger's convention). */
export function rollingStd(x: Num, n: number, ddof = 0): Float64Array {
  const out = new Float64Array(x.length).fill(NaN);
  for (let i = n - 1; i < x.length; i++) {
    let m = 0;
    for (let j = i - n + 1; j <= i; j++) m += x[j]!;
    m /= n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (x[j]! - m) ** 2;
    out[i] = Math.sqrt(v / (n - ddof));
  }
  return out;
}

/** RSI with Wilder smoothing; first value at index n (needs n price changes). */
export function rsi(close: Num, n = 14): Float64Array {
  const out = new Float64Array(close.length).fill(NaN);
  if (close.length <= n) return out;
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= n; i++) {
    const d = close[i]! - close[i - 1]!;
    if (d > 0) gain += d;
    else loss -= d;
  }
  gain /= n;
  loss /= n;
  out[n] = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  for (let i = n + 1; i < close.length; i++) {
    const d = close[i]! - close[i - 1]!;
    gain = (gain * (n - 1) + Math.max(d, 0)) / n;
    loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
    out[i] = loss === 0 ? (gain === 0 ? 50 : 100) : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

export function bollinger(close: Num, n = 20, k = 2): { mid: Float64Array; upper: Float64Array; lower: Float64Array } {
  const mid = sma(close, n);
  const sd = rollingStd(close, n, 0);
  const upper = new Float64Array(close.length),
    lower = new Float64Array(close.length);
  for (let i = 0; i < close.length; i++) {
    upper[i] = mid[i]! + k * sd[i]!;
    lower[i] = mid[i]! - k * sd[i]!;
  }
  return { mid, upper, lower };
}

/** Trailing return over `lookback` bars: close_t / close_{t−L} − 1. */
export function trailingReturn(close: Num, lookback: number): Float64Array {
  const out = new Float64Array(close.length).fill(NaN);
  for (let i = lookback; i < close.length; i++) out[i] = close[i]! / close[i - lookback]! - 1;
  return out;
}

/** Annualized realized vol of log returns over a trailing window. */
export function realizedVol(close: Num, n: number, ppy: number): Float64Array {
  const out = new Float64Array(close.length).fill(NaN);
  for (let i = n; i < close.length; i++) {
    let m = 0;
    for (let j = i - n + 1; j <= i; j++) m += Math.log(close[j]! / close[j - 1]!);
    m /= n;
    let v = 0;
    for (let j = i - n + 1; j <= i; j++) v += (Math.log(close[j]! / close[j - 1]!) - m) ** 2;
    out[i] = Math.sqrt(v / (n - 1)) * Math.sqrt(ppy);
  }
  return out;
}
