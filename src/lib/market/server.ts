import 'server-only';
import { cacheLife } from 'next/cache';
import type { AssetClass } from '@/lib/quant/returns';
import { providerFor } from './registry';
import { UNIVERSE_BY_ID } from './universe';
import { MarketError, type Asset, type BarsResponse, type MarketErrorCode } from './types';

const DAY = 86_400_000;

/**
 * Errors cannot cross a `use cache` boundary with their type intact (they are
 * redacted in production), so cached scopes return a Result. Successes are
 * cached for hours; failures for under a minute — which also throttles
 * repeated calls while a vendor is rate-limiting us.
 */
type Result<T> = { ok: true; value: T } | { ok: false; code: MarketErrorCode; message: string; retryAfter?: number };

function toFailure(e: unknown): Extract<Result<never>, { ok: false }> {
  if (e instanceof MarketError) return { ok: false, code: e.code, message: e.message, ...(e.retryAfter ? { retryAfter: e.retryAfter } : {}) };
  console.error('[market]', e);
  return { ok: false, code: 'UPSTREAM', message: 'Data provider unavailable. Try again shortly.' };
}

function unwrap<T>(r: Result<T>): T {
  if (r.ok) return r.value;
  throw new MarketError(r.code, r.message, r.retryAfter);
}

async function dailyBarsCached(cls: AssetClass, symbol: string, years: number): Promise<Result<BarsResponse>> {
  'use cache';
  const p = providerFor(cls);
  try {
    const to = Date.now();
    const from = to - Math.ceil(years * 365.25) * DAY;
    const bars = await p.dailyBars(symbol, from, to);
    if (bars.t.length < 2) throw new MarketError('NOT_FOUND', `No daily data for ${symbol}`);
    const id = `${cls}:${symbol}` as Asset['id'];
    cacheLife({ stale: 1800, revalidate: cls === 'crypto' ? 3 * 3600 : 6 * 3600, expire: 2 * 86_400 });
    return {
      ok: true,
      value: {
        asset: { id, symbol, cls, name: UNIVERSE_BY_ID.get(id)?.name ?? symbol },
        bars,
        // daily bars are completed sessions; live ticks come from the websocket
        source: { ...p.source, freshness: p.source.freshness === 'live' ? 'eod' : p.source.freshness },
        asOf: new Date(to).toISOString(),
      },
    };
  } catch (e) {
    cacheLife({ stale: 0, revalidate: 30, expire: 60 });
    return toFailure(e);
  }
}

/** Cached daily bars keyed by (class, symbol, years). */
export async function getDailyBars(cls: AssetClass, symbol: string, years: number): Promise<BarsResponse> {
  const p = providerFor(cls);
  if (!p.configured()) throw new MarketError('NOT_CONFIGURED', `${cls === 'stock' ? 'Stock' : 'Crypto'} data is not configured on this deployment.`);
  return unwrap(await dailyBarsCached(cls, symbol.toUpperCase(), years));
}

async function searchCached(cls: AssetClass, query: string): Promise<Result<Asset[]>> {
  'use cache';
  try {
    const value = await providerFor(cls).search(query);
    cacheLife({ stale: 3600, revalidate: 86_400, expire: 7 * 86_400 });
    return { ok: true, value };
  } catch (e) {
    cacheLife({ stale: 0, revalidate: 30, expire: 60 });
    return toFailure(e);
  }
}

export async function searchAssets(cls: AssetClass, query: string): Promise<Asset[]> {
  if (!providerFor(cls).configured()) throw new MarketError('NOT_CONFIGURED', 'Search is not configured on this deployment.');
  return unwrap(await searchCached(cls, query));
}
