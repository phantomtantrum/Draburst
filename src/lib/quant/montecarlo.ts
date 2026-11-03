import { createRng } from './prng';
import { mean, normCdf, normInv, quantileSorted, std } from './stats';

/**
 * Monte Carlo price simulation.
 *
 * GBM:       S_{t+1} = S_t · exp((μ − σ²/2)Δt + σ√Δt · Z),  Z ~ N(0,1)
 *            μ, σ are ANNUAL (arithmetic drift, log-return vol), Δt = 1/ppy.
 * Bootstrap: S_{t+1} = S_t · exp(r*), r* drawn from historical log returns by
 *            circular block bootstrap (block length b; b = 1 → i.i.d.).
 *
 * Memory: every path is stored only on a ≤ GRID_MAX checkpoint grid
 * (Float32), so 50,000 paths × 121 points ≈ 24 MB; terminal values are exact
 * (Float64). Percentile bands are exact order statistics on that grid.
 */

export type McModel = 'gbm' | 'bootstrap';

export interface McParams {
  s0: number;
  /** number of steps (trading periods) */
  horizon: number;
  nPaths: number;
  model: McModel;
  /** annual arithmetic drift (GBM) */
  mu: number;
  /** annual volatility of log returns (GBM) */
  sigma: number;
  ppy: number;
  seed: number;
  /** historical LOG returns (bootstrap) */
  history?: ArrayLike<number>;
  blockSize?: number;
  /** price target for P(S_T > target) */
  target?: number;
  /** paths kept for display (3D/2D fan) */
  displayPaths?: number;
  batchSize?: number;
}

export const GRID_MAX = 121;
export const PERCENTILES = [0.05, 0.25, 0.5, 0.75, 0.95] as const;

export interface McBatch {
  pathsDone: number;
  /** display paths from this batch: k × gridLen, row-major */
  display: Float32Array;
  displayCount: number;
  /** terminal prices of those display paths */
  displayTerminal: Float32Array;
}

export interface McSummary {
  grid: Int32Array;
  /** bands[p][g] for p in PERCENTILES */
  bands: Float64Array[];
  meanPath: Float64Array;
  terminalSorted: Float64Array;
  terminal: {
    mean: number;
    median: number;
    p: Record<string, number>;
    probAboveTarget: number | null;
    probBelowStart: number;
    probAboveStart: number;
  };
  /** horizon simple-return risk, losses positive */
  risk: { var95: number; var99: number; cvar95: number; cvar99: number };
  /** closed-form lognormal values (GBM only) for validation */
  analytic: null | { median: number; mean: number; probAboveTarget: number | null; var95: number; var99: number };
  histogram: { edges: Float64Array; counts: Uint32Array };
  elapsedMs: number;
}

export function makeGrid(horizon: number, max = GRID_MAX): Int32Array {
  const len = Math.min(horizon + 1, max);
  const g = new Int32Array(len);
  for (let i = 0; i < len; i++) g[i] = Math.round((i * horizon) / (len - 1));
  return g;
}

/** Estimate GBM parameters (annual) from historical log returns. */
export function estimateGbm(logRets: ArrayLike<number>, ppy: number): { mu: number; sigma: number } {
  const s = std(logRets) * Math.sqrt(ppy);
  const m = mean(logRets) * ppy + (s * s) / 2;
  return { mu: m, sigma: s };
}

