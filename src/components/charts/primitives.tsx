'use client';

import type { ScaleContinuousNumeric } from 'd3-scale';

/**
 * Shared SVG defs — monochrome density/sign encodings (MASTER §6, §7).
 * All fills use currentColor so they follow the theme.
 */
export function ChartDefs() {
  return (
    <defs>
      <pattern id="qp-dither-sparse" width="4" height="4" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill="currentColor" />
        <rect x="2" y="2" width="1" height="1" fill="currentColor" />
      </pattern>
      <pattern id="qp-dither-dense" width="2" height="2" patternUnits="userSpaceOnUse">
        <rect x="0" y="0" width="1" height="1" fill="currentColor" />
      </pattern>
      <pattern id="qp-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeWidth="1" />
      </pattern>
      <pattern id="qp-hatch-dense" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="3" stroke="currentColor" strokeWidth="1" />
      </pattern>
    </defs>
  );
}

type Scale = ScaleContinuousNumeric<number, number>;

/** Ticks thinned to at most `max` evenly spaced values (log scales return many). */
export function thinTicks(scale: Scale, max: number): number[] {
  const all = scale.ticks(max);
  if (all.length <= max) return all;
  const step = Math.ceil(all.length / max);
  return all.filter((_, i) => i % step === 0);
}

export function AxisLeft({ scale, width, ticks = 5, format }: { scale: Scale; width: number; ticks?: number; format: (v: number) => string }) {
  const values = thinTicks(scale, ticks);
  return (
    <g aria-hidden>
      {values.map((v) => (
        <g key={v} transform={`translate(0,${scale(v)})`}>
          <line x1={0} x2={width} stroke="var(--rule)" strokeWidth={1} />
          <text x={-6} dy="0.32em" textAnchor="end" className="num" fontSize={11} fill="var(--fg-muted)">
            {format(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

export function AxisBottom({ scale, height, ticks = 6, format }: { scale: Scale; height: number; ticks?: number; format: (v: number) => string }) {
  const values = thinTicks(scale, ticks);
  return (
    <g aria-hidden transform={`translate(0,${height})`}>
      <line x1={scale.range()[0]} x2={scale.range()[1]} stroke="var(--rule-strong)" />
      {values.map((v) => (
        <g key={v} transform={`translate(${scale(v)},0)`}>
          <line y1={0} y2={4} stroke="var(--rule-strong)" />
          <text y={16} textAnchor="middle" className="num" fontSize={11} fill="var(--fg-muted)">
            {format(v)}
          </text>
        </g>
      ))}
    </g>
  );
}

/** Mono readout box in the chart's top-left (crosshair values). */
export function Readout({ lines }: { lines: Array<[string, string]> }) {
  return (
    <div className="pointer-events-none absolute top-3 left-[92px] z-[1] border border-rule-strong bg-bg/90 px-2 py-1.5" aria-hidden>
      {lines.map(([k, v]) => (
        <div key={k} className="num flex justify-between gap-4 text-[12px] leading-[1.45]">
          <span className="text-muted">{k}</span>
          <span className="text-fg">{v}</span>
        </div>
      ))}
    </div>
  );
}

export const MARGIN = { top: 12, right: 16, bottom: 28, left: 80 };
