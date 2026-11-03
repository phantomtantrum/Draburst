import { fetchWithRetry } from './http';
import type { SourceInfo } from './types';

/** CoinGecko — fallback for crypto metadata (names, market cap rank). No key. */
export const coingeckoSource: SourceInfo = {
  provider: 'coingecko',
  name: 'CoinGecko',
  url: 'https://www.coingecko.com/en/api',
  freshness: 'delayed',
  adjusted: false,
};

export interface CoinMeta {
  symbol: string;
  name: string;
  rank: number | null;
  marketCap: number | null;
}

export async function topCoins(limit = 100): Promise<CoinMeta[]> {
  const res = await fetchWithRetry(
    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=false`,
    { label: 'CoinGecko', retries: 2, headers: { accept: 'application/json' } },
  );
  const rows = (await res.json()) as Array<{ symbol: string; name: string; market_cap_rank: number | null; market_cap: number | null }>;
  return rows.map((r) => ({ symbol: r.symbol.toUpperCase(), name: r.name, rank: r.market_cap_rank, marketCap: r.market_cap }));
}
