import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceProvider } from './binance';
import { fetchWithRetry } from './http';
import { TiingoProvider, toTiingoTicker } from './tiingo';
import { MarketError, parseAssetId } from './types';

const DAY = 86_400_000;
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('parseAssetId', () => {
  it('normalizes case and validates', () => {
    expect(parseAssetId('crypto:btc')?.id).toBe('crypto:BTC');
    expect(parseAssetId('STOCK:brk.b')?.id).toBe('stock:BRK.B');
    expect(parseAssetId('forex:EUR')).toBeNull();
    expect(parseAssetId('stock:')).toBeNull();
  });
});

describe('BinanceProvider', () => {
  it('parses klines, uses quote volume, drops the in-progress candle', async () => {
    const now = Date.now();
    const d0 = Math.floor(now / DAY) * DAY - 2 * DAY;
    const k = (t: number, c: string) => [t, '1', '2', '0.5', c, '10', t + DAY - 1, '123', 5, '0', '0', '0'];
    const fetchMock = vi.fn(async (_url: string) => Response.json([k(d0, '1.5'), k(d0 + DAY, '1.6'), k(d0 + 2 * DAY, '1.7')]));
    vi.stubGlobal('fetch', fetchMock);
    const s = await new BinanceProvider().dailyBars('btc', d0, now);
    expect(s.t).toEqual([d0, d0 + DAY]);
    expect(s.c).toEqual([1.5, 1.6]);
    expect(s.v).toEqual([123, 123]);
    expect(String(fetchMock.mock.calls[0]![0])).toContain('symbol=BTCUSDT');
    expect(String(fetchMock.mock.calls[0]![0])).toContain('data-api.binance.vision');
  });
});

describe('TiingoProvider', () => {
  it('reports NOT_CONFIGURED without a key (no network call)', async () => {
    vi.stubEnv('TIINGO_API_KEY', '');
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const p = new TiingoProvider();
    expect(p.configured()).toBe(false);
    await expect(p.dailyBars('AAPL', 0, 1)).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(f).not.toHaveBeenCalled();
  });
  it('maps ADJUSTED OHLCV and sends the key in a header, not the URL', async () => {
    vi.stubEnv('TIINGO_API_KEY', 'secret');
    const f = vi.fn(async () =>
      Response.json([{ date: '2024-01-02T00:00:00.000Z', open: 999, adjOpen: 10, adjHigh: 12, adjLow: 9, adjClose: 11, adjVolume: 5, close: 999 }]),
    );
    vi.stubGlobal('fetch', f);
    const s = await new TiingoProvider().dailyBars('BRK.B', Date.UTC(2024, 0, 1), Date.UTC(2024, 0, 3));
    expect(s.c).toEqual([11]);
    expect(s.o).toEqual([10]);
    expect(s.t).toEqual([Date.UTC(2024, 0, 2)]);
    const [url, init] = f.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toContain('/BRK-B/prices');
    expect(url).not.toContain('secret');
    expect((init.headers as Record<string, string>).Authorization).toBe('Token secret');
  });
  it('ticker mapping', () => expect(toTiingoTicker('brk.b')).toBe('BRK-B'));
});

describe('fetchWithRetry', () => {
  it('retries 429 then succeeds', async () => {
    let n = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => (++n < 3 ? new Response('', { status: 429, headers: { 'retry-after': '0' } }) : Response.json({ ok: 1 }))),
    );
    const r = await fetchWithRetry('https://x.test', { baseDelayMs: 1 });
    expect(await r.json()).toEqual({ ok: 1 });
    expect(n).toBe(3);
  });
  it('gives up with RATE_LIMITED + retryAfter', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429, headers: { 'retry-after': '1' } })));
    const err = await fetchWithRetry('https://x.test', { retries: 1, baseDelayMs: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(MarketError);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfter).toBe(1);
  });
  it('404 → NOT_FOUND without retry', async () => {
    const f = vi.fn(async () => new Response('', { status: 404 }));
    vi.stubGlobal('fetch', f);
    await expect(fetchWithRetry('https://x.test')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(f).toHaveBeenCalledTimes(1);
  });
});
