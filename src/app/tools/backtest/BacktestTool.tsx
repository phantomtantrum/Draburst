'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { parseAsFloat, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { ToolShell, Panel } from '@/components/tool/ToolShell';
import { AssetPicker } from '@/components/tool/AssetPicker';
import { SourceBadge } from '@/components/tool/SourceBadge';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { NumberField } from '@/components/ui/NumberField';
import { Toggle } from '@/components/ui/Toggle';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { Delta } from '@/components/ui/Delta';
import { StatusChip } from '@/components/ui/StatusChip';
import { EquityChart } from '@/components/charts/EquityChart';
import { MonthlyHeatmap } from '@/components/charts/MonthlyHeatmap';
import { SweepHeatmap } from '@/components/charts/SweepHeatmap';
import { fetchBars, MarketClientError } from '@/lib/market/client';
import { alignSeries } from '@/lib/market/align';
import type { BarsResponse, BarSeries } from '@/lib/market/types';
import type { Bar, BacktestMetrics, BacktestParams, BacktestResult } from '@/lib/quant/backtest';
import { PRESETS, PRESET_BY_KIND, paramDefaults, type PresetKind } from '@/lib/quant/strategies';
import { periodsPerYear } from '@/lib/quant/returns';
import { useWorkerTask, latest } from '@/lib/hooks/useWorkerTask';
import { useMultiBars } from '@/lib/hooks/useMultiBars';
import { useStageMode } from '@/lib/hooks/useMedia';
import { parseAsNumMap } from '@/lib/url/parsers';
import { ToolActions } from '@/components/tool/ToolActions';
import type { BacktestWorkerApi, SweepRequest, SweepResult } from '@/workers/backtest.worker';
import { fmtDate, fmtInt, fmtNum, fmtPct, fmtPrice } from '@/lib/format';
import { ErrorState, StagePlaceholder } from '../monte-carlo/MonteCarloTool';

const BacktestStage = dynamic(() => import('./BacktestStage'), { ssr: false, loading: () => <StagePlaceholder text="LOADING 3D STAGE…" /> });

const KINDS = PRESETS.map((p) => p.kind) as [PresetKind, ...PresetKind[]];

export const btSearchParams = {
  a: parseAsString.withDefault('crypto:BTC'),
  lb: parseAsInteger.withDefault(5),
  st: parseAsStringLiteral(KINDS).withDefault('ma'),
  ma: parseAsStringLiteral(['sma', 'ema'] as const).withDefault('sma'),
  p: parseAsNumMap.withDefault({}),
  pw: parseAsNumMap.withDefault({ 'crypto:BTC': 0.6, 'crypto:ETH': 0.4 }),
  c: parseAsFloat.withDefault(10),
  sl: parseAsFloat.withDefault(5),
  sz: parseAsStringLiteral(['pct', 'vt'] as const).withDefault('pct'),
  fr: parseAsFloat.withDefault(1),
  vt: parseAsFloat.withDefault(0.3),
  vl: parseAsInteger.withDefault(20),
  lev: parseAsFloat.withDefault(1),
  stop: parseAsFloat,
  rf: parseAsFloat.withDefault(0.04),
  v: parseAsStringLiteral(['ribbon', 'sweep'] as const).withDefault('ribbon'),
  gn: parseAsInteger.withDefault(16),
};

const toBars = (s: BarSeries): Bar[] => s.t.map((t, i) => ({ t, o: s.o[i]!, h: s.h[i]!, l: s.l[i]!, c: s.c[i]!, v: s.v[i]! }));

type Loaded = { status: 'loading' } | { status: 'error'; code: string; message: string; retryAfter?: number } | { status: 'ok'; data: BarsResponse };

