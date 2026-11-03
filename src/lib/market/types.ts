import type { AssetClass } from '@/lib/quant/returns';

/** Canonical asset id: `crypto:BTC` (Binance BTCUSDT) or `stock:AAPL`. */
export type AssetId = `${AssetClass}:${string}`;

export interface Asset {
  id: AssetId;
  symbol: string;
  cls: AssetClass;
  name: string;
}

/** Columnar daily bars (compact JSON). `t` = UTC midnight of the bar's date. */
export interface BarSeries {
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
  v: number[];
}

export type Freshness = 'live' | 'eod' | 'delayed' | 'fixture';

export interface SourceInfo {
  provider: 'binance' | 'tiingo' | 'coingecko' | 'fixture';
  name: string;
  url: string;
  freshness: Freshness;
  adjusted: boolean;
  note?: string;
}

export interface BarsResponse {
  asset: Asset;
  bars: BarSeries;
  source: SourceInfo;
  /** ISO time the upstream data was fetched */
  asOf: string;
}

export type MarketErrorCode = 'NOT_CONFIGURED' | 'RATE_LIMITED' | 'NOT_FOUND' | 'UPSTREAM' | 'BAD_REQUEST';

export class MarketError extends Error {
  constructor(
    public code: MarketErrorCode,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'MarketError';
  }
}

export interface MarketErrorBody {
  error: { code: MarketErrorCode; message: string; retryAfter?: number };
}

export function parseAssetId(id: string): Asset | null {
  const m = /^(crypto|stock):([A-Z0-9.\-]{1,15})$/.exec(id.trim().toUpperCase().replace(/^(CRYPTO|STOCK)/, (s) => s.toLowerCase()));
  if (!m) return null;
  const cls = m[1] as AssetClass;
  const symbol = m[2]!;
  return { id: `${cls}:${symbol}`, symbol, cls, name: symbol };
}
