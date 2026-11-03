'use client';

import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Visible label above, helper / error below (error = `!` glyph + text, not color). */
export function Field({
  label,
  help,
  error,
  children,
  className,
  aside,
}: {
  label: string;
  help?: ReactNode;
  error?: string | null;
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  const id = useId();
  const helpId = `${id}-help`;
  const describedBy = help || error ? helpId : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="label text-muted">
          {label}
        </label>
        {aside}
      </div>
      {children({ id, describedBy, invalid: !!error })}
      {(help || error) && (
        <p id={helpId} className={cn('text-[13px] leading-snug', error ? 'text-fg' : 'text-muted')}>
          {error ? (
            <>
              <span aria-hidden className="num mr-1">
                !
              </span>
              {error}
            </>
          ) : (
            help
          )}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'num h-9 w-full border-0 border-b border-rule bg-surface-2 px-2 text-[14px] text-fg ' +
  'placeholder:text-muted hover:border-rule-strong focus-visible:border-fg focus-visible:outline-offset-0 ' +
  'aria-[invalid=true]:border-fg aria-[invalid=true]:border-dashed max-md:h-11';

export function TextInput({
  label,
  value,
  onChange,
  help,
  error,
  placeholder,
  className,
  inputMode,
  autoComplete = 'off',
  spellCheck = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  help?: ReactNode;
  error?: string | null;
  placeholder?: string;
  className?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'search';
  autoComplete?: string;
  spellCheck?: boolean;
}) {
  return (
    <Field label={label} help={help} error={error} className={className}>
      {({ id, describedBy, invalid }) => (
        <input
          id={id}
          className={inputClass}
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          autoComplete={autoComplete}
          spellCheck={spellCheck}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
