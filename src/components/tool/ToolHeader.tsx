import { SectionLabel } from '@/components/ui/SectionLabel';

/** Server-rendered tool title (paints before hydration → fast LCP). */
export function ToolHeader({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-6 lg:px-6">
      <SectionLabel index={index} title={title} />
      <h1 className="display-l mt-3">{title}</h1>
      <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-body">{subtitle}</p>
    </div>
  );
}
