import { dot, matVec, maxEigen, quadForm, type Mat } from './linalg';
import type { Rng } from './prng';

/**
 * Mean–variance optimization with a budget constraint and per-asset bounds:
 *
 *   minimize   wᵀΣw − λ μᵀw
 *   subject to Σ w_i = 1,  lo_i ≤ w_i ≤ hi_i
 *
 * Solved by FISTA (accelerated projected gradient) with adaptive restart.
 * The projection onto {Σw = 1} ∩ box is exact: w_i = clip(v_i − τ, lo_i, hi_i)
 * with τ found by bisection (the sum is monotone in τ).
 * λ = 0 gives the minimum-variance portfolio; sweeping λ ≥ 0 traces the
 * upper (efficient) branch of the frontier.
 */

export interface Bounds {
  lo: Float64Array;
  hi: Float64Array;
}

export function makeBounds(n: number, lo: number | ArrayLike<number>, hi: number | ArrayLike<number>): Bounds {
  const L = new Float64Array(n),
    H = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = typeof lo === 'number' ? lo : lo[i]!;
    H[i] = typeof hi === 'number' ? hi : hi[i]!;
  }
  return { lo: L, hi: H };
}

export function feasible(b: Bounds): boolean {
  let sl = 0,
    sh = 0;
  for (let i = 0; i < b.lo.length; i++) {
    if (b.lo[i]! > b.hi[i]!) return false;
    sl += b.lo[i]!;
    sh += b.hi[i]!;
  }
  return sl <= 1 + 1e-12 && sh >= 1 - 1e-12;
}

/** Euclidean projection onto {Σw = 1, lo ≤ w ≤ hi}. */
export function projectSimplexBox(v: ArrayLike<number>, b: Bounds, out = new Float64Array(v.length)): Float64Array {
  const n = v.length;
  const s = (tau: number) => {
    let acc = 0;
    for (let i = 0; i < n; i++) acc += Math.min(b.hi[i]!, Math.max(b.lo[i]!, v[i]! - tau));
    return acc;
  };
  let lo = Infinity,
    hi = -Infinity;
  for (let i = 0; i < n; i++) {
    lo = Math.min(lo, v[i]! - b.hi[i]!);
    hi = Math.max(hi, v[i]! - b.lo[i]!);
  }
  // s(lo) = Σhi ≥ 1, s(hi) = Σlo ≤ 1
  for (let it = 0; it < 200; it++) {
    const mid = 0.5 * (lo + hi);
    if (s(mid) > 1) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-15 * Math.max(1, Math.abs(lo))) break;
  }
  const tau = 0.5 * (lo + hi);
  for (let i = 0; i < n; i++) out[i] = Math.min(b.hi[i]!, Math.max(b.lo[i]!, v[i]! - tau));
  // fix residual rounding on a free coordinate
  let resid = 1;
  for (let i = 0; i < n; i++) resid -= out[i]!;
  if (Math.abs(resid) > 0) {
    for (let i = 0; i < n; i++) {
      const t = out[i]! + resid;
      if (t >= b.lo[i]! && t <= b.hi[i]!) {
        out[i] = t;
        break;
      }
    }
  }
  return out;
}

export interface SolveOptions {
  maxIter?: number;
  tol?: number;
  warm?: Float64Array;
  /** precomputed Lipschitz constant 2·λmax(Σ) */
  L?: number;
}

export function solveMeanVariance(cov: Mat, mu: ArrayLike<number>, lambda: number, b: Bounds, opts: SolveOptions = {}): Float64Array {
  const n = cov.n;
  const maxIter = opts.maxIter ?? 20000;
  const tol = opts.tol ?? 1e-12;
  const L = opts.L ?? 2 * maxEigen(cov);
  const step = L > 0 ? 1 / L : 1;
  let x = opts.warm ? projectSimplexBox(opts.warm, b) : projectSimplexBox(new Float64Array(n).fill(1 / n), b);
  let y = Float64Array.from(x);
  let t = 1;
  const g = new Float64Array(n);
  const v = new Float64Array(n);
  const f = (w: ArrayLike<number>) => quadForm(cov, w) - lambda * dot(mu, w);
  let fx = f(x);
  for (let it = 0; it < maxIter; it++) {
    matVec(cov, y, g);
    for (let i = 0; i < n; i++) v[i] = y[i]! - step * (2 * g[i]! - lambda * mu[i]!);
    const xNew = projectSimplexBox(v, b);
    const fNew = f(xNew);
    let diff = 0;
    for (let i = 0; i < n; i++) diff = Math.max(diff, Math.abs(xNew[i]! - x[i]!));
    if (fNew > fx) {
      // adaptive restart (O'Donoghue & Candès)
      t = 1;
      y = Float64Array.from(x);
      continue;
    }
    const tNew = (1 + Math.sqrt(1 + 4 * t * t)) / 2;
    const k = (t - 1) / tNew;
    for (let i = 0; i < n; i++) y[i] = xNew[i]! + k * (xNew[i]! - x[i]!);
    x = xNew;
    fx = fNew;
    t = tNew;
    if (diff < tol) break;
  }
  return x;
}

