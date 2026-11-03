'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { getSupabase } from '@/lib/supabase/browser';
import { useUser } from '@/lib/supabase/useUser';
import type { ToolId } from '@/lib/supabase/config';
import { ExplainButton, type ExplainPayload } from './ExplainButton';

/**
 * Save the current tool state: the URL query (inputs) + summary metrics + seed.
 * Results are recomputed from inputs when reopened — no large arrays stored.
 */
export function ToolActions({
  tool,
  defaultName,
  summary,
  seed,
  extra,
  explain,
}: {
  tool: ToolId;
  defaultName: string;
  summary: Record<string, string | number | null> | null;
  seed: number | null;
  extra?: ReactNode;
  /** compact inputs + metrics for the AI explanation (never raw series) */
  explain?: ExplainPayload | null;
}) {
  const auth = useUser();
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);

  const save = async () => {
    const sb = getSupabase();
    if (!sb || !summary) return;
    setState('saving');
    const params = window.location.search.replace(/^\?/, '');
    const { error } = await sb.from('saved_runs').insert({ tool, name: defaultName.slice(0, 120), params, summary, seed });
    if (error) {
      setErr(error.message);
      setState('error');
    } else {
      setState('saved');
      window.setTimeout(() => setState('idle'), 2500);
    }
  };

  return (
    <>
      {extra}
      {explain !== undefined && <ExplainButton tool={tool} payload={explain} />}
      {auth.status === 'user' ? (
        <Button variant="secondary" size="sm" onClick={save} disabled={!summary || state === 'saving'} title={err ?? undefined}>
          {state === 'saved' ? <Check size={14} strokeWidth={1.5} aria-hidden /> : <Save size={14} strokeWidth={1.5} aria-hidden />}
          {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'error' ? 'Retry save' : 'Save'}
        </Button>
      ) : auth.status === 'anon' ? (
        <Link href={`/login?next=${encodeURIComponent(`/tools/${tool}`)}`} className="label inline-flex h-8 items-center border border-rule-strong px-3 text-muted hover:border-fg hover:text-fg max-md:min-h-11">
          Sign in to save
        </Link>
      ) : auth.status === 'unconfigured' ? (
        <Button variant="secondary" size="sm" disabled title="Accounts are not configured on this deployment">
          <Save size={14} strokeWidth={1.5} aria-hidden /> Save
        </Button>
      ) : null}
      <span role="status" className="sr-only">
        {state === 'saved' ? 'Saved to dashboard' : state === 'error' ? `Save failed: ${err}` : ''}
      </span>
    </>
  );
}