export function BacktestTool({ methodology }: { methodology: ReactNode }) {
  const [q, setQ] = useQueryStates(btSearchParams, { history: 'replace', throttleMs: 250 });
  const mode = useStageMode();
  const preset = PRESET_BY_KIND[q.st];
  const isRebal = q.st === 'rebal';
  const params = useMemo(() => ({ ...paramDefaults(q.st), ...q.p }), [q.st, q.p]);
  const [reload, setReload] = useState(0);

  // ── data: single asset ──
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  useEffect(() => {
    if (isRebal) return;
    let alive = true;
    setLoaded({ status: 'loading' }); // eslint-disable-line react-hooks/set-state-in-effect
    fetchBars(q.a, Math.min(15, Math.max(1, q.lb)))
      .then((data) => alive && setLoaded({ status: 'ok', data }))
      .catch((e: unknown) => {
        if (!alive) return;
        const err = e instanceof MarketClientError ? e : new MarketClientError('UPSTREAM', 'Failed to load data');
        setLoaded({ status: 'error', code: err.code, message: err.message, retryAfter: err.retryAfter });
      });
    return () => {
      alive = false;
    };
  }, [q.a, q.lb, isRebal, reload]);

  // ── data: portfolio ──
  const pwIds = useMemo(() => Object.keys(q.pw).filter((k) => (q.pw[k] ?? 0) > 0), [q.pw]);
  const multi = useMultiBars(isRebal ? pwIds : [], Math.min(15, Math.max(1, q.lb)), reload);

  const single = useMemo(() => (!isRebal && loaded.status === 'ok' ? { bars: toBars(loaded.data.bars), ppy: periodsPerYear(loaded.data.asset.cls) } : null), [loaded, isRebal]);
  const portfolio = useMemo(() => {
    if (!isRebal || multi.loading || multi.ok.length === 0) return null;
    const order = pwIds.map((id) => multi.ok.find((b) => b.asset.id === id)).filter((b): b is BarsResponse => !!b);
    const a = alignSeries(order.map((b) => b.bars));
    const barsByAsset = order.map((_, k) => a.t.map((t, i): Bar => ({ t, o: a.open[k]![i]!, h: a.high[k]![i]!, l: a.low[k]![i]!, c: a.close[k]![i]! })));
    const w = order.map((b) => q.pw[b.asset.id]!);
    const s = w.reduce((x, y) => x + y, 0);
    return { order, barsByAsset, weights: w.map((x) => x / s), ppy: periodsPerYear(order.map((b) => b.asset.cls)), t: a.t };
  }, [isRebal, multi, pwIds, q.pw]);

  const ppy = single?.ppy ?? portfolio?.ppy ?? 365;
  const base: BacktestParams | null = useMemo(() => {
    const strategy = preset.build(params, q.ma) ?? { kind: 'buyhold' as const };
    return {
      strategy,
      commissionBps: Math.max(0, q.c),
      slippageBps: Math.max(0, q.sl),
      sizing: q.sz === 'pct' ? { mode: 'percent', fraction: Math.min(1, Math.max(0.01, q.fr)) } : { mode: 'voltarget', target: q.vt, lookback: q.vl, maxLeverage: Math.max(0.1, q.lev) },
      stopLoss: q.stop != null && q.stop > 0 ? q.stop : null,
      initialCapital: 10_000,
      ppy,
      rf: q.rf,
    };
  }, [preset, params, q.ma, q.c, q.sl, q.sz, q.fr, q.vt, q.vl, q.lev, q.stop, q.rf, ppy]);
  const invalid = !isRebal && preset.build(params, q.ma) == null ? 'Invalid parameters (e.g. fast MA must be shorter than slow MA; RSI enter < exit).' : null;

  // ── run ──
  const bt = useWorkerTask<BacktestWorkerApi, { kind: 'single'; bars: Bar[]; p: BacktestParams } | { kind: 'pf'; bars: Bar[][]; w: number[]; p: BacktestParams }, BacktestResult>(
    () => new Worker(new URL('../../../workers/backtest.worker.ts', import.meta.url), { type: 'module', name: 'backtest' }),
    (api, arg) => (arg.kind === 'single' ? api.single(arg.bars, arg.p) : api.portfolio(arg.bars, arg.w, arg.p)),
  );
  const sw = useWorkerTask<BacktestWorkerApi, SweepRequest, SweepResult>(
    () => new Worker(new URL('../../../workers/backtest.worker.ts', import.meta.url), { type: 'module', name: 'sweep' }),
    (api, arg) => api.sweep(arg),
  );
  const runBt = bt.run,
    runSw = sw.run;
  useEffect(() => {
    if (!base || invalid) return;
    const h = window.setTimeout(() => {
      if (single) runBt({ kind: 'single', bars: single.bars, p: base });
      else if (portfolio) runBt({ kind: 'pf', bars: portfolio.barsByAsset, w: portfolio.weights, p: base });
    }, 200);
    return () => window.clearTimeout(h);
  }, [base, single, portfolio, invalid, runBt]);

  // sweep depends on everything except the two swept parameters
  const sweepAxes = preset.sweep;
  const sweepKey = sweepAxes ? JSON.stringify({ ...params, [sweepAxes.x]: 0, [sweepAxes.y]: 0, base: { ...base, strategy: null }, gn: q.gn, ma: q.ma }) : '';
  useEffect(() => {
    if (q.v !== 'sweep' || !single || !base || !sweepAxes) return;
    const h = window.setTimeout(() => runSw({ bars: single.bars, base, kind: q.st, ma: q.ma, params, n: Math.min(40, Math.max(4, q.gn)) }), 300);
    return () => window.clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when non-swept inputs change
  }, [q.v, single, sweepKey, runSw]);

  const result = latest(bt.state);
  const sweepRes = latest(sw.state);
  const t = single ? single.bars.map((b) => b.t) : (portfolio?.t ?? []);
  const resultFresh = result && result.equity.length === t.length ? result : null;
  const sweepFresh = sweepRes && sweepAxes && sweepRes.xKey === sweepAxes.x ? sweepRes : null;

  const fmtParam = (key: string) => {
    const d = preset.params.find((x) => x.key === key);
    return (v: number) => (d?.pct ? fmtPct(v, 0) : fmtNum(v, d?.int ? 0 : 1));
  };
  const labelOf = (key: string) => preset.params.find((x) => x.key === key)?.label.toUpperCase() ?? key;
  const current = sweepAxes ? { x: params[sweepAxes.x]!, y: params[sweepAxes.y]! } : null;
  const pick = (x: number, y: number) => sweepAxes && setQ({ p: { ...q.p, [sweepAxes.x]: x, [sweepAxes.y]: y } });

  // ── controls ──
  const controls = (
    <>
      <Select label="Strategy" value={q.st} options={PRESETS.map((p) => ({ value: p.kind, label: p.label }))} onChange={(v) => setQ({ st: v, p: {}, v: PRESET_BY_KIND[v].sweep ? q.v : 'ribbon' })} help={preset.blurb} />
      {isRebal ? (
        <PortfolioWeights weights={q.pw} onChange={(pw) => setQ({ pw })} />
      ) : (
        <AssetPicker value={q.a} onChange={(a) => setQ({ a: a.id })} />
      )}
      <Segmented label="History (years)" value={String(q.lb)} options={[1, 2, 3, 5, 10].map((y) => ({ value: String(y), label: `${y}Y` }))} onChange={(v) => setQ({ lb: Number(v) })} />
      {q.st === 'ma' && (
        <Segmented
          label="Average"
          value={q.ma}
          options={[
            { value: 'sma', label: 'SMA' },
            { value: 'ema', label: 'EMA' },
          ]}
          onChange={(v) => setQ({ ma: v })}
        />
      )}
      {preset.params.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {preset.params.map((d) => (
            <NumberField
              key={d.key}
              label={d.label}
              value={d.pct ? Number((params[d.key]! * 100).toFixed(2)) : params[d.key]!}
              suffix={d.pct ? '%' : undefined}
              min={d.pct ? d.min * 100 : d.min}
              max={d.pct ? d.max * 100 : d.max}
              step={d.pct ? d.step * 100 : d.step}
              onChange={(v) => setQ({ p: { ...q.p, [d.key]: d.pct ? v / 100 : d.int ? Math.round(v) : v } })}
            />
          ))}
        </div>
      )}
      {invalid && (
        <p role="alert" className="text-[13px] text-fg">
          <span className="num mr-1">!</span>
          {invalid}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Commission" value={q.c} suffix="bps" min={0} max={200} step={1} onChange={(v) => setQ({ c: v })} />
        <NumberField label="Slippage" value={q.sl} suffix="bps" min={0} max={200} step={1} onChange={(v) => setQ({ sl: v })} />
      </div>
      {!isRebal && (
        <>
          <Segmented
            label="Position sizing"
            value={q.sz}
            options={[
              { value: 'pct', label: '% of equity' },
              { value: 'vt', label: 'Vol target' },
            ]}
            onChange={(v) => setQ({ sz: v })}
          />
          {q.sz === 'pct' ? (
            <NumberField label="Fraction of equity" value={Number((q.fr * 100).toFixed(1))} suffix="%" min={1} max={100} step={5} onChange={(v) => setQ({ fr: v / 100 })} />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              <NumberField label="Target σ" value={Number((q.vt * 100).toFixed(1))} suffix="%" min={1} max={200} step={1} onChange={(v) => setQ({ vt: v / 100 })} />
              <NumberField label="Window" value={q.vl} min={5} max={250} step={1} onChange={(v) => setQ({ vl: Math.round(v) })} />
              <NumberField label="Max lev." value={q.lev} min={0.1} max={3} step={0.1} onChange={(v) => setQ({ lev: v })} />
            </div>
          )}
          <div className="flex items-end gap-3">
            <Toggle label="Stop-loss" checked={q.stop != null} onChange={(on) => setQ({ stop: on ? 0.1 : null })} />
            {q.stop != null && <NumberField className="flex-1" label="Stop below entry" value={Number((q.stop * 100).toFixed(1))} suffix="%" min={0.5} max={90} step={0.5} onChange={(v) => setQ({ stop: v / 100 })} />}
          </div>
        </>
      )}
      <NumberField label="Risk-free (Sharpe)" value={Number((q.rf * 100).toFixed(2))} suffix="%" min={-5} max={20} step={0.25} onChange={(v) => setQ({ rf: v / 100 })} />
      <p className="label border border-rule px-2 py-2 text-fg">SIGNAL @ CLOSE(t) → FILL @ OPEN(t+1)</p>
    </>
  );

  // ── stage ──
  const loading = isRebal ? multi.loading : loaded.status === 'loading';
  const stage =
    !isRebal && loaded.status === 'error' ? (
      <ErrorState code={loaded.code} message={loaded.message} retryAfter={loaded.retryAfter} onRetry={() => setReload((r) => r + 1)} />
    ) : isRebal && !multi.loading && multi.ok.length === 0 ? (
      <ErrorState code={multi.failed[0]?.code ?? 'NOT_FOUND'} message={multi.failed.map((f) => `${f.id}: ${f.message}`).join(' · ') || 'Add at least one asset with a positive weight.'} onRetry={() => setReload((r) => r + 1)} />
    ) : loading ? (
      <StagePlaceholder text="LOADING DAILY BARS…" />
    ) : invalid ? (
      <StagePlaceholder text="FIX STRATEGY PARAMETERS" />
    ) : mode === 'none' ? (
      <StagePlaceholder text="WEBGL UNAVAILABLE — SHOWING 2D CHARTS BELOW" />
    ) : mode == null || (!resultFresh && q.v === 'ribbon') ? (
      <StagePlaceholder text={bt.state.status === 'error' ? `! ${bt.state.message}` : 'BACKTESTING…'} />
    ) : (
      <div>
        {sweepAxes && single && (
          <div className="mb-2 flex justify-end">
            <Segmented
              label="3D view"
              hideLabel
              value={q.v}
              onChange={(v) => setQ({ v })}
              options={[
                { value: 'ribbon', label: 'Equity ribbon' },
                { value: 'sweep', label: `Sweep ${labelOf(sweepAxes.x)} × ${labelOf(sweepAxes.y)}` },
              ]}
            />
          </div>
        )}
        {q.v === 'sweep' && !sweepFresh ? (
          <StagePlaceholder text={sw.state.status === 'error' ? `! ${sw.state.message}` : `SWEEPING ${q.gn}×${q.gn} PARAMETER GRID…`} />
        ) : (
          <BacktestStage
            mode={mode}
            view={q.v}
            result={resultFresh}
            sweep={sweepFresh}
            current={current}
            onPick={pick}
            xLabel={sweepAxes ? labelOf(sweepAxes.x) : ''}
            yLabel={sweepAxes ? labelOf(sweepAxes.y) : ''}
            fmtX={sweepAxes ? fmtParam(sweepAxes.x) : String}
            fmtY={sweepAxes ? fmtParam(sweepAxes.y) : String}
          />
        )}
      </div>
    );

  const meta =
    !isRebal && loaded.status === 'ok' ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label num text-muted">
          <span className="text-fg">{loaded.data.asset.symbol}</span> · {fmtDate(loaded.data.bars.t[0]!)} → {fmtDate(loaded.data.bars.t.at(-1)!)} · {fmtInt(loaded.data.bars.t.length)} BARS · BASIS {ppy} ·{' '}
          {preset.label.toUpperCase()}
        </span>
        <span className="flex items-center gap-3">
          {bt.state.status === 'running' && <StatusChip status="loading" detail="RUNNING" />}
          <SourceBadge source={loaded.data.source} asOf={loaded.data.asOf} />
        </span>
      </div>
    ) : portfolio ? (
      <span className="label num text-muted">
        PORTFOLIO {portfolio.order.map((b, i) => `${b.asset.symbol} ${fmtPct(portfolio.weights[i], 0)}`).join(' · ')} · {fmtInt(portfolio.t.length)} ALIGNED BARS · MONTHLY REBALANCE · BENCH = DRIFTING WEIGHTS
      </span>
    ) : null;

  return (
    <ToolShell
      index="03"
      title="Backtest"
      subtitle="Parameterized strategies with no look-ahead: decisions on the close, fills on the next open, real costs. Sweep two parameters to see how fragile the edge is."
      meta={meta}
      controls={controls}
      stage={stage}
      methodology={methodology}
      methodologyTitle="Methodology — Backtester"
      actions={
        <ToolActions
          tool="backtest"
          defaultName={`${isRebal ? 'Portfolio' : q.a.split(':')[1]} · ${preset.label}`}
          seed={null}
          summary={
            resultFresh
              ? {
                  asset: isRebal ? pwIds.map((id) => id.split(':')[1]).join(',') : (q.a.split(':')[1] ?? ''),
                  strategy: preset.label,
                  cagr: Number(resultFresh.metrics.cagr.toFixed(4)),
                  sharpe: Number(resultFresh.metrics.sharpe.toFixed(3)),
                  mdd: Number(resultFresh.metrics.maxDrawdown.toFixed(4)),
                  trades: resultFresh.metrics.trades,
                }
              : null
          }
        />
      }
    >
      {resultFresh && (
        <>
          <div aria-live="polite" className="sr-only">
            {`Backtest complete. CAGR ${fmtPct(resultFresh.metrics.cagr, 1)}, Sharpe ${fmtNum(resultFresh.metrics.sharpe, 2)}, max drawdown ${fmtPct(resultFresh.metrics.maxDrawdown, 1)}.`}
          </div>
          <Panel index="A" title="Equity vs benchmark" aside={<span className="label text-muted">START 10,000 · {isRebal ? 'BENCH: DRIFT' : 'BENCH: BUY & HOLD'}</span>}>
            <EquityChart t={t} equity={resultFresh.equity} benchmark={resultFresh.benchmark} drawdown={resultFresh.drawdown} trades={resultFresh.trades} />
          </Panel>
          <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Panel index="B" title="Metrics">
              <MetricsTable s={resultFresh.metrics} b={resultFresh.benchmarkMetrics} ppy={ppy} />
            </Panel>
            <Panel index="C" title="Monthly returns">
              <MonthlyHeatmap monthly={resultFresh.monthly} />
            </Panel>
          </div>
          {sweepAxes && single && (
            <Panel
              index="D"
              title={`Parameter sweep — Sharpe`}
              aside={
                <span className="flex items-center gap-3">
                  <span className="label text-muted">IN-SAMPLE · BEST CELL IS OPTIMISTIC</span>
                  {q.v !== 'sweep' && !sweepFresh && (
                    <Button variant="secondary" size="sm" onClick={() => setQ({ v: 'sweep' })}>
                      Run sweep
                    </Button>
                  )}
                </span>
              }
            >
              {sweepFresh ? (
                <SweepHeatmap
                  xs={sweepFresh.xs}
                  ys={sweepFresh.ys}
                  values={sweepFresh.sharpe}
                  xLabel={labelOf(sweepAxes.x)}
                  yLabel={labelOf(sweepAxes.y)}
                  current={current}
                  onPick={pick}
                  fmtX={fmtParam(sweepAxes.x)}
                  fmtY={fmtParam(sweepAxes.y)}
                />
              ) : (
                <p className="text-[14px] text-muted">{sw.state.status === 'running' ? 'Sweeping…' : `Re-runs the backtest over a ${q.gn}×${q.gn} grid of ${labelOf(sweepAxes.x)} × ${labelOf(sweepAxes.y)}.`}</p>
              )}
              <div className="mt-3 max-w-xs">
                <Segmented label="Grid" value={String(q.gn)} options={[8, 16, 24, 32].map((n) => ({ value: String(n), label: `${n}²` }))} onChange={(v) => setQ({ gn: Number(v) })} />
              </div>
            </Panel>
          )}
          {!isRebal && (
            <Panel index={sweepAxes ? 'E' : 'D'} title={`Trades (${resultFresh.trades.length})`}>
              <DataTable
                caption="Trade list"
                dense
                maxHeight={420}
                rowKey={(r) => String(r.i)}
                rows={resultFresh.trades.map((tr, i) => ({ ...tr, i }))}
                columns={[
                  { key: 'n', header: '#', cell: (r) => <span className="num">{r.i + 1}</span> },
                  { key: 'side', header: 'Side', cell: () => <span className="label text-fg">LONG</span> },
                  { key: 'ed', header: 'Entry', align: 'right', cell: (r) => fmtDate(r.entryTime) },
                  { key: 'ep', header: 'Entry px', align: 'right', cell: (r) => fmtPrice(r.entryPrice) },
                  { key: 'xd', header: 'Exit', align: 'right', cell: (r) => fmtDate(r.exitTime) },
                  { key: 'xp', header: 'Exit px', align: 'right', cell: (r) => fmtPrice(r.exitPrice) },
                  { key: 'bars', header: 'Bars', align: 'right', cell: (r) => fmtInt(r.barsHeld) },
                  { key: 'ret', header: 'Return', align: 'right', cell: (r) => <Delta value={r.ret} /> },
                  { key: 'pnl', header: 'P&L', align: 'right', cell: (r) => <Delta value={r.pnl} kind="num" /> },
                  { key: 'why', header: 'Exit reason', align: 'right', cell: (r) => <span className="label">{r.reason.toUpperCase()}</span> },
                ]}
              />
            </Panel>
          )}
        </>
      )}
    </ToolShell>
  );
}