export function* simulate(p: McParams): Generator<McBatch, McSummary, void> {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const H = Math.max(1, Math.floor(p.horizon));
  const N = Math.max(1, Math.floor(p.nPaths));
  const grid = makeGrid(H);
  const G = grid.length;
  const rng = createRng(p.seed);
  const dt = 1 / p.ppy;
  const drift = (p.mu - 0.5 * p.sigma * p.sigma) * dt;
  const vol = p.sigma * Math.sqrt(dt);
  const hist = p.history;
  const m = hist ? hist.length : 0;
  const b = Math.max(1, Math.floor(p.blockSize ?? 1));
  if (p.model === 'bootstrap' && m < 2) throw new Error('bootstrap requires history');

  const all = new Float32Array(N * G);
  const terminal = new Float64Array(N);
  const meanPath = new Float64Array(G);
  const displayTotal = Math.min(N, p.displayPaths ?? 2000);
  const batch = Math.max(1, p.batchSize ?? 2000);
  const logS0 = Math.log(p.s0);

  let done = 0;
  // path i is displayed when ⌊(i+1)·D/N⌋ > ⌊i·D/N⌋ → exactly D evenly spread paths
  const isDisplayed = (i: number) => Math.floor(((i + 1) * displayTotal) / N) > Math.floor((i * displayTotal) / N);
  while (done < N) {
    const end = Math.min(N, done + batch);
    const k = Math.floor((end * displayTotal) / N) - Math.floor((done * displayTotal) / N);
    const display = new Float32Array(k * G);
    const displayTerminal = new Float32Array(k);
    let di = 0;
    for (let i = done; i < end; i++) {
      let x = logS0;
      let gi = 1;
      const row = i * G;
      all[row] = p.s0;
      let blockPos = b; // force a new block on the first draw
      let blockStart = 0;
      for (let t = 1; t <= H; t++) {
        if (p.model === 'gbm') {
          x += drift + vol * rng.normal();
        } else {
          if (blockPos >= b) {
            blockStart = rng.int(m);
            blockPos = 0;
          }
          x += hist![(blockStart + blockPos) % m]!;
          blockPos++;
        }
        if (t === grid[gi]) {
          all[row + gi] = Math.exp(x);
          gi++;
        }
      }
      const sT = Math.exp(x);
      terminal[i] = sT;
      if (isDisplayed(i) && di < k) {
        display.set(all.subarray(row, row + G), di * G);
        displayTerminal[di] = sT;
        di++;
      }
    }
    done = end;
    yield { pathsDone: done, display, displayCount: di, displayTerminal };
  }

  // bands — exact order statistics at each checkpoint
  const bands = PERCENTILES.map(() => new Float64Array(G));
  const col = new Float64Array(N);
  for (let g = 0; g < G; g++) {
    let s = 0;
    for (let i = 0; i < N; i++) {
      const v = all[i * G + g]!;
      col[i] = v;
      s += v;
    }
    meanPath[g] = s / N;
    col.sort();
    PERCENTILES.forEach((q, j) => (bands[j]![g] = quantileSorted(col, q)));
  }
  // exact terminal (Float64) replaces the Float32 last column
  const terminalSorted = Float64Array.from(terminal).sort();
  PERCENTILES.forEach((q, j) => (bands[j]![G - 1] = quantileSorted(terminalSorted, q)));
  meanPath[G - 1] = mean(terminal);

  const summary = summarize(p, terminalSorted, H);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return { grid, bands, meanPath, terminalSorted, ...summary, elapsedMs: t1 - t0 };
}

function summarize(p: McParams, sorted: Float64Array, H: number) {
  const N = sorted.length;
  const pct: Record<string, number> = {};
  for (const q of [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99]) pct[`p${Math.round(q * 100)}`] = quantileSorted(sorted, q);
  const countAbove = (x: number) => {
    // first index with value > x (binary search)
    let lo = 0,
      hi = N;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid]! > x) hi = mid;
      else lo = mid + 1;
    }
    return N - lo;
  };
  const target = p.target != null && Number.isFinite(p.target) && p.target > 0 ? p.target : null;
  const probAboveStart = countAbove(p.s0) / N;

  // horizon simple returns R = S_T/S0 − 1 (sorted, same order)
  const R = new Float64Array(N);
  for (let i = 0; i < N; i++) R[i] = sorted[i]! / p.s0 - 1;
  const varAt = (c: number) => -quantileSorted(R, 1 - c);
  const cvarAt = (c: number) => {
    const q = quantileSorted(R, 1 - c);
    let s = 0,
      k = 0;
    for (let i = 0; i < N && R[i]! <= q; i++) {
      s += R[i]!;
      k++;
    }
    return k ? -s / k : NaN;
  };

  let analytic: McSummary['analytic'] = null;
  if (p.model === 'gbm') {
    const T = H / p.ppy;
    const m = Math.log(p.s0) + (p.mu - 0.5 * p.sigma * p.sigma) * T;
    const s = p.sigma * Math.sqrt(T);
    const q = (c: number) => Math.exp(m + s * normInv(c));
    analytic = {
      median: Math.exp(m),
      mean: p.s0 * Math.exp(p.mu * T),
      probAboveTarget: target != null && s > 0 ? 1 - normCdf((Math.log(target) - m) / s) : null,
      var95: -(q(0.05) / p.s0 - 1),
      var99: -(q(0.01) / p.s0 - 1),
    };
  }

  // histogram over [p0.5, p99.5] with 60 bins (tails clamped into end bins)
  const bins = 60;
  const lo = quantileSorted(sorted, 0.005),
    hi = quantileSorted(sorted, 0.995);
  const edges = new Float64Array(bins + 1);
  for (let i = 0; i <= bins; i++) edges[i] = lo + ((hi - lo) * i) / bins;
  const counts = new Uint32Array(bins);
  const w = (hi - lo) / bins || 1;
  for (let i = 0; i < N; i++) {
    const j = Math.min(bins - 1, Math.max(0, Math.floor((sorted[i]! - lo) / w)));
    counts[j]!++;
  }

  return {
    terminal: {
      mean: mean(sorted),
      median: quantileSorted(sorted, 0.5),
      p: pct,
      probAboveTarget: target != null ? countAbove(target) / N : null,
      probBelowStart: 1 - probAboveStart,
      probAboveStart,
    },
    risk: { var95: varAt(0.95), var99: varAt(0.99), cvar95: cvarAt(0.95), cvar99: cvarAt(0.99) },
    analytic,
    histogram: { edges, counts },
  };
}

/** Run to completion (tests / non-streaming callers). */
export function simulateAll(p: McParams): McSummary {
  const it = simulate(p);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
