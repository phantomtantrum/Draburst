'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Field, inputClass } from './Field';

/**
 * Numeric input that keeps a local text buffer (so "0." or "−" can be typed)
 * and commits a clamped number on blur / Enter.
 */
export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  help,
  aside,
  className,
  digits,
}: {
  label: ReactNode;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  help?: ReactNode;
  aside?: ReactNode;
  className?: string;
  digits?: number;
}) {
  const show = (v: number) => (digits != null ? v.toFixed(digits) : String(v));
  const [text, setText] = useState(show(value));
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sync external value into local buffer
  useEffect(() => setText(show(value)), [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    const n = Number(text.replace(/−/g, '-').replace(/,/g, ''));
    if (!Number.isFinite(n) || text.trim() === '') {
      setError('Enter a number');
      return;
    }
    if (min != null && n < min) {
      setError(`Minimum is ${min}`);
      return;
    }
    if (max != null && n > max) {
      setError(`Maximum is ${max}`);
      return;
    }
    setError(null);
    if (n !== value) onChange(n);
  };

  return (
    <Field label={label} help={help} error={error} aside={aside} className={className}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <input
            id={id}
            className={inputClass + (suffix ? ' pr-10' : '')}
            inputMode="decimal"
            value={text}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            onChange={(e) => setText(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                const dir = e.key === 'ArrowUp' ? 1 : -1;
                const mult = e.shiftKey ? 10 : 1;
                let n = value + dir * step * mult;
                if (min != null) n = Math.max(min, n);
                if (max != null) n = Math.min(max, n);
                n = Number(n.toPrecision(12));
                setError(null);
                onChange(n);
              }
            }}
          />
          {suffix && (
            <span aria-hidden className="label pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-muted">
              {suffix}
            </span>
          )}
        </div>
      )}
    </Field>
  );
}
