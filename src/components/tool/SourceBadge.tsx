import type { SourceInfo } from '@/lib/market/types';
import { StatusChip } from '@/components/ui/StatusChip';

export function SourceBadge({ source, asOf, className }: { source: SourceInfo; asOf: string; className?: string }) {
  const status = source.freshness === 'fixture' ? 'demo' : source.freshness === 'live' ? 'live' : source.freshness === 'delayed' ? 'delayed' : 'eod';
  return (
    <span className={'label inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-muted ' + (className ?? '')}>
      <span>
        SRC{' '}
        <a href={source.url} target="_blank" rel="noreferrer" className="text-fg underline-offset-2 hover:underline">
          {source.name.toUpperCase()}
        </a>
      </span>
      <StatusChip status={status} detail={source.adjusted ? 'ADJ' : undefined} />
      <span className="num" title="Time the data was fetched from the provider">
        AS OF {asOf.slice(0, 16).replace('T', ' ')}Z
      </span>
    </span>
  );
}
