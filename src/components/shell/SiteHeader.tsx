import Link from 'next/link';
import { NavLinks } from './NavLinks';
import { UtcClock } from './UtcClock';
import { AuthBadge } from './AuthBadge';

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-bg">
      <div className="relative mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-4 px-4 lg:px-6">
        <Link href="/" className="flex items-baseline gap-2 text-fg" aria-label="quantphantom — home">
          <span className="text-[17px] font-extrabold tracking-[-0.04em]">quantphantom</span>
          <span className="label hidden text-subtle sm:inline" aria-hidden>
            v0.1
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <NavLinks />
          <AuthBadge />
          <UtcClock className="label hidden border-l border-rule pl-3 text-muted xl:inline" />
        </div>
      </div>
    </header>
  );
}
