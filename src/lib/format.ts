/** Number formatting — en-US, tabular, true minus sign (U+2212). MASTER §3. */
export const MINUS = '−';

const cache = new Map<string, Intl.NumberFormat>();
function nf(min: number, max: number, extra?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${min}|${max}|${JSON.stringify(extra ?? {})}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', { minimumFractionDigits: min, maximumFractionDigits: max, ...extra });
    cache.set(key, f);
  }
  return f;
}

const fixMinus = (s: string) => s.replace(/-/g, MINUS);

export function fmtNum(x: number | null | undefined, digits = 2): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = nf(digits, digits).format(x);
  // never print a signed zero ("−0.0")
  return /^-0(\.0+)?$/.test(s) ? s.slice(1) : fixMinus(s);
}

/** Signed number: +1.24 / −1.24 / 0.00 */
export function fmtSigned(x: number | null | undefined, digits = 2): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const s = nf(digits, digits).format(Math.abs(x));
  if (Number(s.replace(/,/g, '')) === 0) return s;
  return (x > 0 ? '+' : MINUS) + s;
}

/** Fraction → percent string. 0.0124 → "1.24%" */
export function fmtPct(x: number | null | undefined, digits = 2, signed = false): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return (signed ? fmtSigned(x * 100, digits) : fmtNum(x * 100, digits)) + '%';
}

export function fmtPrice(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—';
  const a = Math.abs(x);
  const d = a >= 1000 ? 2 : a >= 1 ? 2 : a >= 0.01 ? 4 : 6;
  return fmtNum(x, d);
}

export function fmtCompact(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return fixMinus(nf(0, 2, { notation: 'compact' }).format(x));
}

export function fmtInt(x: number | null | undefined): string {
  if (x == null || !Number.isFinite(x)) return '—';
  return fixMinus(nf(0, 0).format(Math.round(x)));
}

export function fmtDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function fmtSeed(seed: number): string {
  return '0x' + (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export type Sign = 'pos' | 'neg' | 'zero';
export function signOf(x: number, eps = 1e-12): Sign {
  return x > eps ? 'pos' : x < -eps ? 'neg' : 'zero';
}
