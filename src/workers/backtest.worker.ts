/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import { backtestRebalance, computeMetrics, monthlyReturns, runBacktest, sweep, type Bar, type BacktestParams, type BacktestResult } from '@/lib/quant/backtest';
import { drawdown } from '@/lib/quant/metrics';
import { simpleReturns } from '@/lib/quant/returns';
import { PRESET_BY_KIND, axisValues, type PresetKind } from '@/lib/quant/strategies';

export interface SweepRequest {
  bars: Bar[];
  base: BacktestParams;
  kind: PresetKind;
  ma: 'sma' | 'ema';
  params: Record<string, number>;
  n: number;
}
export interface SweepResult {
  xKey: string;
  yKey: string;
  xs: number[];
  ys: number[];
  sharpe: Float64Array;
  cagr: Float64Array;
  maxDrawdown: Float64Array;
}

const api = {
  single(bars: Bar[], p: BacktestParams): BacktestResult {
    return runBacktest(bars, p);
  },

  portfolio(barsByAsset: Bar[][], weights: number[], p: BacktestParams): BacktestResult {
    const cfg = { weights, commissionBps: p.commissionBps, slippageBps: p.slippageBps, initialCapital: p.initialCapital };
    const main = backtestRebalance(barsByAsset, cfg);
    const drift = backtestRebalance(barsByAsset, { ...cfg, mode: 'none' });
    const exposure = new Float64Array(main.equity.length).fill(1);
    exposure[0] = 0;
    const bench = simpleReturns(drift.equity);
    const times = barsByAsset[0]!.map((b) => b.t);
    return {
      equity: main.equity,
      exposure,
      drawdown: drawdown(main.equity).series,
      benchmark: drift.equity,
      benchmarkDrawdown: drawdown(drift.equity).series,
      trades: [],
      metrics: computeMetrics(main.equity, exposure, [], main.costs, p, bench),
      benchmarkMetrics: computeMetrics(drift.equity, exposure, [], drift.costs, p, bench),
      monthly: monthlyReturns(times, main.equity),
    };
  },

  sweep(req: SweepRequest): SweepResult {
    const preset = PRESET_BY_KIND[req.kind];
    if (!preset.sweep) throw new Error('This strategy has no sweep axes');
    const xd = preset.params.find((d) => d.key === preset.sweep!.x)!;
    const yd = preset.params.find((d) => d.key === preset.sweep!.y)!;
    const xs = axisValues(xd, req.n),
      ys = axisValues(yd, req.n);
    const r = sweep(req.bars, req.base, { key: xd.key, values: xs }, { key: yd.key, values: ys }, (xv, yv) =>
      preset.build({ ...req.params, [xd.key]: xv, [yd.key]: yv }, req.ma),
    );
    const out = { xKey: xd.key, yKey: yd.key, xs, ys, ...r };
    return Comlink.transfer(out, [out.sharpe.buffer, out.cagr.buffer, out.maxDrawdown.buffer] as ArrayBuffer[]);
  },
};

export type BacktestWorkerApi = typeof api;
Comlink.expose(api);
