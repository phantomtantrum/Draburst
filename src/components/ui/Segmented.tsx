'use client';

import { useId, useRef } from 'react';
import { cn } from '@/lib/cn';

/** Radio-group segmented control. Arrow keys move selection (roving tabindex). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  hideLabel = false,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean; title?: string }>;
  onChange: (v: T) => void;
  className?: string;
  hideLabel?: boolean;
}) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const enabled = options.filter((o) => !o.disabled);
  const move = (dir: 1 | -1) => {
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + dir + enabled.length) % enabled.length];
    if (!next) return;
    onChange(next.value);
    refs.current[options.indexOf(next)]?.focus();
  };
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span id={id} className={cn('ui-label text-body', hideLabel && 'sr-only')}>
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex border border-rule">
        {options.map((o, i) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={o.disabled}
              title={o.title}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(-1);
                }
              }}
              className={cn(
                'ui-label h-9 flex-1 px-2 text-[13px] whitespace-nowrap transition-colors duration-[var(--dur-micro)] max-md:min-h-11',
                i > 0 && 'border-l border-rule',
                active ? 'bg-fg text-bg' : 'text-muted hover:bg-surface-hover hover:text-fg',
                o.disabled && 'cursor-not-allowed opacity-40',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
