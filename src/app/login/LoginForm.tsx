'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { getSupabase } from '@/lib/supabase/browser';
import { supabaseConfigured } from '@/lib/supabase/config';

export function LoginForm() {
  const sp = useSearchParams();
  const nextRaw = sp.get('next') ?? '/dashboard';
  const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '/dashboard';
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState<string | null>(sp.get('error') ? 'Sign-in link was invalid or expired. Try again.' : null);

  if (!supabaseConfigured) {
    return (
      <div className="border border-dashed border-rule-strong p-6" role="status">
        <p className="label text-fg">! Accounts not configured</p>
        <p className="mt-3 text-[14px] text-muted">
          This deployment has no Supabase project (<code className="text-fg">NEXT_PUBLIC_SUPABASE_URL</code>,{' '}
          <code className="text-fg">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>). See the README to enable sign-in, saving and AI explanations.
        </p>
      </div>
    );
  }

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  const magic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setMsg('Enter a valid email address.');
      return;
    }
    setState('sending');
    const { error } = await getSupabase()!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
    if (error) {
      setState('error');
      setMsg(error.message);
    } else {
      setState('sent');
      setMsg(null);
    }
  };

  const oauth = async (provider: 'google' | 'github') => {
    const { error } = await getSupabase()!.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (error) setMsg(error.message);
  };

  return (
    <div className="flex flex-col gap-6 border border-rule p-6">
      <form onSubmit={magic} className="flex flex-col gap-4" noValidate>
        <TextInput label="Email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" error={state === 'error' ? msg : null} />
        <Button type="submit" disabled={state === 'sending'}>
          <Mail size={14} strokeWidth={1.5} aria-hidden /> {state === 'sending' ? 'Sending…' : 'Email me a magic link'}
        </Button>
        <p role="status" className="text-[13px] text-muted">
          {state === 'sent' ? `Link sent to ${email}. Open it on this device to sign in.` : state !== 'error' && msg ? `! ${msg}` : ''}
        </p>
      </form>
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-rule" />
        <span className="label text-muted">or</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={() => oauth('google')}>
          Google
        </Button>
        <Button variant="secondary" onClick={() => oauth('github')}>
          GitHub
        </Button>
      </div>
    </div>
  );
}
