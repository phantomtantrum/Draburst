/**
 * Seedable PRNG — xoshiro128** (Blackman & Vigna) seeded via splitmix32.
 * 32-bit state ops only, so it is identical across JS engines and workers.
 * Results are reproducible from the seed shown in the UI.
 */
export interface Rng {
  /** uniform in [0, 1) with 32 bits of randomness */
  next(): number;
  /** uniform integer in [0, n) */
  int(n: number): number;
  /** standard normal N(0,1) — Marsaglia polar method with cached spare */
  normal(): number;
  readonly seed: number;
}

function splitmix32(a: number): () => number {
  return () => {
    a = (a + 0x9e3779b9) | 0;
    let z = a;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

export function createRng(seed: number): Rng {
  const s0 = seed >>> 0;
  const sm = splitmix32(s0);
  let a = sm(),
    b = sm(),
    c = sm(),
    d = sm();
  if ((a | b | c | d) === 0) a = 1;

  const nextU32 = (): number => {
    const r = Math.imul(rotl(Math.imul(b, 5), 7), 9);
    const t = b << 9;
    c ^= a;
    d ^= b;
    b ^= c;
    a ^= d;
    c ^= t;
    d = rotl(d, 11);
    return r >>> 0;
  };

  let spare: number | null = null;
  const rng: Rng = {
    seed: s0,
    next: () => nextU32() / 4294967296,
    int: (n: number) => Math.floor((nextU32() / 4294967296) * n),
    normal: () => {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      let u: number, v: number, s: number;
      do {
        u = 2 * (nextU32() / 4294967296) - 1;
        v = 2 * (nextU32() / 4294967296) - 1;
        s = u * u + v * v;
      } while (s >= 1 || s === 0);
      const m = Math.sqrt((-2 * Math.log(s)) / s);
      spare = v * m;
      return u * m;
    },
  };
  return rng;
}

function rotl(x: number, k: number): number {
  return (x << k) | (x >>> (32 - k));
}

/** Random 32-bit seed for the "randomize" button (not used inside simulations). */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0]!;
  }
  return (Math.random() * 4294967296) >>> 0;
}

export function parseSeed(s: string): number | null {
  const t = s.trim();
  const n = /^0x[0-9a-f]+$/i.test(t) ? parseInt(t.slice(2), 16) : /^\d+$/.test(t) ? Number(t) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 0xffffffff ? n >>> 0 : null;
}
