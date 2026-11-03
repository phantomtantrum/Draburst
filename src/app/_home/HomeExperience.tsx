'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { Pause, Play } from 'lucide-react';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ScrambleText } from '@/components/ui/ScrambleText';
import { StatusChip } from '@/components/ui/StatusChip';
import { Delta } from '@/components/ui/Delta';
import { IconButton } from '@/components/ui/Button';
import { UtcClock } from '@/components/shell/UtcClock';
import type { ClusterState, SculptureInputs } from '@/components/three/Sculpture';
import { startLive, useLive } from '@/lib/live/binanceStream';
import { correlationLayout } from '@/lib/live/layout';
import { fetchBars, fetchStatus } from '@/lib/market/client';
import { alignSeries } from '@/lib/market/align';
import type { BarsResponse } from '@/lib/market/types';
import { useStageMode, useReducedMotion } from '@/lib/hooks/useMedia';
import { correlation, std } from '@/lib/quant/stats';
import { logReturns } from '@/lib/quant/returns';
import { fmtPrice } from '@/lib/format';
import { cn } from '@/lib/cn';

gsap.registerPlugin(ScrollTrigger, useGSAP);

const HeroCanvas = dynamic(() => import('./HeroCanvas'), { ssr: false });

const CRYPTO = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'DOGE', 'AVAX'];
const STOCKS = ['SPY', 'QQQ', 'AAPL', 'NVDA'];

const STEPS = [
  {
    idx: '01',
    title: 'Monte Carlo',
    shape: 'FAN',
    href: '/tools/monte-carlo',
    body: 'The sculpture dissolves into thousands of possible futures. Each line is a path; depth is its rank at the horizon. Density, not color, tells you where the mass of outcomes lies.',
    metric: 'P(S_T > target) · VaR · CVaR · percentile bands',
  },
  {
    idx: '02',
    title: 'Portfolio',
    shape: 'CLOUD',
    href: '/tools/portfolio',
    body: 'Re-formed as a cloud of random portfolios in risk × return × Sharpe space. The white ridge along its upper edge is the efficient frontier.',
    metric: 'Min-variance · max-Sharpe · Ledoit–Wolf · risk contribution',
  },
  {
    idx: '03',
    title: 'Backtest',
    shape: 'RIBBON',
    href: '/tools/backtest',
    body: 'Finally a ribbon of equity through time with drawdowns carved underneath. Signals on the close, fills on the next open — no look-ahead.',
    metric: 'CAGR · Sharpe · Sortino · max drawdown · parameter sweeps',
  },
];

interface AssetInfo {
  symbol: string;
  name: string;
  vol30: number;
  lastClose: number;
  change1d: number;
  cls: 'crypto' | 'stock';
}