export interface PortfolioStats {
  weights: Float64Array;
  ret: number;
  vol: number;
  sharpe: number;
}

export function portfolioStats(cov: Mat, mu: ArrayLike<number>, w: Float64Array, rf: number): PortfolioStats {
  const ret = dot(mu, w);
  const vol = Math.sqrt(Math.max(0, quadForm(cov, w)));
  return { weights: w, ret, vol, sharpe: vol > 0 ? (ret - rf) / vol : NaN };
}

export function minVariance(cov: Mat, b: Bounds, opts?: SolveOptions): Float64Array {
  return solveMeanVariance(cov, new Float64Array(cov.n), 0, b, opts);
}

/** Highest-return feasible portfolio (LP, greedy): fill best μ up to hi. */
export function maxReturn(mu: ArrayLike<number>, b: Bounds): Float64Array {
  const n = mu.length;
  const w = Float64Array.from(b.lo);
  let budget = 1;
  for (let i = 0; i < n; i++) budget -= w[i]!;
  const order = Array.from({ length: n }, (_, i) => i).sort((a, c) => mu[c]! - mu[a]!);
  for (const i of order) {
    const add = Math.min(budget, b.hi[i]! - w[i]!);
    w[i]! += add;
    budget -= add;
    if (budget <= 0) break;
  }
  return w;
}

export interface FrontierResult {
  points: PortfolioStats[];
  minVar: PortfolioStats;
  maxSharpe: PortfolioStats;
}

/**
 * Efficient frontier by sweeping risk aversion λ on a log grid (warm-started),
 * plus max-Sharpe via golden-section search on log λ (Sharpe is unimodal along
 * the efficient branch since the frontier is concave in (σ, μ)).
 */
export function efficientFrontier(cov: Mat, mu: ArrayLike<number>, b: Bounds, rf: number, nPoints = 48): FrontierResult {
  const L = 2 * maxEigen(cov);
  const n = cov.n;
  const w0 = minVariance(cov, b, { L });
  const minVar = portfolioStats(cov, mu, w0, rf);
  const wMax = maxReturn(mu, b);
  const retMax = dot(mu, wMax);

  // scale: λ* where the return term is comparable to the risk term
  let muSpread = 0;
  for (let i = 0; i < n; i++) muSpread = Math.max(muSpread, Math.abs(mu[i]! - minVar.ret));
  const scale = muSpread > 0 ? L / muSpread : 1;
  const lamLo = scale * 1e-4,
    lamHi = scale * 1e4;

  const points: PortfolioStats[] = [minVar];
  let warm = w0;
  for (let k = 0; k < nPoints; k++) {
    const lam = lamLo * Math.pow(lamHi / lamLo, k / (nPoints - 1));
    warm = solveMeanVariance(cov, mu, lam, b, { L, warm, maxIter: 6000, tol: 1e-11 });
    const p = portfolioStats(cov, mu, warm, rf);
    const last = points[points.length - 1]!;
    if (p.ret - last.ret > 1e-9 * Math.max(1, Math.abs(retMax))) points.push(p);
  }
  const top = portfolioStats(cov, mu, wMax, rf);
  if (top.ret - points[points.length - 1]!.ret > 1e-9) points.push(top);

  // max Sharpe: golden section on log λ, bracketed by the best grid point
  const sharpeAt = (logLam: number) => {
    const w = solveMeanVariance(cov, mu, Math.exp(logLam), b, { L, warm: w0, maxIter: 8000, tol: 1e-12 });
    return portfolioStats(cov, mu, w, rf);
  };
  let best = minVar;
  for (const p of points) if (p.sharpe > best.sharpe || !Number.isFinite(best.sharpe)) best = p;
  let a = Math.log(lamLo / 10),
    c = Math.log(lamHi * 10);
  const gr = (Math.sqrt(5) - 1) / 2;
  let x1 = c - gr * (c - a),
    x2 = a + gr * (c - a);
  let f1 = sharpeAt(x1),
    f2 = sharpeAt(x2);
  for (let it = 0; it < 60 && c - a > 1e-6; it++) {
    if (f1.sharpe > f2.sharpe) {
      c = x2;
      x2 = x1;
      f2 = f1;
      x1 = c - gr * (c - a);
      f1 = sharpeAt(x1);
    } else {
      a = x1;
      x1 = x2;
      f1 = f2;
      x2 = a + gr * (c - a);
      f2 = sharpeAt(x2);
    }
  }
  for (const cand of [f1, f2, top, minVar]) if (cand.sharpe > best.sharpe) best = cand;
  return { points, minVar, maxSharpe: best };
}

