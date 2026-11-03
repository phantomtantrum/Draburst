import { createRng } from '@/lib/quant/prng';
import { utcMidnight } from './http';
import { emptySeries, pushBar, type MarketDataProvider } from './provider';
import { UNIVERSE } from './universe';
import type { Asset, SourceInfo } from './types';

/**
 * TEST-ONLY provider (MARKET_DATA_MODE=fixture): deterministic synthetic bars
 * so unit/e2e tests run without network. Every response is labeled FIXTURE in
 * the UI. Never enabled in production.
 */
export const fixtureSource: SourceInfo = {
  provider: 'fixture',
  name: 'Fixture (synthetic test data)',
  url: 'https://github.com',
  freshness: 'fixture',
  adjusted: true,
  note: 'Deterministic synthetic prices for automated tests — not market data.',
};

const DAY = 86_400_000;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export class FixtureProvider implements MarketDataProvider {
  readonly id = 'fixture' as const;
  readonly source = fixtureSource;
  constructor(private cls: 'crypto' | 'stock') {}
  configured() {
    return true;
  }
  async dailyBars(symbol: string, fromMs: number, toMs: number) {
    const rng = createRng(hash(`${this.cls}:${symbol}`));
    const vol = this.cls === 'crypto' ? 0.035 : 0.014;
    const drift = 0.0003;
    const out = emptySeries();
    // fixed anchor so the same date always has the same price
    const anchor = Date.UTC(2015, 0, 1);
    let p = 50 + (hash(symbol) % 200);
    const end = utcMidnight(Math.min(toMs, Date.now() - DAY));
    for (let t = anchor; t <= end; t += DAY) {
      const dow = new Date(t).getUTCDay();
      const o = p * (1 + 0.2 * vol * rng.normal());
      const c = o * Math.exp(drift - 0.5 * vol * vol + vol * rng.normal());
      const h = Math.max(o, c) * (1 + 0.3 * vol * rng.next());
      const l = Math.min(o, c) * (1 - 0.3 * vol * rng.next());
      p = c;
      if (this.cls === 'stock' && (dow === 0 || dow === 6)) continue;
      if (t >= utcMidnight(fromMs)) pushBar(out, t, o, h, l, c, 1e6);
    }
    return out;
  }
  async search(query: string): Promise<Asset[]> {
    const q = query.toUpperCase();
    return UNIVERSE.filter((a) => a.cls === this.cls && (a.symbol.includes(q) || a.name.toUpperCase().includes(q)));
  }
}
