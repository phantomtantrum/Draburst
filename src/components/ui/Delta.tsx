import { cn } from '@/lib/cn';
import { fmtPct, fmtSigned, signOf } from '@/lib/format';

/**
 * Gain/loss without color (MASTER §6): sign + glyph + weight.
 * pos: ▲ solid, neg: ▼ + underline dashed, zero: ◆ muted.
 */
export function Delta({
  value,
  kind = 'pct',
  digits = 2,
  className,
  glyph = true,
}: {
  value: number | null | undefined;
  kind?: 'pct' | 'num';
  digits?: number;
  className?: string;
  glyph?: boolean;
}) {
  if (value == null || !Number.isFinite(value)) return <span className={cn('num text-muted', className)}>—</span>;
  const s = signOf(value);
  const str = kind === 'pct' ? fmtPct(value, digits, true) : fmtSigned(value, digits);
  const g = s === 'pos' ? '▲' : s === 'neg' ? '▼' : '◆';
  const word = s === 'pos' ? 'up' : s === 'neg' ? 'down' : 'unchanged';
  return (
    <span
      className={cn(
        'num relative inline-flex items-baseline gap-1 whitespace-nowrap',
        s === 'pos' && 'text-fg',
        s === 'neg' && 'text-fg underline decoration-dashed decoration-1 underline-offset-4',
        s === 'zero' && 'text-muted',
        className,
      )}
    >
      {glyph && (
        <span aria-hidden className="text-[0.75em]">
          {g}
        </span>
      )}
      <span className="sr-only">{word} </span>
      {str}
    </span>
  );
}
