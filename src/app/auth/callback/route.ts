import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

/** OAuth / magic-link landing: exchange the code for a session, then go to `next`. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const nextRaw = url.searchParams.get('next') ?? '/dashboard';
  // only allow same-origin relative redirects
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';
  const supabase = await getServerSupabase();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, url.origin));
}
