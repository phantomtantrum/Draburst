'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { StatusChip } from '@/components/ui/StatusChip';
import { Delta } from '@/components/ui/Delta';
import { UtcClock } from '@/components/shell/UtcClock';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ScrambleText } from '@/components/ui/ScrambleText';
import { QuantumField } from './QuantumField';
import type { ClusterState, SculptureInputs } from '@/components/three/Sculpture';
import { startLive, useLive } from '@/lib/live/binanceStream';
import { correlationLayout } from '@/lib/live/layout';
import { fetchBars } from '@/lib/market/client';
import { alignSeries } from '@/lib/market/align';
import type { BarsResponse } from '@/lib/market/types';
import { useStageMode, useReducedMotion } from '@/lib/hooks/useMedia';
import { correlation, std } from '@/lib/quant/stats';
import { logReturns } from '@/lib/quant/returns';
import { fmtPct, fmtPrice } from '@/lib/format';

const HeroCanvas = dynamic(() => import('./HeroCanvas'), { ssr: false });

const CRYPTO = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'];
const SHOWN = 6;

interface AssetInfo {
  symbol: string;
  name: string;
  vol30: number;
  lastClose: number;
  change1d: number;
}

/**
 * Landing: a black first screen with the quantum interference field and the
 * giant wordmark, then the live market panel (3D sculpture on capable GPUs,
 * always a price table).
 */
