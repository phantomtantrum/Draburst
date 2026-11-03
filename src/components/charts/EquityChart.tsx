'use client';

import { useMemo, useState } from 'react';
import { scaleLinear, scaleLog, scaleUtc } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { useSize } from '@/lib/hooks/useSize';
import { fmtDate, fmtPct, fmtPrice } from '@/lib/format';
import { AxisLeft, ChartDefs, MARGIN, Readout, thinTicks } from './primitives';

/**
 * Equity (solid) vs benchmark (dotted) on a log axis, trade glyphs
 * (▲ entry solid, ▽ exit outlined), and an underwater drawdown panel
 * (--loss tinted area) sharing the time axis.
 */
export function EquityChart({
  t,
  equity,
  benchmark,
  drawdown,
  trades = [],
  height = 420,
  log = true,
}: {
  t: ArrayLike<number>;
  equity: Float64Array;
  benchmark: Float64Array;
  drawdown: Float64Array;
  trades?: Array<{ entryIndex: number; exitIndex: number; reason: string }>;
  height?: number;
  log?: boolean;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [cur, setCur] = useState<number | null>(null);
  const n = equity.length;
  const iw = Math.max(10, width - MARGIN.left - MARGIN.right);
  const topH = Math.round((height - MARGIN.top - MARGIN.bottom - 16) * 0.68);
  const ddH = height - MARGIN.top - MARGIN.bottom - 16 - topH;
  const idx = useMemo(() => Array.from({ length: n }, (_, i) => i), [n]);

  const { x, y, yd } = useMemo(() => {
    let lo = Infinity,
      hi = -Infinity,
      dmin = 0;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, equity[i]!, benchmark[i]!);
      hi = Math.max(hi, equity[i]!, benchmark[i]!);
      dmin = Math.min(dmin, drawdown[i]!);
    }
    return {
      x: scaleUtc().domain([new Date(t[0]!), new Date(t[n - 1]!)]).range([0, iw]),
      y: (log ? scaleLog() : scaleLinear()).domain([Math.max(lo * 0.95, 1e-6), hi * 1.05]).range([topH, 0]),
      yd: scaleLinear().domain([Math.min(dmin, -0.01), 0]).range([ddH, 0]).nice(),
    };
  }, [t, equity, benchmark, drawdown, n, iw, topH, ddH, log]);

  const X = (i: number) => x(new Date(t[i]!));
  const eqPath = d3line<number>().x(X).y((i) => y(Math.max(equity[i]!, 1e-6)))(idx) ?? '';
  const bmPath = d3line<number>().x(X).y((i) => y(Math.max(benchmark[i]!, 1e-6)))(idx) ?? '';
  const ddArea = d3area<number>().x(X).y0(0).y1((i) => yd(drawdown[i]!))(idx) ?? '';
  const ddLine = d3line<number>().x(X).y((i) => yd(drawdown[i]!))(idx) ?? '';
  const ci = cur ?? n - 1;
  const xticks = x.ticks(Math.max(2, Math.floor(iw / 110)));
  const showTrades = trades.length <= 400;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <>
          {(cur != null || width >= 560) && (
            <Readout
              lines={[
                ['DATE', fmtDate(t[ci]!)],
                ['STRATEGY', fmtPrice(equity[ci])],
                ['BENCH', fmtPrice(benchmark[ci])],
                ['DD', fmtPct(drawdown[ci], 1)],
              ]}
            />
          )}
          <svg
            width={width}
            height={height}
            role="img"
            tabIndex={0}
            aria-label={`Equity curve from ${fmtDate(t[0]!)} to ${fmtDate(t[n - 1]!)}: strategy ends at ${fmtPrice(equity[n - 1])}, benchmark at ${fmtPrice(
              benchmark[n - 1],
            )}; maximum drawdown ${fmtPct(Math.min(...Array.from(drawdown)), 1)}.`}
            className="block text-muted outline-none focus-visible:outline-2"
            onPointerLeave={() => setCur(null)}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const d = x.invert(e.clientX - r.left - MARGIN.left).getTime();
              let lo = 0,
                hi = n - 1;
              while (lo < hi) {
                const m = (lo + hi) >> 1;
                if (t[m]! < d) lo = m + 1;
                else hi = m;
              }
              setCur(Math.min(n - 1, Math.max(0, lo)));
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 20 : 1;
              if (e.key === 'ArrowLeft') setCur(Math.max(0, ci - step));
              if (e.key === 'ArrowRight') setCur(Math.min(n - 1, ci + step));
            }}
          >
            <ChartDefs />
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              <AxisLeft scale={y} width={iw} ticks={5} format={(v) => fmtPrice(v)} />
              <path d={bmPath} fill="none" stroke="var(--fg-muted)" strokeWidth={1.25} strokeDasharray="1 3" />
              <path d={eqPath} fill="none" stroke="var(--fg)" strokeWidth={1.75} />
              {showTrades &&
                trades.map((tr, k) => (
                  <g key={k}>
                    <path d={`M${X(tr.entryIndex)},${y(equity[tr.entryIndex]!) + 5}l4,7h-8z`} fill="var(--gain)" />
                    <path
                      d={`M${X(tr.exitIndex)},${y(equity[tr.exitIndex]!) - 5}l4,-7h-8z`}
                      fill="var(--bg)"
                      stroke={tr.reason === 'stop' ? 'var(--loss)' : 'var(--fg)'}
                      strokeDasharray={tr.reason === 'stop' ? '2 1' : undefined}
                    />
                  </g>
                ))}
              <text x={iw - 6} y={12} textAnchor="end" className="label" fill="var(--fg-muted)">
                EQUITY · {log ? 'LOG' : 'LINEAR'}
              </text>
              <g transform={`translate(0,${topH + 16})`}>
                {thinTicks(yd, 3).map((v) => (
                  <g key={v} transform={`translate(0,${yd(v)})`} aria-hidden>
                    <line x2={iw} stroke="var(--rule)" />
                    <text x={-6} dy="0.32em" textAnchor="end" className="num" fontSize={11} fill="var(--fg-muted)">
                      {fmtPct(v, 0)}
                    </text>
                  </g>
                ))}
                <path d={ddArea} fill="var(--loss)" fillOpacity={0.16} />
                <path d={ddLine} fill="none" stroke="var(--loss)" strokeWidth={1} />
                <text x={6} y={ddH - 6} className="label" fill="var(--fg-muted)">
                  DRAWDOWN
                </text>
                <g transform={`translate(0,${ddH})`} aria-hidden>
                  <line x2={iw} stroke="var(--rule-strong)" />
                  {xticks.map((d) => (
                    <g key={d.getTime()} transform={`translate(${x(d)},0)`}>
                      <line y2={4} stroke="var(--rule-strong)" />
                      <text y={16} textAnchor="middle" className="num" fontSize={11} fill="var(--fg-muted)">
                        {d.toISOString().slice(0, 7)}
                      </text>
                    </g>
                  ))}
                </g>
              </g>
              {cur != null && <line x1={X(ci)} x2={X(ci)} y1={0} y2={topH + 16 + ddH} stroke="var(--fg)" />}
            </g>
          </svg>
          <div className="label mt-1 flex flex-wrap gap-x-4 pl-20 text-muted max-sm:pl-0" aria-hidden>
            <span>━ STRATEGY</span>
            <span>┈ BENCHMARK</span>
            {showTrades && trades.length > 0 && <span>▲ ENTRY · ▽ EXIT · ⬚ STOP</span>}
          </div>
        </>
      )}
    </div>
  );
}
