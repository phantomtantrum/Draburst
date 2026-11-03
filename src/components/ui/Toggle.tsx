'use client';

import { cn } from '@/lib/cn';

/** Switch rendered as `[■] LABEL` / `[ ] LABEL`. */
export function Toggle({
  label,
  checked,
  onChange,
  className,
  help,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
  help?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      title={help}
      className={cn('label group flex items-center gap-2 py-1 text-left text-muted hover:text-fg max-md:min-h-11', className)}
    >
      <span
        aria-hidden
        className={cn(
          'inline-flex size-3.5 items-center justify-center border',
          checked ? 'border-fg bg-fg' : 'border-rule-strong group-hover:border-fg',
        )}
      />
      <span className={checked ? 'text-fg' : undefined}>{label}</span>
    </button>
  );
}
