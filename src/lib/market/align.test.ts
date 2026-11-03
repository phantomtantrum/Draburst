import { describe, expect, it } from 'vitest';
import { alignSeries } from './align';
import type { BarSeries } from './types';

const DAY = 86_400_000;
const mk = (days: number[], start = Date.UTC(2024, 0, 1)): BarSeries => {
  const t = days.map((d) => start + d * DAY);
  const c = days.map((d) => 100 + d);
  return { t, o: c, h: c, l: c, c, v: c.map(() => 1) };
};

describe('calendar alignment', () => {
  it('intersects crypto (7d) with stock (weekdays) without forward-fill', () => {
    // 2024-01-01 is a Monday
    const crypto = mk([0, 1, 2, 3, 4, 5, 6, 7]);
    const stock = mk([0, 1, 2, 3, 4, 7]);
    const a = alignSeries([crypto, stock]);
    expect(a.t.map((t) => (t - Date.UTC(2024, 0, 1)) / DAY)).toEqual([0, 1, 2, 3, 4, 7]);
    // Fri→Mon return for crypto spans the weekend: 107/104
    expect(a.close[0]![5]! / a.close[0]![4]!).toBeCloseTo(107 / 104, 14);
    expect(a.dropped).toEqual([2, 0]);
  });
  it('ignores intraday timestamp differences (same UTC day)', () => {
    const s1 = mk([0, 1, 2]);
    const s2 = { ...mk([0, 1, 2]), t: mk([0, 1, 2]).t.map((t) => t + 5 * 3600_000) };
    expect(alignSeries([s1, s2]).t).toHaveLength(3);
  });
});
