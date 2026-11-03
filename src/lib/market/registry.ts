import type { AssetClass } from '@/lib/quant/returns';
import { BinanceProvider } from './binance';
import { FixtureProvider } from './fixture';
import type { MarketDataProvider } from './provider';
import { TiingoProvider } from './tiingo';

const fixtureMode = () => process.env.MARKET_DATA_MODE === 'fixture' && process.env.VERCEL_ENV !== 'production';

const providers = {
  crypto: new BinanceProvider(),
  stock: new TiingoProvider(),
};

export function providerFor(cls: AssetClass): MarketDataProvider {
  if (fixtureMode()) return new FixtureProvider(cls);
  return providers[cls];
}

export function providerStatus() {
  return {
    crypto: { provider: providerFor('crypto').source.name, configured: providerFor('crypto').configured() },
    stock: { provider: providerFor('stock').source.name, configured: providerFor('stock').configured() },
    fixture: fixtureMode(),
  };
}
