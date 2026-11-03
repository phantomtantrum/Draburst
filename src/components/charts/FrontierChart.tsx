'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { line as d3line } from 'd3-shape';
import { useSize } from '@/lib/hooks/useSize';
import { fmtPct, fmtNum } from '@/lib/format';
import { AxisBottom, AxisLeft, ChartDefs, MARGIN } from './primitives';

export interface FrontierPoint {
  ret: number;
  vol: number;
  sharpe: number;
  weights: ArrayLike<number>;
}
export interface Marker extends FrontierPoint {
  key: string;
  label: string;
  glyph: 'square' | 'disc' | 'diamond' | 'ring';
}

/**
 * Risk × return. Random portfolios on a canvas (luminance ∝ Sharpe — not hue),
 * efficient frontier solid white, inefficient lower branch omitted, named
 * portfolios as distinct glyphs (■ ● ◆ ○). Hover shows the nearest point's weights.
 */
export function FrontierChart({
  cloud,
  frontier,
  markers,
  symbols,
  rf,
  height = 380,
}: {
  cloud: { ret: Float32Array; vol: Float32Array; sharpe: Float32Array; weights: Float32Array };
  frontier: FrontierPoint[];
  markers: Marker[];
  symbols: string[];
  rf: number;
  height?: number;
}) {
  const [ref, { width }] = useSize<HTMLDivElement>();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<{ x: number; y: number; p: FrontierPoint; label: string } | null>(null);
  const iw = Math.max(10, width - MARGIN.left - MARGIN.right);
  const ih = height - MARGIN.top - MARGIN.bottom;
  const N = symbols.length;

  const { x, y, sMin, sMax } = useMemo(() => {
    let vMax = 0,
      rMin = Infinity,
      rMax = -Infinity,
      sMin = Infinity,
      sMax = -Infinity;
    for (let i = 0; i < cloud.vol.length; i++) {
      vMax = Math.max(vMax, cloud.vol[i]!);
      rMin = Math.min(rMin, cloud.ret[i]!);
      rMax = Math.max(rMax, cloud.ret[i]!);
      sMin = Math.min(sMin, cloud.sharpe[i]!);
      sMax = Math.max(sMax, cloud.sharpe[i]!);
    }
    for (const p of [...frontier, ...markers]) {
      vMax = Math.max(vMax, p.vol);
      rMin = Math.min(rMin, p.ret);
      rMax = Math.max(rMax, p.ret);
    }
    const pad = (rMax - rMin) * 0.06 || 0.01;
    return {
      x: scaleLinear().domain([0, vMax * 1.05]).range([0, iw]).nice(),
      y: scaleLinear().domain([rMin - pad, rMax + pad]).range([ih, 0]).nice(),
      sMin,
      sMax,
    };
  }, [cloud, frontier, markers, iw, ih]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = iw * dpr;
    c.height = ih * dpr;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, iw, ih);
    const span = sMax - sMin || 1;
    for (let i = 0; i < cloud.vol.length; i++) {
      const l = 0.25 + 0.75 * ((cloud.sharpe[i]! - sMin) / span);
      const g = Math.round(l * 255);
      ctx.fillStyle = `rgba(${g},${g},${g},0.55)`;
      ctx.fillRect(x(cloud.vol[i]!) - 0.75, y(cloud.ret[i]!) - 0.75, 1.5, 1.5);
    }
  }, [cloud, x, y, iw, ih, width, sMin, sMax]);

  const front = d3line<FrontierPoint>()
    .x((p) => x(p.vol))
    .y((p) => y(p.ret))(frontier);
  const ms = markers.find((m) => m.key === 'maxsharpe');
  const cml = ms && ms.vol > 0 ? { x2: x.domain()[1]!, y2: rf + ((ms.ret - rf) / ms.vol) * x.domain()[1]! } : null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - MARGIN.left,
      py = e.clientY - r.top - MARGIN.top;
    let best = -1,
      bd = 64;
    for (let i = 0; i < cloud.vol.length; i++) {
      const d = (x(cloud.vol[i]!) - px) ** 2 + (y(cloud.ret[i]!) - py) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    for (const m of markers) {
      const d = (x(m.vol) - px) ** 2 + (y(m.ret) - py) ** 2;
      if (d < 100) {
        setHover({ x: px, y: py, p: m, label: m.label });
        return;
      }
    }
    if (best < 0) return setHover(null);
    setHover({
      x: px,
      y: py,
      label: 'RANDOM',
      p: { ret: cloud.ret[best]!, vol: cloud.vol[best]!, sharpe: cloud.sharpe[best]!, weights: cloud.weights.subarray(best * N, (best + 1) * N) },
    });
  };

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <>
          <canvas
            ref={canvas}
            aria-hidden
            className="absolute"
            style={{ left: MARGIN.left, top: MARGIN.top, width: iw, height: ih }}
          />
          <svg
            width={width}
            height={height}
            className="relative block text-muted"
            role="img"
            aria-label={`Efficient frontier with ${cloud.vol.length} random portfolios. ${markers
              .map((m) => `${m.label}: return ${fmtPct(m.ret, 1)}, volatility ${fmtPct(m.vol, 1)}, Sharpe ${fmtNum(m.sharpe, 2)}`)
              .join('; ')}.`}
            onPointerMove={onMove}
            onPointerLeave={() => setHover(null)}
          >
            <ChartDefs />
            <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
              <AxisLeft scale={y} width={iw} ticks={5} format={(v) => fmtPct(v, 0)} />
              <AxisBottom scale={x} height={ih} ticks={Math.max(2, Math.floor(iw / 80))} format={(v) => fmtPct(v, 0)} />
              <text x={iw} y={ih - 6} textAnchor="end" className="label" fill="var(--fg-muted)">
                VOLATILITY <tspan style={{ textTransform: 'none' }}>σ</tspan> →
              </text>
              <text x={6} y={10} className="label" fill="var(--fg-muted)">
                ↑ RETURN <tspan style={{ textTransform: 'none' }}>μ</tspan>
              </text>
              {cml && (
                <line x1={x(0)} y1={y(rf)} x2={x(cml.x2)} y2={y(cml.y2)} stroke="var(--fg-muted)" strokeDasharray="1 3" />
              )}
              <path d={front ?? ''} fill="none" stroke="var(--fg)" strokeWidth={2.5} />
              {markers.map((m) => (
                <Glyph key={m.key} cx={x(m.vol)} cy={y(m.ret)} glyph={m.glyph} />
              ))}
              {hover && <circle cx={x(hover.p.vol)} cy={y(hover.p.ret)} r={6} fill="none" stroke="var(--fg)" />}
            </g>
          </svg>
          {hover && (
            <div
              className="pointer-events-none absolute z-[2] min-w-40 border border-rule-strong bg-bg px-2 py-1.5"
              style={{ left: Math.min(width - 180, hover.x + MARGIN.left + 12), top: Math.max(0, hover.y + MARGIN.top - 10) }}
            >
              <p className="label mb-1 text-fg">{hover.label}</p>
              <p className="num text-[12px] text-muted">
                μ {fmtPct(hover.p.ret, 1)} · σ {fmtPct(hover.p.vol, 1)} · SR {fmtNum(hover.p.sharpe, 2)}
              </p>
              <WeightsMini weights={hover.p.weights} symbols={symbols} />
            </div>
          )}
          <div className="label mt-1 flex flex-wrap gap-x-4 gap-y-1 pl-20 text-muted max-sm:pl-0" aria-hidden>
            {markers.map((m) => (
              <span key={m.key} className="flex items-center gap-1.5">
                <svg width="12" height="12">
                  <Glyph cx={6} cy={6} glyph={m.glyph} size={4} />
                </svg>
                {m.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--fg)" strokeWidth="2.5" /></svg>FRONTIER
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="18" height="6"><line x1="0" y1="3" x2="18" y2="3" stroke="var(--fg-muted)" strokeDasharray="1 3" /></svg>CML
            </span>
            <span>· BRIGHTER = HIGHER SHARPE</span>
          </div>
        </>
      )}
    </div>
  );
}

