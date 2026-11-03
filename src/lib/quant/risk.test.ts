import { describe, expect, it } from 'vitest';
import ref from './__fixtures__/reference.json';
import { gaussianCVaR, gaussianVaR, historicalCVaR, historicalVaR, parametricCVaR, parametricVaR } from './risk';

const x = ref.stats.x;

describe('VaR / CVaR vs numpy/scipy', () => {
  it('historical', () => {
    expect(historicalVaR(x, 0.95)).toBeCloseTo(ref.risk.hvar95, 14);
    expect(historicalVaR(x, 0.99)).toBeCloseTo(ref.risk.hvar99, 14);
    expect(historicalCVaR(x, 0.95)).toBeCloseTo(ref.risk.hcvar95, 14);
  });
  it('parametric (Gaussian)', () => {
    expect(parametricVaR(x, 0.95)).toBeCloseTo(ref.risk.pvar95, 10);
    expect(parametricCVaR(x, 0.95)).toBeCloseTo(ref.risk.pcvar95, 10);
  });
  it('textbook: μ=0, σ=1 → VaR95 = 1.6449, CVaR95 = 2.0627', () => {
    expect(gaussianVaR(0, 1, 0.95)).toBeCloseTo(1.6448536269514722, 10);
    expect(gaussianCVaR(0, 1, 0.95)).toBeCloseTo(2.0627128075074257, 10);
  });
  it('CVaR ≥ VaR', () => {
    expect(historicalCVaR(x, 0.95)).toBeGreaterThanOrEqual(historicalVaR(x, 0.95));
  });
  it('hand example: 20 returns −10…+9% → VaR95 = 9.05% (interp.), CVaR95 = mean(r ≤ −9.05%) = 10%', () => {
    const r = Array.from({ length: 20 }, (_, i) => (i - 10) / 100);
    expect(historicalVaR(r, 0.95)).toBeCloseTo(0.0905, 14);
    expect(historicalCVaR(r, 0.95)).toBeCloseTo(0.1, 14);
  });
});
