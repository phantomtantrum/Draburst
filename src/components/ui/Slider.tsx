'use client';

import type { ReactNode } from 'react';
import { Field } from './Field';

/**
 * Native range input (keyboard + a11y for free), square thumb, mono readout.
 * Optional log scale: the slider moves in log space; value stays linear.
 */
export function Slider({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  log = false,
  format = (v) => String(v),
  help,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  log?: boolean;
  format?: (v: number) => string;
  help?: ReactNode;
  className?: string;
}) {
  const toPos = (v: number) => (log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min));
  const fromPos = (p: number) => {
    const raw = log ? Math.exp(Math.log(min) + p * (Math.log(max) - Math.log(min))) : min + p * (max - min);
    const snapped = Math.round(raw / step) * step;
    return Math.min(max, Math.max(min, Number(snapped.toPrecision(12))));
  };
  const pos = Math.round(toPos(value) * 1000);
  return (
    <Field label={label} help={help} className={className} aside={<span className="num text-[13px] text-fg">{format(value)}</span>}>
      {({ id, describedBy }) => (
        <input
          id={id}
          type="range"
          className="qp-range"
          min={0}
          max={1000}
          step={1}
          value={pos}
          aria-describedby={describedBy}
          aria-valuetext={format(value)}
          onChange={(e) => onChange(fromPos(Number(e.target.value) / 1000))}
          style={{ ['--p' as string]: `${pos / 10}%` }}
        />
      )}
    </Field>
  );
}
