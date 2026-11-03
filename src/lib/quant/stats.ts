/** Descriptive statistics. All variances are sample (n − 1) unless noted. */
export type Num = ArrayLike<number>;

export function sum(x: Num): number {
  // Neumaier compensated summation — keeps long return series accurate.
  let s = 0,
    c = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i]!;
    const t = s + v;
    c += Math.abs(s) >= Math.abs(v) ? s - t + v : v - t + s;
    s = t;
  }
  return s + c;
}

export function mean(x: Num): number {
  return x.length ? sum(x) / x.length : NaN;
}

export function variance(x: Num, ddof = 1): number {
  const n = x.length;
  if (n - ddof <= 0) return NaN;
  const m = mean(x);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i]! - m;
    s += d * d;
  }
  return s / (n - ddof);
}

export function std(x: Num, ddof = 1): number {
  return Math.sqrt(variance(x, ddof));
}

export function covariance(x: Num, y: Num, ddof = 1): number {
  const n = Math.min(x.length, y.length);
  if (n - ddof <= 0) return NaN;
  let mx = 0,
    my = 0;
  for (let i = 0; i < n; i++) {
    mx += x[i]!;
    my += y[i]!;
  }
  mx /= n;
  my /= n;
  let s = 0;
  for (let i = 0; i < n; i++) s += (x[i]! - mx) * (y[i]! - my);
  return s / (n - ddof);
}

export function correlation(x: Num, y: Num): number {
  return covariance(x, y) / Math.sqrt(variance(x) * variance(y));
}

export function sortedCopy(x: Num): Float64Array {
  const a = Float64Array.from(x as ArrayLike<number>);
  a.sort();
  return a;
}

/**
 * Quantile of a SORTED array, linear interpolation between order statistics
 * (Hyndman & Fan type 7 — numpy's default). p in [0, 1].
 */
export function quantileSorted(sorted: Num, p: number): number {
  const n = sorted.length;
  if (n === 0) return NaN;
  if (p <= 0) return sorted[0]!;
  if (p >= 1) return sorted[n - 1]!;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  return sorted[lo]! + (h - lo) * (sorted[hi]! - sorted[lo]!);
}

export function quantile(x: Num, p: number): number {
  return quantileSorted(sortedCopy(x), p);
}

export function skewness(x: Num): number {
  const n = x.length;
  const m = mean(x);
  let m2 = 0,
    m3 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i]! - m;
    m2 += d * d;
    m3 += d * d * d;
  }
  m2 /= n;
  m3 /= n;
  return m3 / Math.pow(m2, 1.5);
}

/** Excess kurtosis (population moments). Normal → 0. */
export function excessKurtosis(x: Num): number {
  const n = x.length;
  const m = mean(x);
  let m2 = 0,
    m4 = 0;
  for (let i = 0; i < n; i++) {
    const d = x[i]! - m;
    const d2 = d * d;
    m2 += d2;
    m4 += d2 * d2;
  }
  m2 /= n;
  m4 /= n;
  return m4 / (m2 * m2) - 3;
}

/* ── Normal distribution ── */

export function normPdf(z: number): number {
  return Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
}

/** Φ(z) via erfc with W. J. Cody-grade rational approximation (|err| < 1.2e-7 → refined). */
export function normCdf(z: number): number {
  return 0.5 * erfc(-z / Math.SQRT2);
}

export function erfc(x: number): number {
  // Numerical Recipes erfcc (Chebyshev), fractional error < 1.2e-7
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Φ⁻¹(p) — Acklam's algorithm + one Halley refinement step (|rel err| ~1e-15). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let x: number;
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    x = (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  } else if (p <= 1 - pl) {
    const q = p - 0.5;
    const r = q * q;
    x = ((((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q) / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    x = -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  // Halley refinement using a high-precision erfc
  const e = 0.5 * erfcPrecise(-x / Math.SQRT2) - p;
  const u = e * Math.sqrt(2 * Math.PI) * Math.exp((x * x) / 2);
  return x - u / (1 + (x * u) / 2);
}

/** erfc with ~1e-15 relative accuracy (continued fraction / series). */
export function erfcPrecise(x: number): number {
  if (x < 0) return 2 - erfcPrecise(-x);
  if (x < 2) {
    // erf series: erf(x) = 2/√π Σ (-1)^n x^(2n+1) / (n! (2n+1))
    let term = x,
      s = x;
    const x2 = x * x;
    for (let n = 1; n < 100; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      s += add;
      if (Math.abs(add) < 1e-17 * Math.abs(s)) break;
    }
    return 1 - (2 / Math.sqrt(Math.PI)) * s;
  }
  // Lentz continued fraction for erfc
  const tiny = 1e-300;
  let f = x,
    C = x,
    D = 0;
  for (let n = 1; n < 200; n++) {
    const an = n / 2;
    D = x + an * D;
    D = D === 0 ? tiny : 1 / D;
    C = x + an / C;
    if (C === 0) C = tiny;
    const delta = C * D;
    f *= delta;
    if (Math.abs(delta - 1) < 1e-16) break;
  }
  return Math.exp(-x * x) / Math.sqrt(Math.PI) / f;
}
