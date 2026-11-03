'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { parseAsFloat, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { Shuffle, RotateCcw } from 'lucide-react';
import { ToolShell, Panel } from '@/components/tool/ToolShell';
import { AssetPicker } from '@/components/tool/AssetPicker';
import { SourceBadge } from '@/components/tool/SourceBadge';
import { FanChart } from '@/components/charts/FanChart';
import { Histogram } from '@/components/charts/Histogram';
import { NumberField } from '@/components/ui/NumberField';
import { Slider } from '@/components/ui/Slider';
import { Segmented } from '@/components/ui/Segmented';
import { Button, IconButton } from '@/components/ui/Button';
import { MetricList, DataTable } from '@/components/ui/DataTable';
import { StatusChip } from '@/components/ui/StatusChip';
import { TextInput } from '@/components/ui/Field';
import { ToolActions } from '@/components/tool/ToolActions';
import { Sym, ST, S0 } from '@/components/ui/Sym';
import { fetchBars, MarketClientError } from '@/lib/market/client';
import type { BarsResponse } from '@/lib/market/types';
import { estimateGbm } from '@/lib/quant/montecarlo';
import { logReturns, periodsPerYear } from '@/lib/quant/returns';
import { parseSeed, randomSeed } from '@/lib/quant/prng';
import { useMonteCarlo } from '@/lib/hooks/useMonteCarlo';
import { useStageMode } from '@/lib/hooks/useMedia';
import { fmtDate, fmtInt, fmtNum, fmtPct, fmtPrice, fmtSeed } from '@/lib/format';

const McStage = dynamic(() => import('./McStage'), {
  ssr: false,
  loading: () => <StagePlaceholder text="LOADING 3D STAGE…" />,
});

const MODELS = ['gbm', 'boot'] as const;
const LOOKBACKS = [1, 2, 3, 5, 10];

export const mcSearchParams = {
  a: parseAsString.withDefault('crypto:BTC'),
  lb: parseAsInteger.withDefault(3),
  h: parseAsInteger.withDefault(365),
  n: parseAsInteger.withDefault(10_000),
  m: parseAsStringLiteral(MODELS).withDefault('gbm'),
  mu: parseAsFloat,
  sg: parseAsFloat,
  b: parseAsInteger.withDefault(5),
  tg: parseAsFloat,
  sd: parseAsInteger.withDefault(0x5eed),
};

type Loaded = { status: 'loading' } | { status: 'error'; code: string; message: string; retryAfter?: number } | { status: 'ok'; data: BarsResponse };

