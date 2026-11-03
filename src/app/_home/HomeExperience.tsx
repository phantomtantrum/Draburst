'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { StatusChip } from '@/components/ui/StatusChip';
import { Delta } from '@/components/ui/Delta';
import { UtcClock } from '@/components/shell/UtcClock';
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
 * Landing hero: plain headline + calls to action on the left, a live market
 * panel on the right (3D sculpture on capable devices, always a price table).
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
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid max-w-[1400px] items-center gap-12 px-4 pt-14 pb-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16 lg:px-6 lg:pt-24 lg:pb-28"
    >
      <div>
        <p className="ui-label inline-flex items-center gap-2 border border-rule bg-surface px-3 py-1.5 text-[13px] text-body">
          <span aria-hidden className="inline-block size-1.5 rounded-full bg-gain" />
          Free · live crypto data · no sign-up needed
        </p>
        <h1 id="hero-title" className="mt-6 text-[clamp(38px,5.2vw,64px)] leading-[1.04] font-bold tracking-[-0.035em] text-fg">
          Quant research on real market data.
        </h1>
        <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-body">
          Simulate thousands of price paths, build an efficient portfolio and backtest a trading strategy, right in your browser. Every formula is
          shown, every run is reproducible.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/tools/monte-carlo" className="ui-label inline-flex h-11 items-center border border-fg bg-fg px-5 text-bg hover:bg-transparent hover:text-fg">
            Start with Monte Carlo →
          </Link>
          <Link href="#tools" className="ui-label inline-flex h-11 items-center border border-rule-strong px-5 text-fg hover:border-fg">
            See all tools
          </Link>
        </div>
        <p className="mt-8 text-[13px] text-muted">Data from Binance (live) and Tiingo (end of day). Not investment advice.</p>
      </div>

      <div className="min-w-0 border border-rule bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-rule px-4 py-3">
          <h2 className="ui-label text-fg">Market now</h2>
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
    </section>
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
