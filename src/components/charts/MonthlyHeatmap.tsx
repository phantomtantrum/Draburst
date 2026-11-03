import { fmtNum } from '@/lib/format';
import type { MonthlyReturn } from '@/lib/quant/backtest';
import { ChartDefs } from './primitives';

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Years × months; luminance = |return|, hatch = negative, value printed. */
export function MonthlyHeatmap({ monthly }: { monthly: MonthlyReturn[] }) {
  if (!monthly.length) return null;
  const years = Array.from(new Set(monthly.map((m) => m.year))).sort();
  const map = new Map(monthly.map((m) => [`${m.year}-${m.month}`, m.ret]));
  const yearRet = (y: number) => monthly.filter((m) => m.year === y).reduce((a, m) => a * (1 + m.ret), 1) - 1;
  const maxAbs = Math.max(0.01, ...monthly.map((m) => Math.abs(m.ret)));
  const cw = 46,
    ch = 24,
    left = 44,
    top = 18;
  return (
    <div className="overflow-x-auto">
      <svg width={left + 13 * cw + 8} height={top + years.length * ch + 4} role="img" aria-label={`Monthly returns for ${years.length} years. See the table view for exact values.`}>
        <ChartDefs />
        {MONTHS.map((m, i) => (
          <text key={i} x={left + i * cw + cw / 2} y={12} textAnchor="middle" className="num" fontSize={10} fill="var(--fg-muted)">
            {m}
          </text>
        ))}
        <text x={left + 12 * cw + cw / 2} y={12} textAnchor="middle" className="label" fontSize={10} fill="var(--fg)">
          YEAR
        </text>
        {years.map((y, r) => (
          <g key={y} transform={`translate(0,${top + r * ch})`}>
            <text x={left - 8} y={ch / 2} dy="0.32em" textAnchor="end" className="num" fontSize={10} fill="var(--fg-muted)">
              {y}
            </text>
            {[...Array.from({ length: 12 }, (_, i) => map.get(`${y}-${i + 1}`)), yearRet(y)].map((v, i) => {
              if (v == null) return null;
              const a = Math.min(1, Math.abs(v) / maxAbs);
              const g = Math.round(28 + 200 * a);
              const fill = `rgb(${g},${g},${g})`;
              const isYear = i === 12;
              return (
                <g key={i} transform={`translate(${left + i * cw},0)`}>
                  {v >= 0 ? (
                    <rect width={cw - 1} height={ch - 1} fill={isYear ? 'var(--bg)' : fill} stroke={isYear ? 'var(--fg)' : 'none'} />
                  ) : (
                    <rect width={cw - 1} height={ch - 1} fill="url(#qp-hatch-dense)" color={fill} stroke={isYear ? 'var(--fg)' : fill} strokeDasharray={isYear ? '2 2' : undefined} />
                  )}
                  <text
                    x={cw / 2}
                    y={ch / 2}
                    dy="0.32em"
                    textAnchor="middle"
                    className="num"
                    fontSize={10}
                    fill={v >= 0 && !isYear && g > 140 ? 'var(--qp-black)' : 'var(--fg)'}
                    style={v < 0 ? { paintOrder: 'stroke', stroke: 'var(--bg)', strokeWidth: 3 } : undefined}
                  >
                    {fmtNum(v * 100, 1)}
                  </text>
                </g>
              );
            })}
          </g>
        ))}
      </svg>
      <p className="label mt-2 text-muted">% RETURN · SHADE = |r| · HATCH = r &lt; 0 · YEAR COLUMN COMPOUNDED</p>
    </div>
  );
}