export function MonteCarloTool({ methodology }: { methodology: ReactNode }) {
  const [q, setQ] = useQueryStates(mcSearchParams, { history: 'replace', throttleMs: 200 });
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  const { state, run } = useMonteCarlo();
  const mode = useStageMode();
  const [seedText, setSeedText] = useState(fmtSeed(q.sd));
  // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror URL seed into the text buffer
  useEffect(() => setSeedText(fmtSeed(q.sd)), [q.sd]);

  // ── data ──
  useEffect(() => {
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
  }, [q.a, q.lb, reloadKey]);

  const hist = useMemo(() => {
    if (loaded.status !== 'ok') return null;
    const c = loaded.data.bars.c;
    const ppy = periodsPerYear(loaded.data.asset.cls);
    const lr = logReturns(c);
    const est = estimateGbm(lr, ppy);
    return { s0: c[c.length - 1]!, lastT: loaded.data.bars.t[c.length - 1]!, lr, ppy, est, n: c.length };
  }, [loaded]);

  const mu = q.mu ?? hist?.est.mu ?? 0;
  const sigma = q.sg ?? hist?.est.sigma ?? 0.5;
  const target = q.tg ?? (hist ? Number((hist.s0 * 1.2).toPrecision(4)) : null);
  const horizon = Math.min(1095, Math.max(5, q.h));
  const nPaths = Math.min(50_000, Math.max(100, q.n));
  const block = Math.min(60, Math.max(1, q.b));

  // ── run (debounced, auto) ──
  useEffect(() => {
    if (!hist) return;
    const h = window.setTimeout(() => {
      run({
        s0: hist.s0,
        horizon,
        nPaths,
        model: q.m === 'gbm' ? 'gbm' : 'bootstrap',
        mu,
        sigma,
        ppy: hist.ppy,
        seed: q.sd >>> 0,
        history: hist.lr,
        blockSize: block,
        target: target ?? undefined,
        displayPaths: Math.min(2000, nPaths),
        batchSize: Math.max(500, Math.ceil(nPaths / 20)),
      });
    }, 300);
    return () => window.clearTimeout(h);
  }, [hist, horizon, nPaths, q.m, mu, sigma, q.sd, block, target, run]);

  const summary = state.status === 'done' ? state.summary : null;
  const display = state.status === 'done' || state.status === 'running' ? state.display : null;
  const progress = state.status === 'running' ? state.done / state.total : state.status === 'done' ? 1 : 0;
  const assetLabel = loaded.status === 'ok' ? loaded.data.asset.symbol : q.a.split(':')[1];

  // ── controls ──
  const controls = (
    <>
      <AssetPicker value={q.a} onChange={(a) => setQ({ a: a.id, mu: null, sg: null, tg: null, h: a.cls === 'crypto' ? 365 : 252 })} />
      <Segmented
        label="Lookback (years)"
        value={String(q.lb)}
        options={LOOKBACKS.map((y) => ({ value: String(y), label: `${y}Y` }))}
        onChange={(v) => setQ({ lb: Number(v), mu: null, sg: null })}
      />
      <Slider
        label={`Horizon (${hist?.ppy === 365 ? 'days' : 'trading days'})`}
        value={horizon}
        min={5}
        max={1095}
        step={1}
        log
        format={(v) => `${fmtInt(v)} · ${fmtNum(v / (hist?.ppy ?? 252), 2)}Y`}
        onChange={(v) => setQ({ h: v })}
      />
      <Slider label="Paths" value={nPaths} min={100} max={50_000} step={100} log format={fmtInt} onChange={(v) => setQ({ n: v })} help="More paths → smoother tails, more compute (runs in a worker)." />
      <Segmented
        label="Model"
        value={q.m}
        options={[
          { value: 'gbm', label: 'GBM' },
          { value: 'boot', label: 'Bootstrap' },
        ]}
        onChange={(v) => setQ({ m: v })}
      />
      {q.m === 'gbm' ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label={<>Drift <Sym>μ</Sym> {q.mu == null ? '≈ est.' : 'annual'}</>}
            value={Number((mu * 100).toFixed(2))}
            suffix="%"
            step={1}
            min={-200}
            max={500}
            onChange={(v) => setQ({ mu: v / 100 })}
          />
          <NumberField
            label={<>Vol <Sym>σ</Sym> {q.sg == null ? '≈ est.' : 'annual'}</>}
            value={Number((sigma * 100).toFixed(2))}
            suffix="%"
            step={1}
            min={0.1}
            max={500}
            onChange={(v) => setQ({ sg: v / 100 })}
          />
          {(q.mu != null || q.sg != null) && (
            <Button variant="ghost" size="sm" className="col-span-2 justify-start px-0" onClick={() => setQ({ mu: null, sg: null })}>
              <RotateCcw size={12} strokeWidth={1.5} aria-hidden /> Reset to estimates
            </Button>
          )}
        </div>
      ) : (
        <Slider label="Block length (bars)" value={block} min={1} max={60} step={1} format={(v) => String(v)} onChange={(v) => setQ({ b: v })} help="1 = i.i.d. resampling; longer blocks keep volatility clustering." />
      )}
      <NumberField label="Target price" value={target ?? 0} min={0} step={hist ? Number((hist.s0 * 0.01).toPrecision(2)) : 1} onChange={(v) => setQ({ tg: v })} help="Probability of ending above it is reported." />
      <div className="flex items-end gap-2">
        <TextInput
          className="flex-1"
          label="Seed"
          value={seedText}
          onChange={(v) => {
            setSeedText(v);
            const s = parseSeed(v);
            if (s != null) setQ({ sd: s });
          }}
          error={parseSeed(seedText) == null ? 'Hex (0x…) or integer < 2³²' : null}
        />
        <IconButton label="Randomize seed" onClick={() => setQ({ sd: randomSeed() })} className="mb-0.5 border-rule-strong">
          <Shuffle size={14} strokeWidth={1.5} aria-hidden />
        </IconButton>
      </div>
    </>
  );

  // ── stage ──
  const stage =
    loaded.status === 'error' ? (
      <ErrorState code={loaded.code} message={loaded.message} retryAfter={loaded.retryAfter} onRetry={() => setReloadKey((k) => k + 1)} />
    ) : !hist ? (
      <StagePlaceholder text={`LOADING ${assetLabel} DAILY BARS…`} />
    ) : mode === 'none' ? (
      <StagePlaceholder text="WEBGL UNAVAILABLE — SHOWING 2D CHARTS BELOW" />
    ) : mode == null ? (
      <StagePlaceholder text="" />
    ) : (
      <McStage
        mode={mode}
        display={display}
        summary={summary}
        s0={hist.s0}
        target={target}
        seed={q.sd}
        nPaths={nPaths}
        horizon={horizon}
        progress={progress}
        sourceLabel={loaded.status === 'ok' ? loaded.data.source.name.toUpperCase() : ''}
        approx={{ mu: q.m === 'gbm' ? mu : hist.est.mu, sigma: q.m === 'gbm' ? sigma : hist.est.sigma, years: horizon / hist.ppy }}
      />
    );

  const meta =
    loaded.status === 'ok' && hist ? (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label num text-muted">
          <span className="text-fg">{loaded.data.asset.symbol}</span> · {loaded.data.asset.name.toUpperCase()} · S₀ {fmtPrice(hist.s0)} @ {fmtDate(hist.lastT)} · {fmtInt(hist.n)} BARS ·
          BASIS {hist.ppy}
        </span>
        <span className="flex items-center gap-3">
          {state.status === 'running' && <StatusChip status="loading" detail={`${Math.round(progress * 100)}%`} />}
          {state.status === 'error' && <StatusChip status="error" detail={state.message} />}
          <SourceBadge source={loaded.data.source} asOf={loaded.data.asOf} />
        </span>
      </div>
    ) : null;

  return (
    <ToolShell
      index="01"
      title="Monte Carlo"
      subtitle="Thousands of possible futures from today's price. GBM with estimated drift and volatility, or a block bootstrap of the asset's own history."
      meta={meta}
      controls={controls}
      stage={stage}
      methodology={methodology}
      methodologyTitle="Methodology — Monte Carlo"
      actions={
        <ToolActions
          tool="monte-carlo"
          explain={
            summary && hist
              ? {
                  inputs: {
                    asset: assetLabel ?? '',
                    model: q.m === 'gbm' ? 'GBM' : `block bootstrap (b=${block})`,
                    lookback_years: q.lb,
                    history_bars: hist.n,
                    horizon_periods: horizon,
                    periods_per_year: hist.ppy,
                    paths: nPaths,
                    start_price: hist.s0,
                    mu_annual: q.m === 'gbm' ? mu : null,
                    sigma_annual: q.m === 'gbm' ? sigma : hist.est.sigma,
                    mu_user_edited: q.mu != null,
                    target_price: target,
                  },
                  metrics: {
                    median_terminal: summary.terminal.median,
                    mean_terminal: summary.terminal.mean,
                    p5_terminal: summary.terminal.p.p5 ?? null,
                    p95_terminal: summary.terminal.p.p95 ?? null,
                    prob_above_target: summary.terminal.probAboveTarget,
                    prob_below_start: summary.terminal.probBelowStart,
                    var95_horizon: summary.risk.var95,
                    cvar95_horizon: summary.risk.cvar95,
                    var99_horizon: summary.risk.var99,
                    cvar99_horizon: summary.risk.cvar99,
                    closed_form_median: summary.analytic?.median ?? null,
                  },
                }
              : null
          }
          defaultName={`${assetLabel} · ${q.m === 'gbm' ? 'GBM' : 'Bootstrap'} · T+${horizon}`}
          seed={q.sd}
          summary={
            summary && hist
              ? {
                  asset: assetLabel ?? '',
                  model: q.m,
                  paths: nPaths,
                  horizon,
                  median: Number(summary.terminal.median.toPrecision(6)),
                  p_above_target: Number((summary.terminal.probAboveTarget ?? 0).toFixed(4)),
                  var95: Number(summary.risk.var95.toFixed(4)),
                }
              : null
          }
        />
      }
    >
      <div aria-live="polite" className="sr-only">
        {summary && hist
          ? `Simulation complete: ${fmtInt(nPaths)} paths. Median terminal price ${fmtPrice(summary.terminal.median)}. Probability of ending above target ${fmtPct(
              summary.terminal.probAboveTarget,
              1,
            )}.`
          : ''}
      </div>
      {summary && hist && (
        <>
          <div className="grid gap-10 xl:grid-cols-2">
            <Panel index="A" title="Percentile fan" aside={<span className="label text-muted">LOG SCALE · T+{horizon}</span>}>
              <FanChart
                data={{
                  grid: summary.grid,
                  bands: summary.bands,
                  meanPath: summary.meanPath,
                  s0: hist.s0,
                  target,
                  paths: display?.paths,
                  pathCount: display?.count,
                }}
              />
            </Panel>
            <Panel index="B" title="Terminal distribution" aside={<span className="label text-muted">■ ≥ S₀ · ▨ &lt; S₀</span>}>
              <Histogram
                edges={summary.histogram.edges}
                counts={summary.histogram.counts}
                s0={hist.s0}
                target={target}
                markers={[
                  { value: summary.terminal.p.p5!, label: 'P5' },
                  { value: summary.terminal.median, label: 'P50' },
                  { value: summary.terminal.p.p95!, label: 'P95' },
                ]}
              />
            </Panel>
          </div>
          <Panel index="C" title="Metrics" aside={<span className="label text-muted">{q.m === 'gbm' ? 'GBM' : `BOOTSTRAP · b=${block}`} · {fmtInt(nPaths)} PATHS · {fmtNum(summary.elapsedMs, 0)} MS</span>}>
            <MetricList
              columns={4}
              items={[
                { id: 'med', label: <>Median <ST /></>, value: fmtPrice(summary.terminal.median) },
                { id: 'mean', label: <>Mean <ST /></>, value: fmtPrice(summary.terminal.mean) },
                { id: 'p5', label: <>P5 / P95 <ST /></>, value: `${fmtPrice(summary.terminal.p.p5)} / ${fmtPrice(summary.terminal.p.p95)}` },
                { id: 'p25', label: <>P25 / P75 <ST /></>, value: `${fmtPrice(summary.terminal.p.p25)} / ${fmtPrice(summary.terminal.p.p75)}` },
                {
                  id: 'pt',
                  label: <>P(<ST /> &gt; {fmtPrice(target)})</>,
                  value: fmtPct(summary.terminal.probAboveTarget, 1),
                  hint: summary.analytic?.probAboveTarget != null ? `Closed form: ${fmtPct(summary.analytic.probAboveTarget, 1)}` : undefined,
                },
                { id: 'ps0', label: <>P(<ST /> &lt; <S0 />)</>, value: fmtPct(summary.terminal.probBelowStart, 1) },
                { label: 'VaR 95 / 99 (horizon)', value: `${fmtPct(summary.risk.var95, 1)} / ${fmtPct(summary.risk.var99, 1)}` },
                { label: 'CVaR 95 / 99 (horizon)', value: `${fmtPct(summary.risk.cvar95, 1)} / ${fmtPct(summary.risk.cvar99, 1)}` },
                { id: 'mu', label: <>Drift <Sym>μ</Sym> annual</>, value: q.m === 'gbm' ? fmtPct(mu, 2) : '— (resampled)' },
                { id: 'sg', label: <>Vol <Sym>σ</Sym> annual</>, value: q.m === 'gbm' ? fmtPct(sigma, 2) : fmtPct(hist.est.sigma, 2) + ' hist.' },
                { label: 'Closed-form median', value: summary.analytic ? fmtPrice(summary.analytic.median) : '—', hint: 'GBM only — validates the simulation' },
                { label: 'Seed', value: fmtSeed(q.sd) },
              ]}
            />
            <details className="mt-4">
              <summary className="label text-muted hover:text-fg">Show data table — percentile bands</summary>
              <div className="mt-3">
                <DataTable
                  caption="Percentile bands of simulated prices at checkpoints"
                  dense
                  rowKey={(r) => String(r.g)}
                  rows={bandRows(summary.grid, summary.bands, summary.meanPath)}
                  columns={[
                    { key: 't', header: 'T+', cell: (r) => <span className="num">{r.t}</span> },
                    { key: 'p5', header: 'P5', align: 'right', cell: (r) => fmtPrice(r.v[0]) },
                    { key: 'p25', header: 'P25', align: 'right', cell: (r) => fmtPrice(r.v[1]) },
                    { key: 'p50', header: 'P50', align: 'right', cell: (r) => fmtPrice(r.v[2]) },
                    { key: 'p75', header: 'P75', align: 'right', cell: (r) => fmtPrice(r.v[3]) },
                    { key: 'p95', header: 'P95', align: 'right', cell: (r) => fmtPrice(r.v[4]) },
                    { key: 'mean', header: 'Mean', align: 'right', cell: (r) => fmtPrice(r.mean) },
                  ]}
                />
              </div>
            </details>
          </Panel>
        </>
      )}
    </ToolShell>
  );
}

