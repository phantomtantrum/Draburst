'use client';

import { useMemo } from 'react';
import { scaleLinear } from 'd3-scale';
import { useSize } from '@/lib/hooks/useSize';
import { fmtPct, fmtPrice } from '@/lib/format';
import { AxisBottom, ChartDefs, MARGIN } from './primitives';

/**
 * Terminal distribution. Bins at/above S₀: solid --gain. Below S₀: --loss, hatched.
 */
export function Histogram({
  edges,
  counts,
  s0,
  target,
  markers = [],
  height = 260,
}: {
  edges: Float64Array;
  counts: Uint32Array;
  s0: number;
  target: number | null;
  markers?: Array<{ value: number; label: string }>;
  height?: number;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const iw = Math.max(10, width - MARGIN.left - MARGIN.right);
  const ih = height - MARGIN.top - MARGIN.bottom;
  const total = counts.reduce((a, b) => a + b, 0);
  const { x, y } = useMemo(() => {
    const lo = Math.min(edges[0]!, target ?? Infinity, s0);
    const hi = Math.max(edges[edges.length - 1]!, target ?? -Infinity, s0);
    const max = Math.max(...Array.from(counts));
    return {
      x: scaleLinear().domain([lo, hi]).range([0, iw]),
      y: scaleLinear().domain([0, max / total]).range([ih, 0]).nice(),
    };
  }, [edges, counts, iw, ih, s0, target, total]);

  const below = counts.reduce((acc, c, i) => acc + ((edges[i]! + edges[i + 1]!) / 2 < s0 ? c : 0), 0);
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`Histogram of terminal prices: ${counts.length} bins between ${fmtPrice(edges[0])} and ${fmtPrice(edges[edges.length - 1])}. ${fmtPct(
            below / total,
            1,
          )} of paths end below the start price ${fmtPrice(s0)}.`}
          className="block text-muted"
        >
          <ChartDefs />
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
            {y.ticks(4).map((v) => (
              <g key={v} transform={`translate(0,${y(v)})`} aria-hidden>
                <line x2={iw} stroke="var(--rule)" />
                <text x={-6} dy="0.32em" textAnchor="end" className="num" fontSize={11} fill="var(--fg-muted)">
                  {fmtPct(v, 1)}
                </text>
              </g>
            ))}
            <AxisBottom scale={x} height={ih} ticks={Math.max(2, Math.floor(iw / 90))} format={fmtPrice} />
            {Array.from(counts).map((c, i) => {
              const x0 = x(edges[i]!),
                x1 = x(edges[i + 1]!);
              const mid = (edges[i]! + edges[i + 1]!) / 2;
              const up = mid >= s0;
              const h = ih - y(c / total);
              return (
                <rect
                  key={i}
                  x={x0 + 0.5}
                  y={ih - h}
                  width={Math.max(0.5, x1 - x0 - 1)}
                  height={h}
                  fill={up ? 'var(--gain)' : 'url(#qp-hatch)'}
                  fillOpacity={up ? 0.8 : 1}
                  color="var(--loss)"
                  stroke={up ? 'none' : 'var(--loss)'}
                  strokeWidth={up ? 0 : 0.75}
                />
              );
            })}
            <line x1={x(s0)} x2={x(s0)} y1={0} y2={ih} stroke="var(--fg)" strokeDasharray="1 2" />
            <text x={x(s0) + 4} y={10} className="label" fill="var(--fg-muted)">
              S₀
            </text>
            {target != null && (
              <>
                <line x1={x(target)} x2={x(target)} y1={0} y2={ih} stroke="var(--fg)" strokeDasharray="6 3" />
                <text x={x(target) + 4} y={22} className="label" fill="var(--fg)">
                  TARGET
                </text>
              </>
            )}
            {markers.map((m) => (
              <g key={m.label} transform={`translate(${x(m.value)},0)`} aria-hidden>
                <line y1={ih - 8} y2={ih} stroke="var(--fg)" strokeWidth={1.5} />
                <text y={ih - 12} textAnchor="middle" className="label" fontSize={10} fill="var(--fg-muted)">
                  {m.label}
                </text>
              </g>
            ))}
          </g>
        </svg>
      )}
    </div>
  );
}
