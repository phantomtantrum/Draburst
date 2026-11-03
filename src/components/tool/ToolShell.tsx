'use client';

import { useState, type ReactNode } from 'react';
import { BookOpen, SlidersHorizontal, X } from 'lucide-react';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Disclaimer } from '@/components/ui/Disclaimer';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

/**
 * Shared tool layout (design-system pages/*.md):
 * ≥1024: controls 320px left | stage ; below: companions, metrics, actions.
 * <1024: stage on top, controls in a toggleable sheet.
 */
export function ToolShell({
  index,
  title,
  subtitle,
  meta,
  controls,
  stage,
  children,
  methodology,
  methodologyTitle,
  actions,
}: {
  index: string;
  title: string;
  subtitle: string;
  meta?: ReactNode;
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
      <header className="flex flex-col gap-4 border-b border-rule py-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <SectionLabel index={index} title={title} />
          <h1 className="display-l mt-3">{title}</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-muted">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          <Button variant="secondary" size="sm" onClick={() => setDrawer(true)}>
            <BookOpen size={14} strokeWidth={1.5} aria-hidden /> Methodology
          </Button>
          <Button variant="secondary" size="sm" className="lg:hidden" aria-expanded={sheet} aria-controls="tool-controls" onClick={() => setSheet((s) => !s)}>
            {sheet ? <X size={14} strokeWidth={1.5} aria-hidden /> : <SlidersHorizontal size={14} strokeWidth={1.5} aria-hidden />} Controls
          </Button>
        </div>
      </header>
      {meta && <div className="border-b border-rule py-2">{meta}</div>}
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
        <div className="order-1 min-w-0 lg:order-2 lg:pl-6">{stage}</div>
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
