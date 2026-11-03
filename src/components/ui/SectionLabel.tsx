import { cn } from '@/lib/cn';

/** `01 / MONTE CARLO` — numbered section label with leading hairline tick. */
export function SectionLabel({
  index,
  title,
  className,
  as: Tag = 'p',
}: {
  index: string | number;
  title: string;
  className?: string;
  as?: 'p' | 'h2' | 'h3' | 'span';
}) {
  const idx = typeof index === 'number' ? String(index).padStart(2, '0') : index;
  return (
    <Tag className={cn('label flex items-center gap-3 text-muted', className)}>
      <span aria-hidden className="inline-block h-px w-3 bg-current" />
      <span className="num text-fg">{idx}</span>
      <span aria-hidden>/</span>
      <span>{title}</span>
    </Tag>
  );
}