function MetricsTable({ s, b, ppy }: { s: BacktestMetrics; b: BacktestMetrics; ppy: number }) {
  const rows: Array<[string, (m: BacktestMetrics) => ReactNode]> = [
    ['Total return', (m) => <Delta value={m.totalReturn} glyph={false} />],
    ['CAGR', (m) => <Delta value={m.cagr} glyph={false} />],
    ['Volatility (ann.)', (m) => fmtPct(m.vol, 1)],
    ['Sharpe', (m) => fmtNum(m.sharpe, 2)],
    ['Sortino', (m) => fmtNum(m.sortino, 2)],
    ['Max drawdown', (m) => fmtPct(-m.maxDrawdown, 1)],
    ['MDD duration', (m) => `${fmtInt(m.maxDrawdownBars)} bars · ${fmtNum(m.maxDrawdownBars / ppy, 1)}y`],
    ['Calmar', (m) => fmtNum(m.calmar, 2)],
    ['VaR 95 (daily, hist.)', (m) => fmtPct(m.var95, 2)],
    ['CVaR 95 (daily, hist.)', (m) => fmtPct(m.cvar95, 2)],
    ['VaR / CVaR 95 (Gaussian)', (m) => `${fmtPct(m.pVar95, 2)} / ${fmtPct(m.pCvar95, 2)}`],
    ['Beta vs benchmark', (m) => fmtNum(m.beta, 2)],
    ['Time in market', (m) => fmtPct(m.exposure, 0)],
    ['Trades', (m) => fmtInt(m.trades)],
    ['Win rate', (m) => fmtPct(m.winRate, 0)],
    ['Avg win / loss', (m) => `${fmtPct(m.avgWin, 1)} / ${fmtPct(m.avgLoss, 1)}`],
    ['Profit factor', (m) => (m.profitFactor === Infinity ? '∞' : fmtNum(m.profitFactor, 2))],
    ['Costs paid', (m) => fmtPrice(m.costs)],
  ];
  return (
    <DataTable
      caption="Strategy and benchmark metrics"
      dense
      rowKey={(r) => r[0]}
      rows={rows}
      columns={[
        { key: 'k', header: 'Metric', cell: (r) => <span className="text-[13px] text-body">{r[0]}</span> },
        { key: 's', header: 'Strategy', align: 'right', cell: (r) => r[1](s) },
        { key: 'b', header: 'Benchmark', align: 'right', className: 'text-muted', cell: (r) => r[1](b) },
      ]}
    />
  );
}

