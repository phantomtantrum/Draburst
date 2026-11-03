'use client';

import { useState } from 'react';
import { fmtNum } from '@/lib/format';
import { ChartDefs } from './primitives';

/**
 * Accessible 2D twin of the 3D Sharpe surface. Cells are a grid of buttons:
 * arrow keys move, Enter/click loads that parameter set.
 */
export function SweepHeatmap({
  xs,
  ys,
  values,
  xLabel,
  yLabel,
  current,
  onPick,
  fmtX = (v) => String(v),
  fmtY = (v) => String(v),
}: {
  xs: number[];
  ys: number[];
  values: Float64Array;
  xLabel: string;
  yLabel: string;
  current: { x: number; y: number } | null;
  onPick: (x: number, y: number) => void;
  fmtX?: (v: number) => string;
  fmtY?: (v: number) => string;
}) {
  const nx = xs.length,
    ny = ys.length;
  const [focus, setFocus] = useState<[number, number]>([0, 0]);
  const [within, setWithin] = useState(false);
  const finite = Array.from(values).filter(Number.isFinite);
  const max = Math.max(0.01, ...finite.map(Math.abs));
  const cell = nx <= 16 ? 22 : 14;
  const left = 56,
    top = 8,
    bottom = 36;
  let best = -1;
  values.forEach((v, i) => {
    if (Number.isFinite(v) && (best < 0 || v > values[best]!)) best = i;
  });
  return (
    <div className="overflow-x-auto">
      <svg width={left + nx * cell + 8} height={top + ny * cell + bottom} className="block">
        <ChartDefs />
        <g role="grid" onFocus={() => setWithin(true)} onBlur={() => setWithin(false)} aria-label={`Sharpe ratio sweep over ${xLabel} and ${yLabel}. Arrow keys move; Enter loads the parameters.`}>
          {ys.map((yv, j) => (
            <g key={j} role="row">
              {xs.map((xv, i) => {
                const v = values[j * nx + i]!;
                const ok = Number.isFinite(v);
                const g = ok ? Math.round(28 + 210 * Math.min(1, Math.abs(v) / max)) : 0;
                const fill = `rgb(${g},${g},${g})`;
                const isCur = current && current.x === xv && current.y === yv;
                const isFocus = focus[0] === i && focus[1] === j;
                const row = ny - 1 - j;
                return (
                  <g
                    key={i}
                    role="gridcell"
                    tabIndex={isFocus ? 0 : -1}
                    aria-label={`${xLabel} ${fmtX(xv)}, ${yLabel} ${fmtY(yv)}: Sharpe ${ok ? fmtNum(v, 2) : 'not valid'}`}
                    aria-selected={!!isCur}
                    className="cursor-pointer outline-none"
                    transform={`translate(${left + i * cell},${top + row * cell})`}
                    onClick={() => ok && onPick(xv, yv)}
                    onFocus={() => setFocus([i, j])}
                    onKeyDown={(e) => {
                      let [a, b] = focus;
                      if (e.key === 'ArrowRight') a = Math.min(nx - 1, a + 1);
                      else if (e.key === 'ArrowLeft') a = Math.max(0, a - 1);
                      else if (e.key === 'ArrowUp') b = Math.min(ny - 1, b + 1);
                      else if (e.key === 'ArrowDown') b = Math.max(0, b - 1);
                      else if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (ok) onPick(xv, yv);
                        return;
                      } else return;
                      e.preventDefault();
                      setFocus([a, b]);
                      const el = (e.currentTarget.ownerSVGElement?.querySelectorAll('[role=gridcell]') ?? [])[b * nx + a] as SVGGElement | undefined;
                      el?.focus();
                    }}
                  >
                    {!ok ? (
                      <rect width={cell - 1} height={cell - 1} fill="var(--bg)" stroke="var(--rule)" />
                    ) : v >= 0 ? (
                      <rect width={cell - 1} height={cell - 1} fill={fill} />
                    ) : (
                      <rect width={cell - 1} height={cell - 1} fill="url(#qp-hatch-dense)" color={fill} stroke={fill} />
                    )}
                    {isCur && <rect x={1.5} y={1.5} width={cell - 4} height={cell - 4} fill="none" stroke="var(--fg)" strokeWidth={2} />}
                    {isCur && <rect x={3} y={3} width={cell - 7} height={cell - 7} fill="none" stroke="var(--bg)" strokeWidth={1} />}
                    {isFocus && within && <rect x={-1} y={-1} width={cell + 1} height={cell + 1} fill="none" stroke="var(--fg)" strokeWidth={1.5} strokeDasharray="2 2" />}
                    {j * nx + i === best && <circle cx={(cell - 1) / 2} cy={(cell - 1) / 2} r={2.5} fill="var(--bg)" stroke="var(--fg)" />}
                  </g>
                );
              })}
            </g>
          ))}
        </g>
        {ys.map((yv, j) =>
          j % Math.ceil(ny / 6) === 0 ? (
            <text key={j} x={left - 6} y={top + (ny - 1 - j) * cell + cell / 2} dy="0.32em" textAnchor="end" className="num" fontSize={10} fill="var(--fg-muted)">
              {fmtY(yv)}
            </text>
          ) : null,
        )}
        {xs.map((xv, i) =>
          i % Math.ceil(nx / 6) === 0 ? (
            <text key={i} x={left + i * cell + cell / 2} y={top + ny * cell + 14} textAnchor="middle" className="num" fontSize={10} fill="var(--fg-muted)">
              {fmtX(xv)}
            </text>
          ) : null,
        )}
        <text x={left + (nx * cell) / 2} y={top + ny * cell + 30} textAnchor="middle" className="label" fill="var(--fg-muted)">
          {xLabel} →
        </text>
      </svg>
      <p className="label mt-1 text-muted">
        ↑ {yLabel} · SHADE = |SHARPE| · HATCH = SHARPE &lt; 0 · ◯ BEST CELL · ▣ CURRENT
      </p>
    </div>
  );
}
