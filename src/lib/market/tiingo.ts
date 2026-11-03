import { fetchWithRetry, isoDate } from './http';
import { emptySeries, pushBar, type MarketDataProvider } from './provider';
import { MarketError, type Asset, type SourceInfo } from './types';

/**
 * Tiingo end-of-day prices — split AND dividend adjusted (adjOpen/High/Low/Close).
 * Requires TIINGO_API_KEY (server-side only). Free tier (personal use):
 * ≈ 50 requests/hour, 1,000/day, 500 unique symbols/month — hence aggressive caching.
 */
export const tiingoSource: SourceInfo = {
  provider: 'tiingo',
  name: 'Tiingo',
  url: 'https://www.tiingo.com',
  freshness: 'eod',
  adjusted: true,
  note: 'End-of-day, adjusted for splits and dividends. Close ≈ 16:00 America/New_York.',
};

const BASE = 'https://api.tiingo.com';

interface TiingoBar {
  date: string;
  adjOpen: number;
  adjHigh: number;
  adjLow: number;
  adjClose: number;
  adjVolume: number;
}

/** Tiingo uses "-" for share classes: BRK.B → BRK-B */
export const toTiingoTicker = (s: string) => s.toUpperCase().replace(/\./g, '-');
export const fromTiingoTicker = (s: string) => s.toUpperCase().replace(/-/g, '.');

export class TiingoProvider implements MarketDataProvider {
  readonly id = 'tiingo' as const;
  readonly source = tiingoSource;

  private key() {
    const k = process.env.TIINGO_API_KEY;
    if (!k) throw new MarketError('NOT_CONFIGURED', 'Stock data is not configured on this deployment (TIINGO_API_KEY missing).');
    return k;
  }

  configured() {
    return !!process.env.TIINGO_API_KEY;
  }

  async dailyBars(symbol: string, fromMs: number, toMs: number) {
    const key = this.key();
    const url = `${BASE}/tiingo/daily/${encodeURIComponent(toTiingoTicker(symbol))}/prices?startDate=${isoDate(fromMs)}&endDate=${isoDate(toMs)}&format=json&resampleFreq=daily`;
    const res = await fetchWithRetry(url, { label: 'Tiingo', headers: { Authorization: `Token ${key}`, 'Content-Type': 'application/json' } });
    const rows = (await res.json()) as TiingoBar[];
    const out = emptySeries();
    for (const r of rows) {
      const t = Date.parse(r.date.slice(0, 10) + 'T00:00:00Z');
      pushBar(out, t, r.adjOpen, r.adjHigh, r.adjLow, r.adjClose, r.adjVolume);
    }
    return out;
  }

  async search(query: string): Promise<Asset[]> {
    const key = this.key();
    const q = query.trim();
    if (!q) return [];
    const res = await fetchWithRetry(`${BASE}/tiingo/utilities/search?query=${encodeURIComponent(q)}&limit=12`, {
      label: 'Tiingo',
      headers: { Authorization: `Token ${key}` },
    });
    const rows = (await res.json()) as Array<{ ticker: string; name: string; assetType: string; isActive: boolean; countryCode?: string }>;
    return rows
      .filter((r) => r.isActive && /stock|etf|mutual/i.test(r.assetType) && (!r.countryCode || r.countryCode === 'US'))
      .map((r): Asset => {
        const symbol = fromTiingoTicker(r.ticker);
        return { id: `stock:${symbol}`, symbol, cls: 'stock', name: r.name };
      });
  }
}