function PortfolioWeights({ weights, onChange }: { weights: Record<string, number>; onChange: (w: Record<string, number>) => void }) {
  const [adding, setAdding] = useState(false);
  const ids = Object.keys(weights);
  const sum = ids.reduce((a, k) => a + (weights[k] ?? 0), 0);
  return (
    <div className="flex flex-col gap-2">
      <p className="label flex justify-between text-muted">
        <span>Portfolio weights</span>
        <span className="num">Σ {fmtPct(sum, 0)} → NORMALIZED</span>
      </p>
      {ids.map((id) => (
        <div key={id} className="flex items-end gap-2">
          <span className="num w-16 pb-2 text-[13px] text-fg">{id.split(':')[1]}</span>
          <NumberField className="flex-1" label={`${id.split(':')[1]} weight`} value={Number(((weights[id] ?? 0) * 100).toFixed(1))} suffix="%" min={0} max={100} step={5} onChange={(v) => onChange({ ...weights, [id]: v / 100 })} />
          <Button variant="ghost" size="sm" onClick={() => onChange(Object.fromEntries(Object.entries(weights).filter(([k]) => k !== id)))} disabled={ids.length <= 1} aria-label={`Remove ${id}`}>
            ×
          </Button>
        </div>
      ))}
      <Button variant="ghost" size="sm" className="justify-start border-dashed border-rule-strong" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
        + Add asset
      </Button>
      {adding && (
        <AssetPicker
          label="Add to portfolio"
          value={null}
          exclude={ids}
          onChange={(a) => {
            onChange({ ...weights, [a.id]: 0.1 });
            setAdding(false);
          }}
        />
      )}
      <p className="text-[12px] text-muted">
        Tip: open a portfolio in the <Link className="underline" href="/tools/portfolio">optimizer</Link> and use “Backtest these weights”.
      </p>
    </div>
  );
}
