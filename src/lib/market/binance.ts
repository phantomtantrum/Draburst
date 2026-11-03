import { fetchWithRetry, utcMidnight } from './http';
import { emptySeries, pushBar, type MarketDataProvider } from './provider';
import { UNIVERSE } from './universe';
import type { Asset, SourceInfo } from './types';

/**
 * Binance public market data — no API key.
 * Uses the market-data-only mirror (data-api.binance.vision), which serves
 * the same /api/v3 spot endpoints and is reachable where api.binance.com
 * returns HTTP 451. Quote asset: USDT.
 */
export const BINANCE_REST = 'https://data-api.binance.vision';
export const BINANCE_WS = 'wss://data-stream.binance.vision';

const DAY = 86_400_000;

export const binanceSource: SourceInfo = {
  provider: 'binance',
  name: 'Binance',
  url: 'https://www.binance.com/en/binance-api',
  freshness: 'live',
  adjusted: false,
  note: 'Spot USDT pairs, daily candles 00:00–24:00 UTC. Crypto has no splits/dividends.',
};

type Kline = [number, string, string, string, string, string, number, string, number, string, string, string];

export class BinanceProvider implements MarketDataProvider {
  readonly id = 'binance' as const;
  readonly source = binanceSource;

  configured() {
    return true;
  }

  async dailyBars(symbol: string, fromMs: number, toMs: number) {
    const pair = `${symbol.toUpperCase()}USDT`;
    const out = emptySeries();
    const now = Date.now();
    let start = utcMidnight(fromMs);
    const end = Math.min(toMs, now);
    // ≤ 1000 candles per request
    for (let guard = 0; guard < 20 && start < end; guard++) {
      const url = `${BINANCE_REST}/api/v3/klines?symbol=${pair}&interval=1d&startTime=${start}&endTime=${end}&limit=1000`;
      const res = await fetchWithRetry(url, { label: 'Binance' });
      const rows = (await res.json()) as Kline[];
      if (!rows.length) break;
      for (const k of rows) {
        const closeTime = k[6];
        if (closeTime > now) continue; // skip the in-progress candle
        pushBar(out, k[0], +k[1], +k[2], +k[3], +k[4], +k[7]); // volume in quote (USDT)
      }
      const last = rows[rows.length - 1]![0];
      if (rows.length < 1000) break;
      start = last + DAY;
    }
    return out;
  }

  async search(query: string): Promise<Asset[]> {
    const q = query.trim().toUpperCase();
    if (!q) return [];
    const res = await fetchWithRetry(`${BINANCE_REST}/api/v3/ticker/price`, { label: 'Binance' });
    const rows = (await res.json()) as Array<{ symbol: string }>;
    const known = new Map(UNIVERSE.filter((a) => a.cls === 'crypto').map((a) => [a.symbol, a.name]));
    return rows
      .filter((r) => r.symbol.endsWith('USDT'))
      .map((r) => r.symbol.slice(0, -4))
      .filter((s) => s.length > 0 && !/(UP|DOWN|BULL|BEAR)$/.test(s) && s.includes(q))
      .sort((a, b) => Number(b === q) - Number(a === q) || Number(b.startsWith(q)) - Number(a.startsWith(q)) || a.length - b.length)
      .slice(0, 12)
      .map((s): Asset => ({ id: `crypto:${s}`, symbol: s, cls: 'crypto', name: known.get(s) ?? `${s} / USDT` }));
  }
}
