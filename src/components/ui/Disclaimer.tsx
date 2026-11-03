import { cn } from '@/lib/cn';

export function Disclaimer({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p className={cn('text-[13px] leading-relaxed text-muted', className)} role="note">
      <span className="font-medium text-fg">Not investment advice.</span>
      {!compact && (
        <>
          {' '}
          Simulations and backtests are hypothetical, rely on historical data and model assumptions, and do not predict
          future results.
        </>
      )}
    </p>
  );
}
