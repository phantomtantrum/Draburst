import { MarketError } from './types';

/**
 * fetch with exponential backoff + jitter for 429 / 5xx / network errors.
 * Honors Retry-After (seconds). Throws MarketError on final failure.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { retries?: number; baseDelayMs?: number; timeoutMs?: number; label?: string } = {},
): Promise<Response> {
  const { retries = 3, baseDelayMs = 400, timeoutMs = 12_000, label = 'upstream', ...rest } = init;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...rest, signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (res.ok) return res;
      if (res.status === 404) throw new MarketError('NOT_FOUND', `${label}: not found`);
      if (res.status === 401 || res.status === 403) throw new MarketError('NOT_CONFIGURED', `${label}: unauthorized (check API key)`);
      if (res.status === 451) throw new MarketError('UPSTREAM', `${label}: unavailable from this region (HTTP 451)`);
      if (res.status === 400) {
        const body = await res.text().catch(() => '');
        throw new MarketError(/symbol/i.test(body) ? 'NOT_FOUND' : 'BAD_REQUEST', `${label}: bad request`);
      }
      const retryAfter = Number(res.headers.get('retry-after'));
      if (res.status === 429 || res.status === 418) {
        if (attempt === retries) throw new MarketError('RATE_LIMITED', `${label}: rate limited`, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 60);
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 8000) : backoff(attempt, baseDelayMs));
        continue;
      }
      if (res.status >= 500) {
        lastErr = new MarketError('UPSTREAM', `${label}: HTTP ${res.status}`);
        if (attempt < retries) await sleep(backoff(attempt, baseDelayMs));
        continue;
      }
      throw new MarketError('UPSTREAM', `${label}: HTTP ${res.status}`);
    } catch (e) {
      clearTimeout(timer);
      if (e instanceof MarketError) throw e;
      lastErr = e;
      if (attempt < retries) await sleep(backoff(attempt, baseDelayMs));
    }
  }
  if (lastErr instanceof MarketError) throw lastErr;
  throw new MarketError('UPSTREAM', `${label}: network error`);
}

function backoff(attempt: number, base: number): number {
  return base * 2 ** attempt + Math.random() * base;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function utcMidnight(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}
