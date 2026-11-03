import { MarketError, type MarketErrorBody } from './types';

const STATUS: Record<MarketError['code'], number> = {
  NOT_CONFIGURED: 503,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  UPSTREAM: 502,
  BAD_REQUEST: 400,
};

export function errorResponse(e: unknown): Response {
  const err = e instanceof MarketError ? e : new MarketError('UPSTREAM', 'Unexpected upstream error');
  if (!(e instanceof MarketError)) console.error('[market]', e);
  const body: MarketErrorBody = { error: { code: err.code, message: err.message, ...(err.retryAfter ? { retryAfter: err.retryAfter } : {}) } };
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' };
  if (err.retryAfter) headers['Retry-After'] = String(err.retryAfter);
  return Response.json(body, { status: STATUS[err.code], headers });
}
