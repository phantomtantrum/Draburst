'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from './browser';
import { supabaseConfigured } from './config';

export type AuthState = { status: 'unconfigured' } | { status: 'loading' } | { status: 'anon' } | { status: 'user'; user: User };

export function useUser(): AuthState {
  const [state, setState] = useState<AuthState>(supabaseConfigured ? { status: 'loading' } : { status: 'unconfigured' });
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setState(data.user ? { status: 'user', user: data.user } : { status: 'anon' }));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setState(session?.user ? { status: 'user', user: session.user } : { status: 'anon' }));
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
