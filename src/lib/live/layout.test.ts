import { describe, expect, it } from 'vitest';
import { correlationLayout } from './layout';

const dist = (a: number[], b: number[]) => Math.hypot(...a.map((x, i) => x - b[i]!));

describe('correlation layout (classical MDS)', () => {
  it('reproduces correlation distances √(2(1−ρ)) when embeddable', () => {
    const corr = [
      [1, 0.9, 0.1],
      [0.9, 1, 0.2],
      [0.1, 0.2, 1],
    ];
    const p = correlationLayout(corr);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) expect(dist(p[i]!, p[j]!)).toBeCloseTo(Math.sqrt(2 * (1 - corr[i]![j]!)), 6);
  });
  it('correlated assets are closer than uncorrelated ones', () => {
    const p = correlationLayout([
      [1, 0.95, 0, 0],
      [0.95, 1, 0, 0],
      [0, 0, 1, 0.1],
      [0, 0, 0.1, 1],
    ]);
    expect(dist(p[0]!, p[1]!)).toBeLessThan(dist(p[0]!, p[2]!));
  });
});
