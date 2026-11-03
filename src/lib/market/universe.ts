import type { Asset } from './types';

/**
 * Curated default universe shown before searching. Not a recommendation —
 * just liquid, well-known instruments with long histories.
 */
const crypto: Array<[string, string]> = [
  ['BTC', 'Bitcoin'],
  ['ETH', 'Ether'],
  ['SOL', 'Solana'],
  ['BNB', 'BNB'],
  ['XRP', 'XRP'],
  ['ADA', 'Cardano'],
  ['DOGE', 'Dogecoin'],
  ['AVAX', 'Avalanche'],
  ['LINK', 'Chainlink'],
  ['DOT', 'Polkadot'],
  ['LTC', 'Litecoin'],
  ['TRX', 'TRON'],
  ['ATOM', 'Cosmos'],
  ['NEAR', 'NEAR Protocol'],
  ['UNI', 'Uniswap'],
];

const stocks: Array<[string, string]> = [
  ['SPY', 'SPDR S&P 500 ETF'],
  ['QQQ', 'Invesco QQQ (Nasdaq-100)'],
  ['IWM', 'iShares Russell 2000 ETF'],
  ['VTI', 'Vanguard Total Stock Market ETF'],
  ['EFA', 'iShares MSCI EAFE ETF'],
  ['EEM', 'iShares MSCI Emerging Markets ETF'],
  ['TLT', 'iShares 20+ Year Treasury Bond ETF'],
  ['IEF', 'iShares 7–10 Year Treasury Bond ETF'],
  ['GLD', 'SPDR Gold Shares'],
  ['AAPL', 'Apple'],
  ['MSFT', 'Microsoft'],
  ['NVDA', 'NVIDIA'],
  ['AMZN', 'Amazon'],
  ['GOOGL', 'Alphabet (Class A)'],
  ['META', 'Meta Platforms'],
  ['TSLA', 'Tesla'],
  ['JPM', 'JPMorgan Chase'],
  ['XOM', 'Exxon Mobil'],
  ['BRK.B', 'Berkshire Hathaway (Class B)'],
];

export const UNIVERSE: Asset[] = [
  ...crypto.map(([symbol, name]): Asset => ({ id: `crypto:${symbol}`, symbol, cls: 'crypto', name })),
  ...stocks.map(([symbol, name]): Asset => ({ id: `stock:${symbol}`, symbol, cls: 'stock', name })),
];

export const UNIVERSE_BY_ID = new Map(UNIVERSE.map((a) => [a.id, a]));

export function assetName(id: string): string {
  return UNIVERSE_BY_ID.get(id as Asset['id'])?.name ?? id.split(':')[1] ?? id;
}
