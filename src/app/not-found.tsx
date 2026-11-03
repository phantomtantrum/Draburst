import Link from 'next/link';
import { SectionLabel } from '@/components/ui/SectionLabel';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-24 lg:px-6">
      <SectionLabel index="404" title="Signal lost" />
      <h1 className="display-l mt-6">Nothing resolved here.</h1>
      <p className="mt-6 max-w-md text-muted">The page you asked for is pure noise. Try one of the instruments instead.</p>
      <Link href="/" className="label mt-8 inline-block border border-rule-strong px-4 py-3 text-fg hover:border-fg">
        Return to index →
      </Link>
    </div>
  );
}
