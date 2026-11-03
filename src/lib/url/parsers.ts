import { createParser } from 'nuqs';

/** Per-key numbers in the URL: "crypto:BTC=0.1;stock:SPY=0.25" */
export const parseAsNumMap = createParser<Record<string, number>>({
  parse: (s) => {
    const out: Record<string, number> = {};
    for (const part of s.split(';')) {
      const [k, v] = part.split('=');
      const n = Number(v);
      if (k && Number.isFinite(n)) out[k] = n;
    }
    return out;
  },
  serialize: (m) =>
    Object.entries(m)
      .map(([k, v]) => `${k}=${Number(v.toFixed(4))}`)
      .join(';'),
  eq: (a, b) => JSON.stringify(a) === JSON.stringify(b),
});
