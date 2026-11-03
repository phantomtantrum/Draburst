import { cn } from '@/lib/cn';
import { fmtPct, fmtSigned, signOf } from '@/lib/format';

/**
 * Gain/loss (MASTER §6): --gain / --loss color, always paired with sign + glyph
 * so it still reads in grayscale. pos: ▲ green, neg: ▼ red, zero: ◆ muted.
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
        s === 'pos' && 'text-gain',
        s === 'neg' && 'text-loss',
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