export function HomeExperience() {
  const mode = useStageMode();
  const reduce = useReducedMotion();
  const live = useLive();
  const wrap = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const [assets, setAssets] = useState<AssetInfo[]>([]);
  const [paused, setPaused] = useState(false);

  // mutable scene inputs — one stable object, written by effects, read by the scene every frame
  const inputsRef = useRef<SculptureInputs>(createInputs());
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

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
      setAssets((prev) => [...info, ...prev.filter((p) => p.cls === 'stock')]);
    });
    fetchStatus().then((st) => {
      if (!st.stock.configured) return;
      Promise.allSettled(STOCKS.map((s) => fetchBars(`stock:${s}`, 1))).then((res) => {
        if (!alive) return;
        const info = res.flatMap((r) => (r.status === 'fulfilled' ? [toInfo(r.value, 252)] : []));
        setAssets((prev) => [...prev.filter((p) => p.cls === 'crypto'), ...info]);
      });
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

  // ── scroll → morph (native scroll; GSAP only observes) ──
  const animate = mode === 'full' && !reduce;
  useGSAP(
    () => {
      if (!wrap.current || !animate) return;
      ScrollTrigger.create({
        trigger: wrap.current,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          inputsRef.current.morph.target = Math.min(3, Math.max(0, self.progress * 3.6 - 0.3));
          // the hero wordmark steps aside as the intro begins
          const o = Math.max(0, 1 - self.progress * 6);
          if (overlay.current) {
            overlay.current.style.opacity = String(o);
            overlay.current.style.visibility = o === 0 ? 'hidden' : 'visible';
          }
        },
      });
    },
    { scope: wrap, dependencies: [animate] },
  );

  const status = live.status === 'live' ? 'live' : live.status === 'connecting' ? 'loading' : live.status;
  const statusDetail = undefined;
  const rows = useMemo(
    () =>
      [...assets].map((a) => {
        const t = live.ticks[a.symbol];
        return t && a.cls === 'crypto'
          ? { ...a, price: t.price, change: t.price / t.open24 - 1, live: true }
          : { ...a, price: a.lastClose, change: a.change1d, live: false };
      }),
    [assets, live],
  );

  return (
    <>
      <div ref={wrap} className="relative" style={{ height: animate ? '400svh' : undefined }}>
        <div className={cn('top-0 h-[100svh] w-full overflow-hidden bg-black', animate ? 'sticky' : 'relative')}>
          {mode && mode !== 'none' && (
            <HeroCanvas
              inputs={inputsRef}
              nClusters={CRYPTO.length}
              animate={animate}
              label="Live market sculpture: one particle cluster per crypto asset; turbulence follows realized volatility, size follows 24-hour volume, and correlated assets sit close together. Prices are listed in the ticker strip."
            />
          )}
          {mode === 'none' && <div className="dither absolute inset-0 text-[var(--qp-gray-800)]" aria-hidden />}
          {/* instrument overlay */}
          <div ref={overlay} className="pointer-events-none absolute inset-0 mx-auto flex max-w-[1600px] flex-col justify-between px-4 pt-6 pb-10 lg:px-6">
            <div className="flex items-start justify-between gap-4">
              <SectionLabel index="00" title="Live market sculpture" />
              <div className="label flex flex-col items-end gap-1 text-muted">
                <StatusChip status={status} detail={live.status === 'stale' && live.lastMessage && now ? `${Math.max(0, Math.round((now - live.lastMessage) / 1000))}S` : live.status === 'offline' ? 'LAST CLOSE' : statusDetail} />
                <UtcClock className="num" />
                <span>SRC BINANCE WS{assets.some((a) => a.cls === 'stock') ? ' · TIINGO EOD' : ''}</span>
              </div>
            </div>
            <div>
              <h1 className="display-xl text-fg mix-blend-difference">
                <ScrambleText text="quantphantom" />
              </h1>
              <p className="mt-8 max-w-xl text-[17px] text-body">
                A research terminal designed by a gallery. Real market data, rigorous quant math — every number on screen ready to become a sculpture.
              </p>
              <p className="label mt-6 text-muted max-sm:hidden">
                TURBULENCE = REALIZED VOL · SCALE = 24H VOLUME · PROXIMITY = CORRELATION · EACH TICK = A RIPPLE{animate ? ' · SCROLL ↓' : ''}
              </p>
            </div>
          </div>
        </div>

        <TickerStrip rows={rows} paused={paused || reduce} onToggle={() => setPaused((p) => !p)} reduce={reduce} />

        {/* scroll intro: text steps over the pinned sculpture */}
        <div className={cn(animate ? 'absolute inset-x-0 top-[100svh]' : 'relative')}>
          {STEPS.map((s) => (
            <section key={s.idx} aria-labelledby={`step-${s.idx}`} className={cn('mx-auto flex max-w-[1600px] items-center px-4 lg:px-6', animate ? 'h-[100svh]' : 'border-b border-rule py-16')}>
              <div className="max-w-md border border-rule bg-black/80 p-6">
                <SectionLabel index={s.idx} title={s.shape} />
                <h2 id={`step-${s.idx}`} className="display-m mt-4">
                  {s.title}
                </h2>
                <p className="mt-4 text-[15px] text-body">{s.body}</p>
                <p className="label mt-4 text-muted">{s.metric}</p>
                <Link href={s.href} className="label mt-6 inline-block border border-fg bg-fg px-4 py-2.5 text-bg hover:bg-bg hover:text-fg">
                  Open tool →
                </Link>
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

function createInputs(): SculptureInputs {
  return {
    clusters: CRYPTO.map((_, i): ClusterState => ({ center: [Math.cos(i) * 2, Math.sin(i * 1.3), Math.sin(i) * 1.5], scale: 0.55, turbulence: 0.3, rippleT: -99, rippleSign: 1, rippleAmp: 0 })),
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
    cls: b.asset.cls,
  };
}

function TickerStrip({
  rows,
  paused,
  onToggle,
  reduce,
}: {
  rows: Array<AssetInfo & { price: number; change: number; live: boolean }>;
  paused: boolean;
  onToggle: () => void;
  reduce: boolean;
}) {
  if (!rows.length) return <div className="sticky top-12 z-30 h-10 border-y border-rule bg-bg" aria-hidden />;
  const items = rows.map((r) => (
    <span key={r.symbol} className="flex items-baseline gap-2 px-5 whitespace-nowrap">
      <span className="num text-[13px] text-fg">{r.symbol}</span>
      <span className="num text-[13px] text-body">{fmtPrice(r.price)}</span>
      <Delta value={r.change} className="text-[12px]" />
      <span className="label text-subtle">{r.live ? '24H' : r.cls === 'stock' ? 'EOD' : '1D'}</span>
    </span>
  ));
  return (
    <div className="sticky top-12 z-30 flex h-10 items-center border-y border-rule bg-bg" role="region" aria-label="Live tickers">
      <div className="relative flex-1 overflow-hidden">
        {reduce ? (
          <div className="flex flex-wrap">{items}</div>
        ) : (
          <div className={cn('qp-marquee flex w-max', paused && '[animation-play-state:paused]')} aria-live="off">
            <div className="flex">{items}</div>
            <div className="flex" aria-hidden>
              {items}
            </div>
          </div>
        )}
      </div>
      {!reduce && (
        <IconButton label={paused ? 'Resume ticker' : 'Pause ticker'} onClick={onToggle} className="mx-2 shrink-0">
          {paused ? <Play size={14} strokeWidth={1.5} aria-hidden /> : <Pause size={14} strokeWidth={1.5} aria-hidden />}
        </IconButton>
      )}
      <span className="sr-only">
        {rows.map((r) => `${r.symbol} ${fmtPrice(r.price)} ${r.change >= 0 ? 'up' : 'down'} ${Math.abs(r.change * 100).toFixed(2)} percent`).join('; ')}
      </span>
    </div>
  );
}

