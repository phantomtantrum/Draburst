import { NextResponse } from 'next/server';
import { getServerSupabase } from '@/lib/supabase/server';

export async function POST(req: Request) {
  const supabase = await getServerSupabase();
  await supabase?.auth.signOut();
  return NextResponse.redirect(new URL('/', req.url), { status: 303 });
}
