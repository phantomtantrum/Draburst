import type { StrategySpec } from './backtest';

/**
 * Strategy presets — parameterized, never user code. Each preset declares its
 * parameters (for controls + URL) and two sweep axes for the Sharpe surface.
 */
export type PresetKind = 'bh' | 'ma' | 'mom' | 'rsi' | 'bb' | 'rebal';

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  def: number;
  /** display as percent */
  pct?: boolean;
  int?: boolean;
}

export interface Preset {
  kind: PresetKind;
  label: string;
  blurb: string;
  params: ParamDef[];
  sweep?: { x: string; y: string };
  build: (p: Record<string, number>, ma: 'sma' | 'ema') => StrategySpec | null;
}

export const PRESETS: Preset[] = [
  {
    kind: 'bh',
    label: 'Buy & hold',
    blurb: 'Benchmark: buy at the first open, hold to the end.',
    params: [],
    build: () => ({ kind: 'buyhold' }),
  },
  {
    kind: 'ma',
    label: 'MA crossover',
    blurb: 'Long while the fast moving average is above the slow one; flat otherwise.',
    params: [
      { key: 'f', label: 'Fast MA', min: 2, max: 100, step: 1, def: 20, int: true },
      { key: 's', label: 'Slow MA', min: 5, max: 300, step: 1, def: 100, int: true },
    ],
    sweep: { x: 'f', y: 's' },
    build: (p, ma) => (p.f! < p.s! ? { kind: 'macross', fast: p.f!, slow: p.s!, ma } : null),
  },
  {
    kind: 'mom',
    label: 'Time-series momentum',
    blurb: 'Long while the trailing return over the lookback exceeds the threshold.',
    params: [
      { key: 'L', label: 'Lookback', min: 5, max: 365, step: 1, def: 90, int: true },
      { key: 'th', label: 'Threshold', min: -0.2, max: 0.5, step: 0.01, def: 0, pct: true },
    ],
    sweep: { x: 'L', y: 'th' },
    build: (p) => ({ kind: 'momentum', lookback: p.L!, threshold: p.th! }),
  },
  {
    kind: 'rsi',
    label: 'RSI mean reversion',
    blurb: 'Buy when RSI drops below the lower band; exit when it rises above the upper band.',
    params: [
      { key: 'rp', label: 'RSI period', min: 2, max: 50, step: 1, def: 14, int: true },
      { key: 'rl', label: 'Enter below', min: 5, max: 50, step: 1, def: 30, int: true },
      { key: 'ru', label: 'Exit above', min: 40, max: 95, step: 1, def: 55, int: true },
    ],
    sweep: { x: 'rl', y: 'ru' },
    build: (p) => (p.rl! < p.ru! ? { kind: 'rsi', period: p.rp!, lower: p.rl!, upper: p.ru! } : null),
  },
  {
    kind: 'bb',
    label: 'Bollinger breakout',
    blurb: 'Enter when the close breaks above the upper band; exit below the middle band.',
    params: [
      { key: 'bp', label: 'Period', min: 5, max: 100, step: 1, def: 20, int: true },
      { key: 'bk', label: 'Band width k', min: 0.5, max: 4, step: 0.1, def: 2 },
    ],
    sweep: { x: 'bp', y: 'bk' },
    build: (p) => ({ kind: 'bollinger', period: p.bp!, k: p.bk! }),
  },
  {
    kind: 'rebal',
    label: 'Portfolio · monthly rebalance',
    blurb: 'Hold a fixed-weight portfolio (e.g. from the optimizer), rebalanced on the first open of each month.',
    params: [],
    build: () => null,
  },
];

export const PRESET_BY_KIND = Object.fromEntries(PRESETS.map((p) => [p.kind, p])) as Record<PresetKind, Preset>;

export function paramDefaults(kind: PresetKind): Record<string, number> {
  return Object.fromEntries(PRESET_BY_KIND[kind].params.map((p) => [p.key, p.def]));
}

/** Evenly spaced axis values snapped to the parameter's step. */
export function axisValues(def: ParamDef, n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const raw = def.min + ((def.max - def.min) * i) / Math.max(1, n - 1);
    const v = Number((Math.round(raw / def.step) * def.step).toFixed(6));
    if (!out.includes(v)) out.push(v);
  }
  return out;
}
