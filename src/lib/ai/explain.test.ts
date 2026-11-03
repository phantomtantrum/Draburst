import { describe, expect, it } from 'vitest';
import { ExplainRequest, renderUserMessage } from './explain';

describe('explain payload schema', () => {
  const ok = { tool: 'monte-carlo', inputs: { asset: 'BTC', horizon: 365 }, metrics: { median: 61234.5, 'P(S_T > target)': 0.24 } };
  it('accepts compact scalar payloads', () => {
    expect(ExplainRequest.safeParse(ok).success).toBe(true);
    expect(renderUserMessage(ExplainRequest.parse(ok))).toContain('"median":61234.5');
  });
  it('rejects arrays (no raw price series can be sent)', () => {
    expect(ExplainRequest.safeParse({ ...ok, metrics: { closes: [1, 2, 3] } }).success).toBe(false);
  });
  it('rejects oversized payloads and unknown tools', () => {
    const big = Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${i}`, i]));
    expect(ExplainRequest.safeParse({ ...ok, metrics: big }).success).toBe(false);
    expect(ExplainRequest.safeParse({ ...ok, inputs: { note: 'x'.repeat(121) } }).success).toBe(false);
    expect(ExplainRequest.safeParse({ ...ok, tool: 'shell' }).success).toBe(false);
  });
});

import { sanitizePayload } from '@/components/tool/ExplainButton';
describe('client payload sanitizing', () => {
  it('turns NaN/Infinity into null and passes the server schema', () => {
    const p = sanitizePayload({ inputs: { a: 1.23456789 }, metrics: { sharpe: NaN, pf: Infinity, x: 'ok' } });
    expect(p.metrics).toEqual({ sharpe: null, pf: null, x: 'ok' });
    expect(p.inputs.a).toBe(1.23457);
    expect(ExplainRequest.safeParse({ tool: 'backtest', ...p }).success).toBe(true);
  });
});
