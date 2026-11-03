import { fmtPct } from '@/lib/format';

/** Signed weight bar: solid for long, hatched/outlined for short. */
export function WeightBar({ w, max = 1 }: { w: number; max?: number }) {
  const pct = Math.min(1, Math.abs(w) / max) * 100;
  return (
    <span className="inline-flex w-full items-center justify-end gap-2">
      <span className="num">{fmtPct(w, 1)}</span>
      <span className="relative inline-block h-2 w-16 border border-rule" aria-hidden>
        <span
          className={'absolute inset-y-0 left-0 ' + (w >= 0 ? 'bg-gain' : 'hatch border border-loss text-loss')}
          style={{ width: `${pct}%` }}
        />
      </span>
    </span>
  );
}
