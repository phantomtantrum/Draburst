'use client';

import Link from 'next/link';
import { useUser } from '@/lib/supabase/useUser';

export function AuthBadge() {
  const auth = useUser();
  if (auth.status === 'unconfigured' || auth.status === 'loading') return null;
  if (auth.status === 'anon')
    return (
      <Link href="/login" className="label border-l border-rule pl-3 text-muted hover:text-fg max-lg:hidden">
        Sign in
      </Link>
    );
  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-2 border-l border-rule pl-3 max-lg:hidden">
      <span className="num max-w-40 truncate text-[12px] text-muted" title={auth.user.email ?? ''}>
        {auth.user.email}
      </span>
      <button type="submit" className="label text-muted hover:text-fg">
        Sign out
      </button>
    </form>
  );
}