function bandRows(grid: Int32Array, bands: Float64Array[], mean: Float64Array) {
  const G = grid.length;
  const idx = Array.from(new Set(Array.from({ length: 11 }, (_, i) => Math.round((i * (G - 1)) / 10))));
  return idx.map((g) => ({ g, t: grid[g]!, v: bands.map((b) => b[g]!), mean: mean[g]! }));
}

export function StagePlaceholder({ text }: { text: string }) {
  return (
    <div className="relative flex h-[min(72svh,640px)] w-full items-center justify-center overflow-hidden border border-rule bg-black">
      <div className="dither absolute inset-0 text-[var(--qp-gray-800)] opacity-60" aria-hidden />
      <p className="label relative text-muted" role="status">
        {text}
      </p>
    </div>
  );
}

export function ErrorState({ code, message, retryAfter, onRetry }: { code: string; message: string; retryAfter?: number; onRetry: () => void }) {
  return (
    <div className="flex h-[min(72svh,640px)] w-full flex-col items-start justify-center gap-4 border border-dashed border-rule-strong p-8" role="alert">
      <StatusChip status="error" detail={code.replace('_', ' ')} />
      <p className="max-w-lg text-[15px] text-body">{message}</p>
      {code === 'RATE_LIMITED' && <p className="label text-muted">Provider rate limit reached. Retry in ~{retryAfter ?? 60}s — cached data is reused once available.</p>}
      {code === 'NOT_CONFIGURED' && <p className="label text-muted">Pick a crypto asset, or set the provider key on the server (see README).</p>}
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
