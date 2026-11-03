'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Copy, Sparkles, Square } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useUser } from '@/lib/supabase/useUser';
import type { ToolId } from '@/lib/supabase/config';

export type ExplainPayload = {
  inputs: Record<string, string | number | boolean | null>;
  metrics: Record<string, string | number | boolean | null>;
};

/** NaN/∞ → null (the server schema only accepts finite numbers); round to 6 significant digits. */
export function sanitizePayload(p: ExplainPayload): ExplainPayload {
  const clean = (r: ExplainPayload['inputs']) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'number' ? (Number.isFinite(v) ? Number(v.toPrecision(6)) : null) : v]));
  return { inputs: clean(p.inputs), metrics: clean(p.metrics) };
}

/** "Explain" → streams a plain-English reading of the result into a terminal panel. */
export function ExplainButton({ tool, payload }: { tool: ToolId; payload: ExplainPayload | null }) {
  const auth = useUser();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'streaming' | 'done' | 'error'>('idle');
  const [meta, setMeta] = useState<string>('');
  const ctrl = useRef<AbortController | null>(null);

  if (auth.status === 'anon')
    return (
      <Link href={`/login?next=${encodeURIComponent(`/tools/${tool}`)}`} className="label inline-flex h-8 items-center gap-2 border border-rule-strong px-3 text-muted hover:border-fg hover:text-fg max-md:min-h-11">
        <Sparkles size={14} strokeWidth={1.5} aria-hidden /> Sign in to explain
      </Link>
    );
  if (auth.status !== 'user') return null;

  const run = async () => {
    if (!payload) return;
    setOpen(true);
    setText('');
    setState('streaming');
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool, ...sanitizePayload(payload) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setText(body?.error?.message ?? `Request failed (HTTP ${res.status}).`);
        setState('error');
        return;
      }
      setMeta(`${res.headers.get('X-Explain-Model') ?? ''} · ${res.headers.get('X-Explain-Remaining') ?? '?'} LEFT TODAY`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
      setState('done');
    } catch (e) {
      if ((e as { name?: string }).name === 'AbortError') setState('done');
      else {
        setText((t) => t + '\n[Connection lost.]');
        setState('error');
      }
    }
  };

  return (
    <>
      <Button variant="secondary" size="sm" onClick={run} disabled={!payload || state === 'streaming'}>
        <Sparkles size={14} strokeWidth={1.5} aria-hidden /> Explain
      </Button>
      <Drawer
        open={open}
        onClose={() => {
          ctrl.current?.abort();
          setOpen(false);
        }}
        title="Explain — AI reading of this result"
      >
        <div className="flex items-center justify-between gap-2 border-b border-rule pb-3">
          <span className="label num text-muted">{meta || 'CLAUDE · COMPACT INPUTS + METRICS ONLY'}</span>
          <span className="flex gap-2">
            {state === 'streaming' && (
              <Button size="sm" variant="ghost" onClick={() => ctrl.current?.abort()}>
                <Square size={12} strokeWidth={1.5} aria-hidden /> Stop
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(text)} disabled={!text}>
              <Copy size={12} strokeWidth={1.5} aria-hidden /> Copy
            </Button>
          </span>
        </div>
        <div className="mt-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap text-body" aria-live="polite" aria-busy={state === 'streaming'}>
          <span className="text-muted">&gt; explain {tool}</span>
          {'\n\n'}
          {text}
          {state === 'streaming' && <span aria-hidden className="ml-0.5 inline-block h-[1em] w-[0.6em] translate-y-[2px] bg-fg motion-safe:animate-pulse" />}
        </div>
        <p className="label mt-6 border-t border-rule pt-3 text-muted">AI-generated. May be wrong. Not investment advice.</p>
      </Drawer>
    </>
  );
}
