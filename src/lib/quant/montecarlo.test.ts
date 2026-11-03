import { describe, expect, it } from 'vitest';
import ref from './__fixtures__/reference.json';
import { estimateGbm, makeGrid, simulate, simulateAll, type McParams } from './montecarlo';
import { createRng } from './prng';

const base: McParams = {
  s0: ref.gbm.s0,
  horizon: 252,
  nPaths: 50_000,
  model: 'gbm',
  mu: ref.gbm.mu,
  sigma: ref.gbm.sigma,
  ppy: 252,
  seed: 0x3f2a,
  target: 120,
  displayPaths: 500,
};

describe('Monte Carlo — GBM', () => {
  const res = simulateAll(base);
  it('converges to the lognormal closed form (scipy reference)', () => {
    expect(res.terminal.median / ref.gbm.median - 1).toBeLessThan(0.01);
    expect(Math.abs(res.terminal.mean / ref.gbm.mean - 1)).toBeLessThan(0.01);
    expect(Math.abs(res.terminal.probAboveTarget! - ref.gbm.pAbove120)).toBeLessThan(0.008);
    expect(Math.abs(res.terminal.p.p5! / ref.gbm.q05 - 1)).toBeLessThan(0.015);
    // internal analytic agrees with scipy exactly
    expect(res.analytic!.median).toBeCloseTo(ref.gbm.median, 10);
    expect(res.analytic!.probAboveTarget!).toBeCloseTo(ref.gbm.pAbove120, 6);
  });
  it('bands are ordered and start at S0', () => {
    for (let g = 0; g < res.grid.length; g++) {
      for (let j = 1; j < res.bands.length; j++) expect(res.bands[j]![g]!).toBeGreaterThanOrEqual(res.bands[j - 1]![g]!);
    }
    res.bands.forEach((b) => expect(b[0]).toBeCloseTo(base.s0, 4));
  });
  it('is exactly reproducible from the seed, and seed-sensitive', () => {
    const a = simulateAll({ ...base, nPaths: 2000 });
    const b = simulateAll({ ...base, nPaths: 2000 });
    const c = simulateAll({ ...base, nPaths: 2000, seed: base.seed + 1 });
    expect(Array.from(a.terminalSorted)).toEqual(Array.from(b.terminalSorted));
    expect(a.terminalSorted[1000]).not.toBe(c.terminalSorted[1000]);
  });
  it('batch size does not change results', () => {
    const a = simulateAll({ ...base, nPaths: 3000, batchSize: 3000 });
    const b = simulateAll({ ...base, nPaths: 3000, batchSize: 250 });
    expect(Array.from(a.terminalSorted)).toEqual(Array.from(b.terminalSorted));
  });
  it('streams batches and yields exactly displayPaths display paths', () => {
    const it = simulate({ ...base, nPaths: 10_000, batchSize: 1000, displayPaths: 777 });
    let shown = 0,
      batches = 0,
      last = 0;
    for (;;) {
      const r = it.next();
      if (r.done) break;
      batches++;
      shown += r.value.displayCount;
      expect(r.value.pathsDone).toBeGreaterThan(last);
      last = r.value.pathsDone;
    }
    expect(batches).toBe(10);
    expect(shown).toBe(777);
  });
  it('VaR/CVaR at horizon are consistent', () => {
    expect(res.risk.cvar95).toBeGreaterThan(res.risk.var95);
    expect(res.risk.var99).toBeGreaterThan(res.risk.var95);
    expect(Math.abs(res.risk.var95 - res.analytic!.var95)).toBeLessThan(0.015);
  });
  it('histogram counts all paths', () => {
    expect(res.histogram.counts.reduce((a, b) => a + b, 0)).toBe(base.nPaths);
  });
});

describe('Monte Carlo — bootstrap', () => {
  it('constant history → deterministic terminal S0·exp(H·r)', () => {
    const r = simulateAll({ ...base, model: 'bootstrap', history: new Float64Array(50).fill(0.001), nPaths: 100, horizon: 30, blockSize: 5 });
    expect(r.terminalSorted[0]).toBeCloseTo(base.s0 * Math.exp(0.03), 10);
    expect(r.terminalSorted[99]).toBeCloseTo(base.s0 * Math.exp(0.03), 10);
  });
  it('block bootstrap preserves the mean log return', () => {
    const rng = createRng(5);
    const hist = Float64Array.from({ length: 500 }, () => 0.0004 + 0.02 * rng.normal());
    const m = hist.reduce((a, b) => a + b, 0) / hist.length;
    const r = simulateAll({ ...base, model: 'bootstrap', history: hist, nPaths: 20_000, horizon: 100, blockSize: 10 });
    const meanLog = Array.from(r.terminalSorted).reduce((a, s) => a + Math.log(s / base.s0), 0) / 20_000;
    expect(Math.abs(meanLog - 100 * m)).toBeLessThan(0.004);
  });
  it('estimateGbm recovers parameters of synthetic GBM log returns', () => {
    const rng = createRng(77);
    const mu = 0.1,
      sigma = 0.25,
      ppy = 252;
    const lr = Float64Array.from({ length: 252 * 40 }, () => (mu - sigma ** 2 / 2) / ppy + (sigma / Math.sqrt(ppy)) * rng.normal());
    const est = estimateGbm(lr, ppy);
    expect(Math.abs(est.sigma - sigma)).toBeLessThan(0.004);
    expect(Math.abs(est.mu - mu)).toBeLessThan(0.05); // drift is notoriously noisy
  });
  it('grid includes 0 and H and is capped', () => {
    const g = makeGrid(1000);
    expect(g[0]).toBe(0);
    expect(g[g.length - 1]).toBe(1000);
    expect(g.length).toBe(121);
    expect(makeGrid(30).length).toBe(31);
  });
});
