'use client';

import type { Asset, BarsResponse, MarketErrorBody, MarketErrorCode } from './types';

export class MarketClientError extends Error {
  constructor(
    public code: MarketErrorCode | 'NETWORK',
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

const barsCache = new Map<string, Promise<BarsResponse>>();

/** Fetch daily bars through our route handler (deduped + memoized per session). */
export function fetchBars(id: string, years: number): Promise<BarsResponse> {
  const key = `${id}|${years}`;
  const hit = barsCache.get(key);
  if (hit) return hit;
  const p = (async () => {
    let res: Response;
    try {
      res = await fetch(`/api/market/bars?id=${encodeURIComponent(id)}&years=${years}`);
    } catch {
      throw new MarketClientError('NETWORK', 'Network error — check your connection.');
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as MarketErrorBody | null;
      throw new MarketClientError(body?.error.code ?? 'UPSTREAM', body?.error.message ?? `HTTP ${res.status}`, body?.error.retryAfter);
    }
    return (await res.json()) as BarsResponse;
  })();
  barsCache.set(key, p);
  p.catch(() => barsCache.delete(key));
  return p;
}

export async function searchAssets(q: string, cls: Asset['cls'], signal?: AbortSignal): Promise<Asset[]> {
  const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}&cls=${cls}`, { signal });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as MarketErrorBody | null;
    throw new MarketClientError(body?.error.code ?? 'UPSTREAM', body?.error.message ?? `HTTP ${res.status}`, body?.error.retryAfter);
  }
  return ((await res.json()) as { results: Asset[] }).results;
}

export interface ProviderStatus {
  crypto: { provider: string; configured: boolean };
  stock: { provider: string; configured: boolean };
  fixture: boolean;
}

let statusPromise: Promise<ProviderStatus> | null = null;
export function fetchStatus(): Promise<ProviderStatus> {
  statusPromise ??= fetch('/api/market/status')
    .then((r) => r.json() as Promise<ProviderStatus>)
    .catch(() => ({ crypto: { provider: 'Binance', configured: true }, stock: { provider: 'Tiingo', configured: false }, fixture: false }));
  return statusPromise;
}
