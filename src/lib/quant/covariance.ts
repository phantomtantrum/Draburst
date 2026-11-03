import { mat, type Mat } from './linalg';

/**
 * Covariance estimators on a T×N returns matrix given as N column arrays
 * (all the same length T).
 */

function centered(cols: ReadonlyArray<ArrayLike<number>>): { X: Float64Array[]; T: number; N: number; means: Float64Array } {
  const N = cols.length;
  const T = N ? cols[0]!.length : 0;
  const means = new Float64Array(N);
  const X = cols.map((c, j) => {
    let m = 0;
    for (let t = 0; t < T; t++) m += c[t]!;
    m /= T;
    means[j] = m;
    const out = new Float64Array(T);
    for (let t = 0; t < T; t++) out[t] = c[t]! - m;
    return out;
  });
  return { X, T, N, means };
}

/** Sample covariance with divisor T − ddof (default unbiased, T − 1). */
export function sampleCovariance(cols: ReadonlyArray<ArrayLike<number>>, ddof = 1): Mat {
  const { X, T, N } = centered(cols);
  const S = mat(N, N);
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let s = 0;
      const xi = X[i]!,
        xj = X[j]!;
      for (let t = 0; t < T; t++) s += xi[t]! * xj[t]!;
      s /= T - ddof;
      S.d[i * N + j] = s;
      S.d[j * N + i] = s;
    }
  }
  return S;
}

export interface LedoitWolfResult {
  cov: Mat;
  shrinkage: number;
  /** target scale μ = trace(S)/N (target = μ I) */
  mu: number;
}

/**
 * Ledoit & Wolf (2004) "A well-conditioned estimator for large-dimensional
 * covariance matrices": shrink the MLE covariance (divisor T) toward μI.
 * Matches scikit-learn's `ledoit_wolf` (assume_centered=False).
 */
export function ledoitWolf(cols: ReadonlyArray<ArrayLike<number>>): LedoitWolfResult {
  const { X, T, N } = centered(cols);
  const S = mat(N, N);
  for (let i = 0; i < N; i++) {
    for (let j = i; j < N; j++) {
      let s = 0;
      const xi = X[i]!,
        xj = X[j]!;
      for (let t = 0; t < T; t++) s += xi[t]! * xj[t]!;
      s /= T;
      S.d[i * N + j] = s;
      S.d[j * N + i] = s;
    }
  }
  let trace = 0;
  for (let i = 0; i < N; i++) trace += S.d[i * N + i]!;
  const mu = trace / N;

  // δ = ‖S − μI‖²_F / N
  let delta = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const v = S.d[i * N + j]! - (i === j ? mu : 0);
      delta += v * v;
    }
  delta /= N;

  // β̄ = (1/(N T²)) Σ_t ‖x_t x_tᵀ − S‖²_F  (computed in expanded form)
  //   Σ_t ‖x_t x_tᵀ‖² = Σ_t (Σ_i x_ti²)²
  let sumNorm4 = 0;
  for (let t = 0; t < T; t++) {
    let r = 0;
    for (let i = 0; i < N; i++) r += X[i]![t]! * X[i]![t]!;
    sumNorm4 += r * r;
  }
  let sNorm2 = 0;
  for (let k = 0; k < N * N; k++) sNorm2 += S.d[k]! * S.d[k]!;
  let betaBar = (sumNorm4 / T - sNorm2) / (N * T);
  betaBar = Math.min(betaBar, delta);
  const shrinkage = delta === 0 ? 0 : betaBar / delta;

  const out = mat(N, N);
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) out.d[i * N + j] = (1 - shrinkage) * S.d[i * N + j]! + (i === j ? shrinkage * mu : 0);
  return { cov: out, shrinkage, mu };
}

export function correlationFromCov(c: Mat): Mat {
  const n = c.n;
  const out = mat(n, n);
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const v = c.d[i * n + j]! / Math.sqrt(c.d[i * n + i]! * c.d[j * n + j]!);
      out.d[i * n + j] = i === j ? 1 : v;
    }
  return out;
}

export function scaleMat(c: Mat, k: number): Mat {
  return { n: c.n, m: c.m, d: c.d.map((v) => v * k) };
}
