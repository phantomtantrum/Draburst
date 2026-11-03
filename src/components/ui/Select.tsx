'use client';

import type { ReactNode } from 'react';
import { Field, inputClass } from './Field';

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  help,
  className,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  help?: ReactNode;
  className?: string;
}) {
  return (
    <Field label={label} help={help} className={className}>
      {({ id, describedBy }) => (
        <select
          id={id}
          className={inputClass + ' appearance-none bg-[length:10px] pr-6'}
          value={value}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value as T)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-surface text-fg">
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
