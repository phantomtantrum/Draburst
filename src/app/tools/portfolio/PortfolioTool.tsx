'use client';

import { Sym } from '@/components/ui/Sym';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { parseAsArrayOf, parseAsFloat, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs';
import { X, Plus } from 'lucide-react';
import { ToolShell, Panel } from '@/components/tool/ToolShell';
import { AssetPicker } from '@/components/tool/AssetPicker';
import { Segmented } from '@/components/ui/Segmented';
import { Slider } from '@/components/ui/Slider';
import { NumberField } from '@/components/ui/NumberField';
import { Toggle } from '@/components/ui/Toggle';
import { Button, IconButton } from '@/components/ui/Button';
import { DataTable, MetricList } from '@/components/ui/DataTable';
import { StatusChip } from '@/components/ui/StatusChip';
import { FrontierChart, type Marker } from '@/components/charts/FrontierChart';
import { CorrHeatmap } from '@/components/charts/CorrHeatmap';
import { WeightBar } from '@/components/charts/WeightBar';
import { useMultiBars } from '@/lib/hooks/useMultiBars';
import { useWorkerTask, latest } from '@/lib/hooks/useWorkerTask';
import { useStageMode } from '@/lib/hooks/useMedia';
import { alignSeries } from '@/lib/market/align';
import { periodsPerYear } from '@/lib/quant/returns';
import type { PortfolioInput, PortfolioOutput } from '@/lib/quant/portfolio';
import type { PortfolioWorkerApi } from '@/workers/portfolio.worker';
import { fmtInt, fmtNum, fmtPct, fmtSeed } from '@/lib/format';
import { cn } from '@/lib/cn';
import { StagePlaceholder } from '../monte-carlo/MonteCarloTool';
import { parseAsNumMap } from '@/lib/url/parsers';
import { ToolActions } from '@/components/tool/ToolActions';

const PortfolioStage = dynamic(() => import('./PortfolioStage'), { ssr: false, loading: () => <StagePlaceholder text="LOADING 3D STAGE…" /> });

const DEFAULT_ASSETS = ['crypto:BTC', 'crypto:ETH', 'crypto:SOL', 'crypto:BNB', 'crypto:XRP'];

export const pfSearchParams = {
  as: parseAsArrayOf(parseAsString, ',').withDefault(DEFAULT_ASSETS),
  lb: parseAsInteger.withDefault(3),
  rf: parseAsFloat.withDefault(0.04),
  est: parseAsStringLiteral(['lw', 'sample'] as const).withDefault('lw'),
  long: parseAsStringLiteral(['1', '0'] as const).withDefault('1'),
  lo: parseAsFloat.withDefault(0),
  hi: parseAsFloat.withDefault(1),
  blo: parseAsNumMap.withDefault({}),
  bhi: parseAsNumMap.withDefault({}),
  cw: parseAsNumMap.withDefault({}),
  nr: parseAsInteger.withDefault(5000),
  sd: parseAsInteger.withDefault(0x5eed),
  v: parseAsStringLiteral(['cloud', 'corr'] as const).withDefault('cloud'),
};

const LABEL = { minvar: 'MIN-VAR', maxsharpe: 'MAX-SHARPE', equal: 'EQUAL', custom: 'CUSTOM' } as const;
const GLYPH = { minvar: 'square', maxsharpe: 'disc', equal: 'diamond', custom: 'ring' } as const;
const GLYPH_CHAR = { minvar: '■', maxsharpe: '●', equal: '◆', custom: '○' } as const;

export function PortfolioTool({ methodology }: { methodology: ReactNode }) {
  const [q, setQ] = useQueryStates(pfSearchParams, { history: 'replace', throttleMs: 250 });
  const ids = useMemo(() => Array.from(new Set(q.as)).slice(0, 20), [q.as]);
  const [reload, setReload] = useState(0);
  const bars = useMultiBars(ids, Math.min(15, Math.max(1, q.lb)), reload);
  const mode = useStageMode();
  const [adding, setAdding] = useState(false);
  const longOnly = q.long === '1';
  const globalLo = longOnly ? Math.max(0, q.lo) : q.lo;

  const task = useWorkerTask<PortfolioWorkerApi, PortfolioInput, PortfolioOutput>(
    () => new Worker(new URL('../../../workers/portfolio.worker.ts', import.meta.url), { type: 'module', name: 'portfolio' }),
    (api, arg) => api.analyze(arg),
  );

  // aligned data
  const aligned = useMemo(() => {
    if (bars.loading || bars.ok.length < 2) return null;
    const order = ids.map((id) => bars.ok.find((b) => b.asset.id === id)).filter((b): b is NonNullable<typeof b> => !!b);
    const a = alignSeries(order.map((b) => b.bars));
    const classes = order.map((b) => b.asset.cls);
    return { order, a, ppy: periodsPerYear(classes), mixed: new Set(classes).size > 1 };
  }, [bars, ids]);

  const symbols = useMemo(() => aligned?.order.map((b) => b.asset.symbol) ?? [], [aligned]);
  const assetIds = useMemo(() => aligned?.order.map((b) => b.asset.id as string) ?? [], [aligned]);
  const lo = useMemo(() => assetIds.map((id) => q.blo[id] ?? globalLo), [assetIds, q.blo, globalLo]);
  const hi = useMemo(() => assetIds.map((id) => q.bhi[id] ?? q.hi), [assetIds, q.bhi, q.hi]);
  const custom = useMemo(() => (Object.keys(q.cw).length ? assetIds.map((id) => q.cw[id] ?? 0) : null), [assetIds, q.cw]);
  const sumLo = lo.reduce((a, b) => a + b, 0),
    sumHi = hi.reduce((a, b) => a + b, 0);
  const boundsError = aligned && (sumLo > 1 + 1e-9 || sumHi < 1 - 1e-9) ? `Infeasible bounds: Σmin = ${fmtPct(sumLo, 0)}, Σmax = ${fmtPct(sumHi, 0)} — need Σmin ≤ 100% ≤ Σmax.` : null;

  const { run } = task;
  useEffect(() => {
    if (!aligned || boundsError || aligned.a.t.length < 21) return;
    const h = window.setTimeout(
      () =>
        run({
          closes: aligned.a.close,
          ppy: aligned.ppy,
          rf: q.rf,
          estimator: q.est,
          lo,
          hi,
          custom,
          nRandom: Math.min(20_000, Math.max(500, q.nr)),
          seed: q.sd >>> 0,
        }),
      250,
    );
    return () => window.clearTimeout(h);
  }, [aligned, q.rf, q.est, lo, hi, custom, q.nr, q.sd, boundsError, run]);

  const out = latest(task.state);
  const outFresh = out && out.mu.length === symbols.length ? out : null;

  const markers: Marker[] = useMemo(
    () => (outFresh ? outFresh.portfolios.map((p) => ({ ...p, label: LABEL[p.key], glyph: GLYPH[p.key] })) : []),
    [outFresh],
  );

  const removeAsset = (id: string) => {
    const strip = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== id));
    setQ({ as: q.as.filter((x) => x !== id), blo: strip(q.blo), bhi: strip(q.bhi), cw: strip(q.cw) });
  };

  // ── controls ──
  const controls = (
    <>
      <div>
        <p className="label mb-2 flex justify-between text-muted">
          <span>Assets</span>
          <span className="num">{ids.length} / 20</span>
        </p>
        <ul className="flex flex-wrap gap-1.5" aria-label="Selected assets">
          {ids.map((id) => {
            const failed = bars.failed.find((f) => f.id === id);
            return (
              <li key={id} className={cn('label num flex items-center border pl-2', failed ? 'border-dashed border-rule-strong text-muted' : 'border-rule-strong text-fg')} title={failed?.message}>
                {failed && <span aria-hidden className="mr-1">!</span>}
                {id.split(':')[1]}
                <IconButton label={`Remove ${id.split(':')[1]}`} onClick={() => removeAsset(id)} className="size-6 max-md:size-9" disabled={ids.length <= 2}>
                  <X size={11} strokeWidth={1.5} aria-hidden />
                </IconButton>
              </li>
            );
          })}
          {ids.length < 20 && (
            <li>
              <Button variant="ghost" size="sm" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className="h-[26px] border-dashed border-rule-strong px-2">
                <Plus size={11} strokeWidth={1.5} aria-hidden /> Add
              </Button>
            </li>
          )}
        </ul>
        {adding && (
          <AssetPicker
            className="mt-3"
            label="Add asset"
            value={null}
            exclude={ids}
            onChange={(a) => {
              setQ({ as: [...ids, a.id] });
              setAdding(false);
            }}
          />
        )}
      </div>
      <Segmented label="Lookback (years)" value={String(q.lb)} options={[1, 2, 3, 5, 10].map((y) => ({ value: String(y), label: `${y}Y` }))} onChange={(v) => setQ({ lb: Number(v) })} />
      <NumberField label="Risk-free rate" value={Number((q.rf * 100).toFixed(2))} suffix="%" step={0.25} min={-5} max={20} onChange={(v) => setQ({ rf: v / 100 })} />
      <Segmented
        label="Covariance"
        value={q.est}
        options={[
          { value: 'lw', label: 'Ledoit–Wolf' },
          { value: 'sample', label: 'Sample' },
        ]}
        onChange={(v) => setQ({ est: v })}
      />
      <div className="flex flex-col gap-3">
        <Toggle label="Long-only" checked={longOnly} onChange={(v) => setQ({ long: v ? '1' : '0', lo: v ? Math.max(0, q.lo) : -0.25 })} help="Disallow negative weights" />
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Min weight" value={Number((globalLo * 100).toFixed(1))} suffix="%" step={1} min={longOnly ? 0 : -100} max={100} onChange={(v) => setQ({ lo: v / 100 })} />
          <NumberField label="Max weight" value={Number((q.hi * 100).toFixed(1))} suffix="%" step={1} min={1} max={200} onChange={(v) => setQ({ hi: v / 100 })} />
        </div>
        {boundsError && (
          <p className="text-[13px] text-fg" role="alert">
            <span className="num mr-1">!</span>
            {boundsError}
          </p>
        )}
      </div>
      <Slider label="Random portfolios" value={Math.min(20_000, Math.max(500, q.nr))} min={500} max={20_000} step={500} log format={fmtInt} onChange={(v) => setQ({ nr: v })} />
      <p className="label text-muted">
        SEED <span className="num text-fg">{fmtSeed(q.sd)}</span> · per-asset bounds &amp; custom weights in the table below
      </p>
    </>
  );

  const loadingAll = bars.loading;
  const stage = boundsError ? (
    <StagePlaceholder text="ADJUST WEIGHT BOUNDS" />
  ) : loadingAll ? (
    <StagePlaceholder text={`LOADING ${ids.length} ASSETS…`} />
  ) : bars.ok.length < 2 ? (
    <div className="flex h-[min(72svh,640px)] flex-col items-start justify-center gap-3 border border-dashed border-rule-strong p-8" role="alert">
      <StatusChip status="error" detail="NOT ENOUGH DATA" />
      <p className="text-body">At least two assets must load. {bars.failed.map((f) => `${f.id.split(':')[1]}: ${f.message}`).join(' · ')}</p>
      <Button variant="secondary" size="sm" onClick={() => setReload((r) => r + 1)}>
        Retry
      </Button>
    </div>
  ) : !outFresh ? (
    <StagePlaceholder text={task.state.status === 'error' ? `! ${task.state.message}` : 'OPTIMIZING…'} />
  ) : mode === 'none' ? (
    <StagePlaceholder text="WEBGL UNAVAILABLE — SHOWING 2D CHARTS BELOW" />
  ) : mode == null ? (
    <StagePlaceholder text="" />
  ) : (
    <div>
      <div className="mb-2 flex justify-end">
        <Segmented
          label="3D view"
          hideLabel
          value={q.v}
          onChange={(v) => setQ({ v })}
          options={[
            { value: 'cloud', label: 'Risk × Return × Sharpe' },
            { value: 'corr', label: 'Correlation field' },
          ]}
        />
      </div>
      <PortfolioStage mode={mode} out={outFresh} symbols={symbols} view={q.v} />
    </div>
  );

  const meta = aligned ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="label num text-muted">
        ALIGNED ON <span className="text-fg">{fmtInt(aligned.a.t.length)}</span> COMMON {aligned.mixed ? 'TRADING' : ''} DAYS
        {aligned.mixed ? ' · CRYPTO RESAMPLED TO EXCHANGE CALENDAR' : ''} · BASIS {aligned.ppy}
        {outFresh?.shrinkage != null && <> · LW <Sym>δ*</Sym> = {fmtNum(outFresh.shrinkage, 3)}</>}
      </span>
      <span className="flex items-center gap-3">
        {task.state.status === 'running' && <StatusChip status="loading" detail="OPTIMIZING" />}
        {bars.failed.length > 0 && <StatusChip status="error" detail={`${bars.failed.length} FAILED`} />}
        <span className="label text-muted">SRC {Array.from(new Set(aligned.order.map((b) => b.source.name.toUpperCase()))).join(' + ')} · EOD</span>
      </span>
    </div>
  ) : null;

  return (
    <ToolShell
      index="02"
      title="Portfolio"
      subtitle="Efficient frontier across crypto and equities on one aligned calendar: minimum variance, maximum Sharpe, equal weight and your own mix."
      meta={meta}
      controls={controls}
      stage={stage}
      methodology={methodology}
      methodologyTitle="Methodology — Portfolio optimizer"
      actions={
        <ToolActions
          tool="portfolio"
          defaultName={`${symbols.join(' · ')} · ${q.est === 'lw' ? 'LW' : 'Sample'}`}
          seed={q.sd}
          summary={
            outFresh
              ? {
                  assets: symbols.join(','),
                  max_sharpe: Number(outFresh.portfolios[1]!.sharpe.toFixed(3)),
                  ret: Number(outFresh.portfolios[1]!.ret.toFixed(4)),
                  vol: Number(outFresh.portfolios[1]!.vol.toFixed(4)),
                  minvar_vol: Number(outFresh.portfolios[0]!.vol.toFixed(4)),
                }
              : null
          }
        />
      }
    >
      {outFresh && aligned && (
        <>
          <div aria-live="polite" className="sr-only">
            {`Max-Sharpe portfolio: Sharpe ${fmtNum(outFresh.portfolios[1]!.sharpe, 2)}, return ${fmtPct(outFresh.portfolios[1]!.ret, 1)}, volatility ${fmtPct(outFresh.portfolios[1]!.vol, 1)}.`}
          </div>
          <Panel index="A" title="Efficient frontier" aside={<span className="label text-muted">ANNUALIZED · rf {fmtPct(q.rf, 2)}</span>}>
            <FrontierChart cloud={outFresh.cloud} frontier={outFresh.frontier} markers={markers} symbols={symbols} rf={q.rf} />
          </Panel>
          <Panel
            index="B"
            title="Portfolios"
            aside={
              <span className="flex flex-wrap gap-2">
                {outFresh.portfolios
                  .filter((p) => p.key !== 'equal')
                  .map((p) => (
                    <Link
                      key={p.key}
                      className="label border border-rule-strong px-2 py-1 text-fg hover:border-fg"
                      href={`/tools/backtest?st=rebal&lb=${q.lb}&pw=${encodeURIComponent(
                        assetIds
                          .map((id, i) => [id, p.weights[i]!] as const)
                          .filter(([, w]) => w > 0.0005)
                          .map(([id, w]) => `${id}=${Number(w.toFixed(4))}`)
                          .join(';'),
                      )}`}
                    >
                      Backtest {LABEL[p.key]} →
                    </Link>
                  ))}
              </span>
            }
          >
            <MetricList
              columns={4}
              items={outFresh.portfolios.map((p) => ({
                id: p.key,
                label: (
                  <>
                    {GLYPH_CHAR[p.key]} {LABEL[p.key]}
                  </>
                ),
                value: (
                  <span className="flex flex-col gap-0.5 text-[15px]">
                    <span>SR {fmtNum(p.sharpe, 2)}</span>
                    <span className="text-[12px] text-muted">
                      μ {fmtPct(p.ret, 1)} · σ {fmtPct(p.vol, 1)}
                    </span>
                  </span>
                ),
              }))}
            />
            <div className="mt-6">
              <DataTable
                caption="Weights per portfolio, with per-asset bounds and custom weights"
                rowKey={(r) => r.id}
                rows={assetIds.map((id, i) => ({ id, i, sym: symbols[i]! }))}
                columns={[
                  { key: 'a', header: 'Asset', cell: (r) => <span className="num text-fg">{r.sym}</span> },
                  { key: 'mu', header: <Sym>μ</Sym>, align: 'right', cell: (r) => fmtPct(outFresh.mu[r.i], 1) },
                  { key: 'vol', header: <Sym>σ</Sym>, align: 'right', cell: (r) => fmtPct(outFresh.vol[r.i], 1) },
                  ...outFresh.portfolios.map((p) => ({
                    key: p.key,
                    header: `${GLYPH_CHAR[p.key]} ${LABEL[p.key]}`,
                    align: 'right' as const,
                    cell: (r: { i: number }) => <WeightBar w={p.weights[r.i]!} max={Math.max(...Array.from(p.weights, Math.abs))} />,
                  })),
                  {
                    key: 'b',
                    header: 'Min · Max',
                    align: 'right',
                    cell: (r) => (
                      <span className="inline-flex gap-1">
                        <CellInput
                          label={`Minimum weight for ${r.sym}`}
                          value={lo[r.i]! * 100}
                          onCommit={(v) => setQ({ blo: { ...q.blo, [r.id]: v / 100 } })}
                        />
                        <CellInput label={`Maximum weight for ${r.sym}`} value={hi[r.i]! * 100} onCommit={(v) => setQ({ bhi: { ...q.bhi, [r.id]: v / 100 } })} />
                      </span>
                    ),
                  },
                  {
                    key: 'cw',
                    header: '○ Custom %',
                    align: 'right',
                    cell: (r) => <CellInput label={`Custom weight for ${r.sym}`} value={(custom?.[r.i] ?? 0) * 100} onCommit={(v) => setQ({ cw: { ...Object.fromEntries(assetIds.map((id, j) => [id, custom?.[j] ?? 0])), [r.id]: v / 100 } })} />,
                  },
                ]}
              />
              <p className="label mt-2 text-muted">
                CUSTOM WEIGHTS ARE NORMALIZED TO 100%
                {custom ? ` · CURRENT SUM ${fmtPct(custom.reduce((a, b) => a + b, 0), 1)}` : ' · ENTER ANY VALUE TO ADD A CUSTOM PORTFOLIO'}
                {Object.keys(q.blo).length + Object.keys(q.bhi).length > 0 && (
                  <button type="button" className="ml-3 underline" onClick={() => setQ({ blo: {}, bhi: {} })}>
                    RESET PER-ASSET BOUNDS
                  </button>
                )}
                {custom && (
                  <button type="button" className="ml-3 underline" onClick={() => setQ({ cw: {} })}>
                    CLEAR CUSTOM
                  </button>
                )}
              </p>
            </div>
          </Panel>
          <div className="grid gap-10 xl:grid-cols-2">
            <Panel index="C" title="Correlation">
              <CorrHeatmap corr={outFresh.corr} symbols={symbols} />
            </Panel>
            <Panel index="D" title="Risk contribution">
              <DataTable
                caption="Share of portfolio variance contributed by each asset"
                rowKey={(r) => r.sym}
                rows={symbols.map((sym, i) => ({ sym, i }))}
                columns={[
                  { key: 'a', header: 'Asset', cell: (r) => <span className="num text-fg">{r.sym}</span> },
                  ...outFresh.portfolios.map((p) => ({
                    key: p.key,
                    header: `${GLYPH_CHAR[p.key]} ${LABEL[p.key]}`,
                    align: 'right' as const,
                    cell: (r: { i: number }) => <WeightBar w={p.riskPct[r.i]!} max={Math.max(...p.riskPct.map(Math.abs))} />,
                  })),
                ]}
              />
              <p className="label mt-2 text-muted">RC = <Sym>w·(Σw) / wᵀΣw</Sym> · HATCHED = NEGATIVE (DIVERSIFYING) CONTRIBUTION</p>
            </Panel>
          </div>
        </>
      )}
    </ToolShell>
  );
}

function CellInput({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(Number(value.toFixed(1))));
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external value into the edit buffer
  useEffect(() => setText(String(Number(value.toFixed(1)))), [value]);
  const commit = () => {
    const n = Number(text.replace('−', '-'));
    if (Number.isFinite(n) && n !== Number(value.toFixed(1))) onCommit(n);
    else setText(String(Number(value.toFixed(1))));
  };
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      className="num h-7 w-14 border-0 border-b border-rule bg-surface-2 px-1 text-right text-[12px] text-fg focus-visible:border-fg max-md:h-10"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}
