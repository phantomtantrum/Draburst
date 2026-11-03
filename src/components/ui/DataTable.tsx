import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Column<R> {
  key: string;
  header: ReactNode;
  cell: (row: R, i: number) => ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

/** Hairline table, mono right-aligned numbers, sticky header. */
export function DataTable<R>({
  columns,
  rows,
  caption,
  rowKey,
  className,
  dense = false,
  maxHeight,
}: {
  columns: ReadonlyArray<Column<R>>;
  rows: ReadonlyArray<R>;
  caption: string;
  rowKey: (row: R, i: number) => string;
  className?: string;
  dense?: boolean;
  maxHeight?: number;
}) {
  return (
    <div className={cn('w-full overflow-x-auto', className)} style={maxHeight ? { maxHeight, overflowY: 'auto' } : undefined}>
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 z-[1] bg-bg">
          <tr className="border-b border-rule-strong">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  'label py-2 font-medium whitespace-nowrap text-muted',
                  c.align === 'right' ? 'pl-4 text-right' : 'pr-4 text-left',
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={rowKey(r, i)} className="border-b border-rule hover:bg-surface-hover">
              {columns.map((c, j) => {
                const Cell = j === 0 ? 'th' : 'td';
                return (
                  <Cell
                    key={c.key}
                    scope={j === 0 ? 'row' : undefined}
                    className={cn(
                      'whitespace-nowrap',
                      dense ? 'py-1' : 'py-2',
                      c.align === 'right' ? 'num pl-4 text-right text-fg' : 'pr-4 text-left font-normal text-body',
                      c.className,
                    )}
                  >
                    {c.cell(r, i)}
                  </Cell>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Key/value metrics list rendered as a 2-col definition grid. */
export function MetricList({
  items,
  className,
  columns = 2,
}: {
  items: ReadonlyArray<{ label: ReactNode; value: ReactNode; hint?: string; id?: string }>;
  className?: string;
  columns?: 1 | 2 | 3 | 4;
}) {
  const cols = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-2 lg:grid-cols-3', 4: 'grid-cols-2 lg:grid-cols-4' }[columns];
  return (
    <dl className={cn('grid border-t border-l border-rule', cols, className)}>
      {items.map((it, i) => (
        <div key={it.id ?? (typeof it.label === 'string' ? it.label : i)} data-metric={it.id} className="flex flex-col gap-1 border-r border-b border-rule px-3 py-3" title={it.hint}>
          <dt className="label text-muted">{it.label}</dt>
          <dd className="num text-[18px] leading-tight text-fg">{it.value}</dd>
        </div>
      ))}
    </dl>
  );
}