export function HomeHero() {
  const mode = useStageMode();
  const reduce = useReducedMotion();
  const live = useLive();
  const [assets, setAssets] = useState<AssetInfo[]>([]);

  // mutable scene inputs — one stable object, written by effects, read by the scene every frame
  const inputsRef = useRef<SculptureInputs>(createInputs());

  // ── daily data: realized vol, correlation layout, last close fallback ──
  useEffect(() => {
    let alive = true;
    Promise.allSettled(CRYPTO.map((s) => fetchBars(`crypto:${s}`, 1))).then((res) => {
      if (!alive) return;
      const ok = res.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      if (!ok.length) return;
      const info = ok.map((b) => toInfo(b, 365));
      const aligned = alignSeries(ok.map((b) => b.bars));
      const rets = aligned.close.map((c) => logReturns(c.slice(-91)));
      const corr = rets.map((a) => rets.map((b) => correlation(a, b)));
      const coords = correlationLayout(corr);
      const maxSpread = Math.max(...coords.flat().map(Math.abs), 1e-6);
      const cl = inputsRef.current.clusters;
      ok.forEach((b, i) => {
        const k = CRYPTO.indexOf(b.asset.symbol);
        if (k < 0) return;
        const c = coords[i]!;
        cl[k]!.center = [(c[0]! / maxSpread) * 3.2, (c[1]! / maxSpread) * 1.5, (c[2]! / maxSpread) * 1.6];
        cl[k]!.turbulence = Math.min(1, Math.max(0.06, info[i]!.vol30 / 1.3));
      });
      setAssets(info);
    });
    return () => {
      alive = false;
    };
  }, []);

  // ── live ticks → scale (volume) + ripples ──
  useEffect(() => startLive(CRYPTO), []);
  const lastSeq = useRef<Record<string, number>>({});
  useEffect(() => {
    const ticks = Object.values(live.ticks);
    if (!ticks.length) return;
    const maxVol = Math.max(...ticks.map((t) => t.quoteVol24), 1);
    for (const t of ticks) {
      const k = CRYPTO.indexOf(t.symbol);
      if (k < 0) continue;
      const c = inputsRef.current.clusters[k]!;
      c.scale = 0.32 + 0.6 * Math.sqrt(t.quoteVol24 / maxVol);
      if (lastSeq.current[t.symbol] !== t.seq && t.dir !== 0) {
        lastSeq.current[t.symbol] = t.seq;
        c.rippleT = inputsRef.current.clock.now;
        c.rippleSign = t.dir;
        c.rippleAmp = Math.min(0.5, 0.06 + t.move * 600);
      }
    }
  }, [live]);

  const status = live.status === 'live' ? 'live' : live.status === 'connecting' ? 'loading' : live.status;
  const anyLive = Object.keys(live.ticks).length > 0;
  const rows = useMemo(
    () =>
      assets.slice(0, SHOWN).map((a) => {
        const t = live.ticks[a.symbol];
        return t ? { ...a, price: t.price, change: t.price / t.open24 - 1 } : { ...a, price: a.lastClose, change: a.change1d };
      }),
    [assets, live],
  );
  const show3D = mode === 'full' || mode === 'static';

  return (
    <>
      {/* ── first screen: black, quantum interference field, the wordmark ── */}
      <section aria-labelledby="hero-title" className="relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-bg">
        <QuantumField className="absolute inset-0 -z-10 h-full w-full" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-1/2 bg-gradient-to-t from-bg via-bg/60 to-transparent" />
        <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col justify-between px-4 pt-6 pb-10 lg:px-6 lg:pb-14">
          <div className="flex items-start justify-between gap-4">
            <SectionLabel index="00" title="Quantum field · |ψ|²" />
            <div className="label flex flex-col items-end gap-1 text-muted">
              <StatusChip status={status} />
              <UtcClock className="num max-sm:hidden" />
              <span className="max-sm:hidden">SRC BINANCE WS · TIINGO EOD</span>
            </div>
          </div>
          <div>
            <h1 id="hero-title" className="wordmark text-fg">
              <ScrambleText text="quantphantom" />
            </h1>
            <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <p className="max-w-xl text-[18px] leading-relaxed text-body">
                Quant research on real market data: Monte Carlo simulation, portfolio optimization and strategy backtesting, right in your
                browser.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/tools/monte-carlo" className="ui-label inline-flex h-11 items-center border border-fg bg-fg px-5 text-bg hover:bg-transparent hover:text-fg">
                  Start with Monte Carlo →
                </Link>
                <Link href="#tools" className="ui-label inline-flex h-11 items-center border border-rule-strong bg-bg/60 px-5 text-fg hover:border-fg">
                  See all tools
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── live market ── */}
      <section aria-labelledby="market-title" className="border-t border-rule">
        <div className="mx-auto grid max-w-[1600px] items-start gap-10 px-4 py-20 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-6 lg:py-24">
          <div>
            <p className="ui-label text-muted">Live market</p>
            <h2 id="market-title" className="mt-2 text-[clamp(28px,3vw,40px)] leading-tight font-bold tracking-[-0.025em] text-fg">
              Real prices, streamed as they trade.
            </h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-body">
              Crypto ticks arrive live from Binance; stocks and ETFs come end-of-day from Tiingo. Every tool runs on the same data.
            </p>
            <p className="mt-6 text-[13px] text-muted">Not investment advice.</p>
          </div>

          <div className="min-w-0 border border-rule bg-surface">
            <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
              <h3 className="ui-label text-fg">Market now</h3>
              <div className="flex items-center gap-3">
                <UtcClock className="label num hidden text-muted sm:inline" />
                <StatusChip status={status} />
              </div>
            </div>
            {show3D && (
              <div className="relative h-[220px] border-b border-rule bg-bg sm:h-[260px]">
                <HeroCanvas
                  inputs={inputsRef}
                  nClusters={CRYPTO.length}
                  animate={mode === 'full' && !reduce}
                  label="Live market sculpture: one particle cluster per crypto asset; turbulence follows realized volatility, size follows 24-hour volume, and correlated assets sit close together. Prices are listed in the table below."
                />
                <p className="label pointer-events-none absolute bottom-2 left-3 text-muted">One cluster per asset · motion = volatility</p>
              </div>
            )}
            <table className="w-full border-collapse text-[14px]">
              <caption className="sr-only">Latest crypto prices</caption>
              <thead>
                <tr className="border-b border-rule text-left">
                  <th scope="col" className="ui-label px-4 py-2 text-[13px] text-muted">
                    Asset
                  </th>
                  <th scope="col" className="ui-label px-4 py-2 text-right text-[13px] text-muted">
                    Price
                  </th>
                  <th scope="col" className="ui-label px-4 py-2 text-right text-[13px] text-muted">
                    {anyLive ? '24h' : '1d'}
                  </th>
                  <th scope="col" className="ui-label hidden px-4 py-2 text-right text-[13px] text-muted sm:table-cell">
                    30d vol
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.length
                  ? rows.map((r) => (
                      <tr key={r.symbol} className="border-b border-rule last:border-b-0">
                        <th scope="row" className="px-4 py-2.5 text-left font-normal whitespace-nowrap">
                          <span className="num text-fg">{r.symbol}</span> <span className="ml-1 text-[13px] text-muted max-sm:hidden">{r.name}</span>
                        </th>
                        <td className="num px-4 py-2.5 text-right text-fg">{fmtPrice(r.price)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Delta value={r.change} />
                        </td>
                        <td className="num hidden px-4 py-2.5 text-right text-body sm:table-cell">{fmtPct(r.vol30, 0)}</td>
                      </tr>
                    ))
                  : Array.from({ length: SHOWN }, (_, i) => (
                      <tr key={i} className="border-b border-rule last:border-b-0" aria-hidden>
                        <td colSpan={4} className="px-4 py-2.5">
                          <span className="block h-[21px] w-full animate-pulse bg-surface-2" />
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}

function createInputs(): SculptureInputs {
  return {
    clusters: CRYPTO.map(
      (_, i): ClusterState => ({ center: [Math.cos(i) * 2, Math.sin(i * 1.3), Math.sin(i) * 1.5], scale: 0.55, turbulence: 0.3, rippleT: -99, rippleSign: 1, rippleAmp: 0 }),
    ),
    morph: { target: 0 },
    clock: { now: 0 },
  };
}

function toInfo(b: BarsResponse, ppy: number): AssetInfo {
  const c = b.bars.c;
  const lr = logReturns(c.slice(-31));
  return {
    symbol: b.asset.symbol,
    name: b.asset.name,
    vol30: std(lr) * Math.sqrt(ppy),
    lastClose: c[c.length - 1]!,
    change1d: c[c.length - 1]! / c[c.length - 2]! - 1,
  };
}