export function WeightsMini({ weights, symbols, top = 6 }: { weights: ArrayLike<number>; symbols: string[]; top?: number }) {
  const rows = symbols.map((s, i) => ({ s, w: weights[i]! })).sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const shown = rows.slice(0, top);
  const rest = rows.slice(top).reduce((a, r) => a + r.w, 0);
  return (
    <table className="mt-1 w-full">
      <tbody>
        {shown.map((r) => (
          <tr key={r.s} className="num text-[12px]">
            <td className="pr-3 text-muted">{r.s}</td>
            <td className="text-right text-fg">{fmtPct(r.w, 1)}</td>
          </tr>
        ))}
        {rows.length > top && (
          <tr className="num text-[12px]">
            <td className="pr-3 text-muted">OTHERS</td>
            <td className="text-right text-fg">{fmtPct(rest, 1)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function Glyph({ cx, cy, glyph, size = 6 }: { cx: number; cy: number; glyph: Marker['glyph']; size?: number }) {
  const s = size;
  switch (glyph) {
    case 'square':
      return <rect x={cx - s} y={cy - s} width={2 * s} height={2 * s} fill="var(--fg)" stroke="var(--bg)" strokeWidth={1} />;
    case 'disc':
      return <circle cx={cx} cy={cy} r={s + 1} fill="var(--fg)" stroke="var(--bg)" strokeWidth={1} />;
    case 'diamond':
      return <path d={`M${cx},${cy - s - 1}L${cx + s + 1},${cy}L${cx},${cy + s + 1}L${cx - s - 1},${cy}Z`} fill="var(--fg)" stroke="var(--bg)" strokeWidth={1} />;
    case 'ring':
      return <circle cx={cx} cy={cy} r={s} fill="var(--bg)" stroke="var(--fg)" strokeWidth={2} />;
  }
}
