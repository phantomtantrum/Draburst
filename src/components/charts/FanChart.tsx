'use client';

import { useMemo, useState } from 'react';
import { scaleLinear, scaleLog } from 'd3-scale';
import { area as d3area, line as d3line } from 'd3-shape';
import { useSize } from '@/lib/hooks/useSize';
import { fmtPrice } from '@/lib/format';
import { AxisBottom, AxisLeft, ChartDefs, MARGIN, Readout } from './primitives';

export interface FanData {
  grid: Int32Array;
  /** [p5, p25, p50, p75, p95] */
  bands: Float64Array[];
  meanPath: Float64Array;
  s0: number;
  target: number | null;
  /** sample paths, row-major count × grid.length */
  paths?: Float32Array;
  pathCount?: number;
}

/**
 * Percentile fan: 5–95 sparse dither, 25–75 dense dither, median solid 2px,
 * mean dotted. Sample paths ending above S0 are --gain, below are --loss and
 * dashed (MASTER §6).
 * Keyboard: focus the chart, ←/→ move the crosshair.
 */
export function FanChart({ data, height = 340, log = true, maxPaths = 120 }: { data: FanData; height?: number; log?: boolean; maxPaths?: number }) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const [cursor, setCursor] = useState<number | null>(null);
  const G = data.grid.length;
  const H = data.grid[G - 1]!;
  const iw = Math.max(10, width - MARGIN.left - MARGIN.right);
  const ih = height - MARGIN.top - MARGIN.bottom;

  const { x, y, paths } = useMemo(() => {
    const lo = Math.min(data.bands[0]![G - 1]!, ...Array.from(data.bands[0]!), data.target ?? Infinity) * 0.97;
    const hi = Math.max(data.bands[4]![G - 1]!, ...Array.from(data.bands[4]!), data.target ?? -Infinity) * 1.03;
    const x = scaleLinear().domain([0, H]).range([0, iw]);
    const y = (log ? scaleLog() : scaleLinear()).domain([Math.max(lo, 1e-9), hi]).range([ih, 0]).nice();
    const lineGen = d3line<number>()
      .x((_, i) => x(data.grid[i]!))
      .y((v) => y(Math.max(v, 1e-9)));
    const n = Math.min(maxPaths, data.pathCount ?? 0);
    const paths: Array<{ d: string; down: boolean }> = [];
    if (data.paths && n > 0) {
      const step = (data.pathCount ?? n) / n;
      for (let k = 0; k < n; k++) {
        const i = Math.floor(k * step);
        const row = Array.from(data.paths.subarray(i * G, (i + 1) * G));
        paths.push({ d: lineGen(row) ?? '', down: row[G - 1]! < data.s0 });
      }
    }
    return { x, y, paths };
  }, [data, G, H, iw, ih, log, maxPaths]);

  const band = (lo: Float64Array, hi: Float64Array) =>
    d3area<number>()
      .x((_, i) => x(data.grid[i]!))
      .y0((_, i) => y(lo[i]!))
      .y1((_, i) => y(hi[i]!))(Array.from(lo)) ?? '';
  const lineOf = (arr: Float64Array) =>
    d3line<number>()
      .x((_, i) => x(data.grid[i]!))
      .y((v) => y(v))(Array.from(arr)) ?? '';

  const ci = cursor ?? G - 1;
  const label = `Percentile fan chart over ${H} periods. At horizon: 5th percentile ${fmtPrice(data.bands[0]![G - 1])}, median ${fmtPrice(
    data.bands[2]![G - 1],
  )}, 95th percentile ${fmtPrice(data.bands[4]![G - 1])}. Start ${fmtPrice(data.s0)}.`;

  return (
    <div className="w-full text-muted">
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <>
          {(cursor != null || width >= 560) && <Readout
            lines={[
              ['T+', String(data.grid[ci])],
              ['P95', fmtPrice(data.bands[4]![ci])],
              ['P75', fmtPrice(data.bands[3]![ci])],
              ['P50', fmtPrice(data.bands[2]![ci])],
              ['P25', fmtPrice(data.bands[1]![ci])],
              ['P5', fmtPrice(data.bands[0]![ci])],
            ]}
          />}
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={label}
            tabIndex={0}
            className="block outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            onPointerLeave={() => setCursor(null)}
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const px = e.clientX - r.left - MARGIN.left;
              const step = x.invert(px);
              let best = 0;
              for (let i = 0; i < G; i++) if (Math.abs(data.grid[i]! - step) < Math.abs(data.grid[best]! - step)) best = i;
              setCursor(best);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') setCursor(Math.max(0, ci - 1));
              if (e.key === 'ArrowRight') setCursor(Math.min(G - 1, ci + 1));
              if (e.key === 'Home') setCursor(0);
              if (e.key === 'End') setCursor(G - 1);
            }}
          >
            <ChartDefs />
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              <AxisLeft scale={y} width={iw} ticks={5} format={fmtPrice} />
              <AxisBottom scale={x} height={ih} ticks={Math.max(2, Math.floor(iw / 80))} format={(v) => `T+${v}`} />
              <g>
                {paths.map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    fill="none"
                    stroke={p.down ? 'var(--loss)' : 'var(--gain)'}
                    strokeOpacity={0.28}
                    strokeWidth={0.75}
                    strokeDasharray={p.down ? '3 2' : undefined}
                  />
                ))}
              </g>
              <path d={band(data.bands[0]!, data.bands[4]!)} fill="url(#qp-dither-sparse)" color="var(--fg-muted)" />
              <path d={band(data.bands[1]!, data.bands[3]!)} fill="url(#qp-dither-dense)" color="var(--fg-muted)" opacity={0.9} />
              <path d={lineOf(data.bands[0]!)} fill="none" stroke="var(--fg-muted)" strokeWidth={1} strokeDasharray="4 3" />
              <path d={lineOf(data.bands[4]!)} fill="none" stroke="var(--fg-muted)" strokeWidth={1} />
              <path d={lineOf(data.meanPath)} fill="none" stroke="var(--fg-body)" strokeWidth={1} strokeDasharray="1 3" />
              <path d={lineOf(data.bands[2]!)} fill="none" stroke="var(--fg)" strokeWidth={2} />
              <line x1={0} x2={iw} y1={y(data.s0)} y2={y(data.s0)} stroke="var(--fg)" strokeWidth={1} strokeDasharray="1 2" />
              <text x={iw} y={y(data.s0) - 4} textAnchor="end" className="label" fill="var(--fg-muted)">
                S₀ {fmtPrice(data.s0)}
              </text>
              {data.target != null && (
                <>
                  <line x1={0} x2={iw} y1={y(data.target)} y2={y(data.target)} stroke="var(--fg)" strokeWidth={1} strokeDasharray="6 3" />
                  <text x={iw} y={y(data.target) - 4} textAnchor="end" className="label" fill="var(--fg)">
                    TARGET {fmtPrice(data.target)}
                  </text>
                </>
              )}
              {cursor != null && <line x1={x(data.grid[ci]!)} x2={x(data.grid[ci]!)} y1={0} y2={ih} stroke="var(--fg)" strokeWidth={1} />}
            </g>
          </svg>
        </>
      )}
    </div>
    <Legend />
    </div>
  );
}

function Legend() {
  const item = 'flex items-center gap-1.5';
  return (
    <div className="label mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-20 text-muted max-sm:pl-0" aria-hidden>
      <span className={item}>
        <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--fg)" strokeWidth="2" /></svg>P50
      </span>
      <span className={item}>
        <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--fg-body)" strokeDasharray="1 3" /></svg>MEAN
      </span>
      <span className={item}>
        <svg width="12" height="10" color="var(--fg-muted)"><ChartDefs /><rect width="12" height="10" fill="url(#qp-dither-dense)" /></svg>P25–75
      </span>
      <span className={item}>
        <svg width="12" height="10" color="var(--fg-muted)"><ChartDefs /><rect width="12" height="10" fill="url(#qp-dither-sparse)" /></svg>P5–95
      </span>
      <span className={item}>
        <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--gain)" /></svg>PATH ≥ S₀
      </span>
      <span className={item}>
        <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--loss)" strokeDasharray="3 2" /></svg>PATH &lt; S₀
      </span>
    </div>
  );
}