/**
 * Risk contribution: RC_i = w_i (Σw)_i / σ_p, Σ RC_i = σ_p.
 * Returns absolute contributions and percentage shares.
 */
export function riskContributions(cov: Mat, w: ArrayLike<number>): { abs: Float64Array; pct: Float64Array } {
  const sw = matVec(cov, w);
  const varP = dot(w, sw);
  const vol = Math.sqrt(Math.max(varP, 0));
  const abs = new Float64Array(w.length),
    pct = new Float64Array(w.length);
  for (let i = 0; i < w.length; i++) {
    abs[i] = vol > 0 ? (w[i]! * sw[i]!) / vol : 0;
    pct[i] = varP > 0 ? (w[i]! * sw[i]!) / varP : 0;
  }
  return { abs, pct };
}

/**
 * Random feasible portfolios for the cloud: Dirichlet(α) draws (α mixed
 * between 0.3 and 1 to reach both corners and the interior), projected onto
 * the bounds when they are violated. Returns flat arrays for instancing.
 */
export function randomPortfolios(
  cov: Mat,
  mu: ArrayLike<number>,
  b: Bounds,
  rf: number,
  count: number,
  rng: Rng,
): { weights: Float32Array; ret: Float32Array; vol: Float32Array; sharpe: Float32Array } {
  const n = cov.n;
  const weights = new Float32Array(count * n);
  const ret = new Float32Array(count),
    vol = new Float32Array(count),
    sharpe = new Float32Array(count);
  const g = new Float64Array(n);
  const longOnlyUnit = b.lo.every((x) => x >= 0);
  for (let k = 0; k < count; k++) {
    const alpha = k % 3 === 0 ? 0.3 : 1;
    let s = 0;
    for (let i = 0; i < n; i++) {
      g[i] = gammaSample(alpha, rng);
      s += g[i]!;
    }
    for (let i = 0; i < n; i++) g[i] = g[i]! / s;
    if (!longOnlyUnit) {
      // allow shorts: perturb around the simplex draw
      for (let i = 0; i < n; i++) g[i] = g[i]! + 0.5 * rng.normal() / n;
    }
    let ok = true;
    for (let i = 0; i < n; i++) if (g[i]! < b.lo[i]! || g[i]! > b.hi[i]!) ok = false;
    const w = ok ? g : projectSimplexBox(g, b);
    const st = portfolioStats(cov, mu, Float64Array.from(w), rf);
    for (let i = 0; i < n; i++) weights[k * n + i] = w[i]!;
    ret[k] = st.ret;
    vol[k] = st.vol;
    sharpe[k] = st.sharpe;
  }
  return { weights, ret, vol, sharpe };
}

/** Marsaglia–Tsang gamma sampler (shape α, scale 1). */
export function gammaSample(alpha: number, rng: Rng): number {
  if (alpha < 1) {
    const u = rng.next() || 1e-300;
    return gammaSample(alpha + 1, rng) * Math.pow(u, 1 / alpha);
  }
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number, v: number;
    do {
      x = rng.normal();
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = rng.next();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u || 1e-300) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
