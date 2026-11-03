'use client';

import { useState, type ReactNode } from 'react';
import { BookOpen, SlidersHorizontal, X } from 'lucide-react';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

/**
 * Shared tool layout (design-system pages/*.md):
 * ≥1024: controls 320px left | stage ; below: companions, metrics, actions.
 * <1024: stage on top, controls in a toggleable sheet.
 */
export function ToolShell({
  title,
  meta,
  stageBar,
  controls,
  stage,
  children,
  methodology,
  methodologyTitle,
  actions,
}: {
  /** used for landmarks; the visible title is server-rendered by ToolHeader */
  title: string;
  meta?: ReactNode;
  /** optional bar above the stage (view toggles); its height is reserved when defined */
  stageBar?: ReactNode;
  controls: ReactNode;
  stage: ReactNode;
  children?: ReactNode;
  methodology: ReactNode;
  methodologyTitle: string;
  actions?: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [sheet, setSheet] = useState(false);
  return (
    <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
      <div className="flex min-h-[52px] flex-wrap items-center justify-end gap-2 border-b border-rule py-2">
        {actions}
        <Button variant="secondary" size="sm" onClick={() => setDrawer(true)}>
          <BookOpen size={14} strokeWidth={1.5} aria-hidden /> Methodology
        </Button>
        <Button variant="secondary" size="sm" className="lg:hidden" aria-expanded={sheet} aria-controls="tool-controls" onClick={() => setSheet((s) => !s)}>
          {sheet ? <X size={14} strokeWidth={1.5} aria-hidden /> : <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />} Controls
        </Button>
      </div>
      {/* reserved height: metadata arrives with the data, without shifting the stage */}
      <div className="h-[37px] overflow-x-auto overflow-y-hidden border-b border-rule py-2 whitespace-nowrap [&>*]:w-max [&>*]:min-w-full [&>*]:flex-nowrap [&_*]:flex-nowrap">
        {meta}
      </div>
      <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          id="tool-controls"
          aria-label={`${title} controls`}
          className={cn(
            'order-2 border-rule lg:order-1 lg:block lg:border-r lg:py-6 lg:pr-6',
            sheet ? 'block border-b py-6' : 'hidden',
          )}
        >
          <div className="flex flex-col gap-5 lg:sticky lg:top-16">{controls}</div>
        </aside>
        <div className="order-1 min-w-0 pt-2 lg:order-2 lg:pl-6">
          {stageBar !== undefined && <div className="mb-2 flex min-h-[34px] justify-end">{stageBar}</div>}
          {stage}
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-10">{children}</div>
      <Disclaimer className="mt-10 border-t border-rule pt-4" />
      <Drawer open={drawer} onClose={() => setDrawer(false)} title={methodologyTitle}>
        <div className="methodology space-y-4 text-[15px] leading-relaxed text-body">{methodology}</div>
      </Drawer>
    </div>
  );
}

export function Panel({ index, title, children, aside, className }: { index?: string; title: string; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <section className={cn('min-w-0 border-t border-rule-strong pt-4', className)} aria-label={title}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        {index ? <SectionLabel index={index} title={title} as="h2" /> : <h2 className="label text-fg">{title}</h2>}
        {aside}
      </div>
      {children}
    </section>
  );
}
