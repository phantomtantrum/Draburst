import { cn } from '@/lib/cn';

export type Status = 'live' | 'stale' | 'eod' | 'delayed' | 'offline' | 'loading' | 'error' | 'demo';

const text: Record<Status, string> = {
  live: 'LIVE',
  stale: 'STALE',
  eod: 'EOD',
  delayed: 'DELAYED',
  offline: 'OFFLINE',
  loading: 'LOADING',
  error: 'ERROR',
  demo: 'DEMO',
};

/** Bracketed mono status label — `[ ● LIVE ]`. Never a pill; LIVE uses --gain, ERROR uses --loss. */
export function StatusChip({ status, detail, className }: { status: Status; detail?: string; className?: string }) {
  const glyph = status === 'live' ? '●' : status === 'error' ? '!' : status === 'loading' ? '◌' : '○';
  return (
    <span
      className={cn('label num inline-flex items-center gap-1.5 whitespace-nowrap', status === 'live' ? 'text-gain' : status === 'error' ? 'text-loss' : 'text-muted', className)}
    >
      <span aria-hidden>[</span>
      <span aria-hidden className={status === 'live' ? 'motion-safe:animate-pulse' : undefined}>
        {glyph}
      </span>
      <span>
        {text[status]}
        {detail ? ` ${detail}` : ''}
      </span>
      <span aria-hidden>]</span>
    </span>
  );
}
