'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui/Button';

export const NAV = [
  { href: '/tools/monte-carlo', label: 'Monte Carlo', idx: '01' },
  { href: '/tools/portfolio', label: 'Portfolio', idx: '02' },
  { href: '/tools/backtest', label: 'Backtest', idx: '03' },
  { href: '/methodology', label: 'Methodology', idx: '04' },
  { href: '/dashboard', label: 'Dashboard', idx: '05' },
] as const;

export function NavLinks() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- close mobile menu on navigation
  useEffect(() => setOpen(false), [path]);

  const links = (mobile: boolean) =>
    NAV.map((n) => {
      const active = path === n.href || path.startsWith(n.href + '/');
      return (
        <li key={n.href}>
          <Link
            href={n.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'label flex items-center gap-2 transition-colors duration-[var(--dur-micro)]',
              mobile ? 'min-h-11 border-b border-rule px-4 py-3' : 'h-12 px-3',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            <span className="num text-subtle" aria-hidden>
              {n.idx}
            </span>
            <span className={cn(active && !mobile && 'underline decoration-1 underline-offset-[6px]')}>{n.label}</span>
          </Link>
        </li>
      );
    });

  return (
    <>
      <nav aria-label="Primary" className="hidden lg:block">
        <ul className="flex items-center">{links(false)}</ul>
      </nav>
      <div className="lg:hidden">
        <IconButton label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-nav" onClick={() => setOpen((o) => !o)}>
          {open ? <X size={18} strokeWidth={1.5} aria-hidden /> : <Menu size={18} strokeWidth={1.5} aria-hidden />}
        </IconButton>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Primary" className="absolute inset-x-0 top-full z-50 border-b border-rule-strong bg-bg lg:hidden">
          <ul>{links(true)}</ul>
        </nav>
      )}
    </>
  );
}
