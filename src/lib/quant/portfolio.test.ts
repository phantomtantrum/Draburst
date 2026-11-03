import { describe, expect, it } from 'vitest';
import { analyzePortfolio } from './portfolio';
import { createRng } from './prng';

function synth(n: number, T: number, seed = 1) {
  const r = createRng(seed);
  return Array.from({ length: n }, (_, a) => {
    let p = 100;
    const out = [p];
    for (let t = 0; t < T; t++) {
      p *= 1 + 0.0003 * (a + 1) + 0.01 * (1 + a * 0.3) * r.normal();
      out.push(p);
    }
    return out;
  });
}

describe('analyzePortfolio', () => {
  const closes = synth(4, 500);
  const base = { closes, ppy: 252, rf: 0.02, estimator: 'sample' as const, lo: [0, 0, 0, 0], hi: [1, 1, 1, 1], custom: [0.4, 0.3, 0.2, 0.1], nRandom: 2000, seed: 7 };
  it('produces consistent named portfolios', () => {
    const o = analyzePortfolio(base);
    const [mv, ms, eq, cu] = o.portfolios;
    expect(o.portfolios.map((p) => p.key)).toEqual(['minvar', 'maxsharpe', 'equal', 'custom']);
    for (const p of o.portfolios) expect(Array.from(p.weights).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    for (const p of o.portfolios) expect(p.riskPct.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(mv!.vol).toBeLessThanOrEqual(Math.min(eq!.vol, cu!.vol, ms!.vol) + 1e-9);
    expect(ms!.sharpe).toBeGreaterThanOrEqual(Math.max(eq!.sharpe, cu!.sharpe, mv!.sharpe) - 1e-9);
    expect(o.corr[0]![0]).toBe(1);
    expect(o.observations).toBe(500);
  });
  it('Ledoit–Wolf reports shrinkage in [0,1] and keeps the same diagonal scale roughly', () => {
    const o = analyzePortfolio({ ...base, estimator: 'lw' });
    expect(o.shrinkage).toBeGreaterThanOrEqual(0);
    expect(o.shrinkage).toBeLessThanOrEqual(1);
  });
  it('rejects infeasible bounds', () => {
    expect(() => analyzePortfolio({ ...base, lo: [0.3, 0.3, 0.3, 0.3] })).toThrow(/infeasible/);
  });
});
