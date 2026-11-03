'use client';

import { Sym } from '@/components/ui/Sym';
import { fmtNum } from '@/lib/format';
import { ChartDefs } from './primitives';

/**
 * Correlation matrix: luminance = |ρ|, 45° hatch = negative ρ, value printed
 * in every cell (MASTER §6 — heatmaps never rely on shading alone).
 */
export function CorrHeatmap({ corr, symbols }: { corr: number[][]; symbols: string[] }) {
  const n = symbols.length;
  const cell = n <= 6 ? 56 : n <= 10 ? 44 : 32;
  const left = 56,
    top = 24;
  const size = left + n * cell;
  return (
    <div className="overflow-x-auto">
      <svg width={size + 4} height={top + n * cell + 4} role="img" aria-label={`Correlation matrix of ${n} assets. Use the data table for exact values.`} className="text-fg">
        <ChartDefs />
        {symbols.map((s, j) => (
          <text key={'c' + s} x={left + j * cell + cell / 2} y={top - 8} textAnchor="middle" className="num" fontSize={10} fill="var(--fg-muted)">
            {s}
          </text>
        ))}
        {symbols.map((s, i) => (
          <g key={'r' + s}>
            <text x={left - 8} y={top + i * cell + cell / 2} dy="0.32em" textAnchor="end" className="num" fontSize={10} fill="var(--fg-muted)">
              {s}
            </text>
            {symbols.map((_, j) => {
              const v = corr[i]![j]!;
              const a = Math.abs(v);
              const g = Math.round(20 + 215 * a);
              const fill = `rgb(${g},${g},${g})`;
              const dark = g > 140;
              return (
                <g key={j} transform={`translate(${left + j * cell},${top + i * cell})`}>
                  <rect width={cell - 1} height={cell - 1} fill={v < 0 ? 'var(--bg)' : fill} />
                  {v < 0 && <rect width={cell - 1} height={cell - 1} fill="url(#qp-hatch)" color={fill} stroke={fill} strokeWidth={1} />}
                  <text
                    x={cell / 2}
                    y={cell / 2}
                    dy="0.32em"
                    textAnchor="middle"
                    className="num"
                    fontSize={cell >= 44 ? 11 : 9}
                    fill={v < 0 ? 'var(--fg)' : dark ? 'var(--qp-black)' : 'var(--fg)'}
                    style={v < 0 ? { paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 } : undefined}
                  >
                    {fmtNum(v, 2)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <p className="label mt-2 text-muted">SHADE = |<Sym>ρ</Sym>| · HATCH = <Sym>ρ</Sym> &lt; 0 · VALUE PRINTED</p>
    </div>
  );
}
