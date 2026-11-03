import { cn } from '@/lib/cn';

export function Disclaimer({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p className={cn('label text-muted', className)} role="note">
      <span className="text-fg">Not investment advice.</span>
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
