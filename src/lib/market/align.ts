import type { BarSeries } from './types';

/**
 * Calendar alignment for multi-asset analysis.
 *
 * Crypto trades 7 days a week; exchanges ~252 days a year. We align on the
 * INTERSECTION of dates (UTC day keys), so each aligned return spans the same
 * wall-clock interval for every asset (e.g. Fri→Mon for crypto includes the
 * weekend, exactly like the stock's Fri→Mon return). No forward-filling, so no
 * fake zero returns and no look-ahead.
 *
 * Caveat (documented): crypto "daily close" is 00:00 UTC; US equities close
 * at 16:00 New York (20:00/21:00 UTC), a 3–4 hour offset.
 */
export interface Aligned {
  t: number[];
  /** close[asset][i] */
  close: number[][];
  open: number[][];
  high: number[][];
  low: number[][];
  dropped: number[];
}

const DAY = 86_400_000;
const dayKey = (t: number) => Math.floor(t / DAY);

export function alignSeries(series: ReadonlyArray<BarSeries>): Aligned {
  if (series.length === 0) return { t: [], close: [], open: [], high: [], low: [], dropped: [] };
  const maps = series.map((s) => {
    const m = new Map<number, number>();
    s.t.forEach((t, i) => m.set(dayKey(t), i));
    return m;
  });
  const keys = [...maps[0]!.keys()].filter((k) => maps.every((m) => m.has(k))).sort((a, b) => a - b);
  const pick = (field: 'c' | 'o' | 'h' | 'l') => series.map((s, a) => keys.map((k) => s[field][maps[a]!.get(k)!]!));
  return {
    t: keys.map((k) => k * DAY),
    close: pick('c'),
    open: pick('o'),
    high: pick('h'),
    low: pick('l'),
    dropped: series.map((s) => s.t.length - keys.length),
  };
}
