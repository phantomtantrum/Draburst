import type { Asset, BarSeries, SourceInfo } from './types';

/**
 * The UI never talks to a data vendor directly. Route handlers resolve an
 * asset to a MarketDataProvider; swapping vendors means adding an implementation.
 */
export interface MarketDataProvider {
  readonly id: SourceInfo['provider'];
  readonly source: SourceInfo;
  /** Whether required credentials are present. */
  configured(): boolean;
  /** Daily OHLCV, split/dividend adjusted where applicable, oldest → newest, completed bars only. */
  dailyBars(symbol: string, fromMs: number, toMs: number): Promise<BarSeries>;
  /** Symbol search. */
  search(query: string): Promise<Asset[]>;
}

export function emptySeries(): BarSeries {
  return { t: [], o: [], h: [], l: [], c: [], v: [] };
}

export function pushBar(s: BarSeries, t: number, o: number, h: number, l: number, c: number, v: number) {
  s.t.push(t);
  s.o.push(o);
  s.h.push(h);
  s.l.push(l);
  s.c.push(c);
  s.v.push(v);
}
