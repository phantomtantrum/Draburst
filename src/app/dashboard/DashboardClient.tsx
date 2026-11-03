'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Segmented } from '@/components/ui/Segmented';
import { IconButton, Button } from '@/components/ui/Button';
import { StatusChip } from '@/components/ui/StatusChip';
import { getSupabase } from '@/lib/supabase/browser';
import { useUser } from '@/lib/supabase/useUser';
import type { SavedRun, ToolId } from '@/lib/supabase/config';
import { fmtSeed } from '@/lib/format';

const TOOL_LABEL: Record<ToolId, string> = { 'monte-carlo': 'MONTE CARLO', portfolio: 'PORTFOLIO', backtest: 'BACKTEST' };
type Filter = 'all' | ToolId;

export function DashboardClient() {
  const auth = useUser();
  const router = useRouter();
  const [runs, setRuns] = useState<SavedRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (auth.status === 'anon') router.replace('/login?next=/dashboard');
  }, [auth.status, router]);

  const load = useCallback(async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { data, error } = await sb.from('saved_runs').select('*').order('created_at', { ascending: false }).limit(500);
    if (error) setError(error.message);
    else setRuns(data as SavedRun[]);
  }, []);
  useEffect(() => {
    if (auth.status === 'user') void load(); // eslint-disable-line react-hooks/set-state-in-effect -- fetch on sign-in
  }, [auth.status, load]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: runs?.length ?? 0, 'monte-carlo': 0, portfolio: 0, backtest: 0 };
    runs?.forEach((r) => c[r.tool]++);
    return c;
  }, [runs]);
  const shown = (runs ?? []).filter((r) => filter === 'all' || r.tool === filter);

  const mutate = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await fn();
    if (error) setError(error.message);
    await load();
  };
  const sb = getSupabase();

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-6">
      <header className="flex flex-col gap-4 border-b border-rule pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <SectionLabel index="05" title="Dashboard" />
          <h1 className="display-l mt-3">Saved runs</h1>
          <p className="mt-3 max-w-xl text-[15px] text-muted">Inputs, seed and summary metrics are stored — results are recomputed exactly when you reopen a run.</p>
        </div>
        {auth.status === 'user' && <p className="label num text-muted">{auth.user.email}</p>}
      </header>

      {auth.status === 'unconfigured' && (
        <div className="mt-8 border border-dashed border-rule-strong p-6" role="status">
          <p className="label text-fg">! Accounts not configured</p>
          <p className="mt-2 text-[14px] text-muted">Set the Supabase environment variables and run the migration in <code className="text-fg">supabase/migrations</code> (see README).</p>
        </div>
      )}
      {(auth.status === 'loading' || (auth.status === 'user' && runs == null)) && <p className="label mt-8 text-muted">LOADING…</p>}
      {error && (
        <p role="alert" className="mt-6 text-[14px] text-fg">
          ! {error}
        </p>
      )}

      {auth.status === 'user' && runs && (
        <>
          <div className="mt-6 max-w-2xl">
            <Segmented
              label="Filter by tool"
              hideLabel
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: `All ${counts.all}` },
                { value: 'monte-carlo', label: `Monte Carlo ${counts['monte-carlo']}` },
                { value: 'portfolio', label: `Portfolio ${counts.portfolio}` },
                { value: 'backtest', label: `Backtest ${counts.backtest}` },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <div className="mt-10 border border-rule p-8">
              <pre className="num text-[11px] leading-tight text-subtle" aria-hidden>
                {'  .:-=+*#%@@%#*+=-:.  \n .:-=+*#%@@@@%#*+=-:. \n  .:-=+*#%@@%#*+=-:.  '}
              </pre>
              <p className="mt-4 text-[15px] text-body">Nothing saved yet.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/tools/monte-carlo" className="label border border-rule-strong px-3 py-2 text-fg hover:border-fg">Monte Carlo →</Link>
                <Link href="/tools/portfolio" className="label border border-rule-strong px-3 py-2 text-fg hover:border-fg">Portfolio →</Link>
                <Link href="/tools/backtest" className="label border border-rule-strong px-3 py-2 text-fg hover:border-fg">Backtest →</Link>
              </div>
            </div>
          ) : (
            <ul className="mt-6 border-t border-rule-strong" aria-label="Saved runs">
              {shown.map((r) => (
                <li key={r.id} className="grid gap-3 border-b border-rule py-3 md:grid-cols-[minmax(0,2fr)_120px_minmax(0,3fr)_120px_auto] md:items-center">
                  <div className="min-w-0">
                    {editing === r.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const name = String(new FormData(e.currentTarget).get('name') ?? '').trim().slice(0, 120);
                          setEditing(null);
                          if (name && sb) void mutate(() => sb.from('saved_runs').update({ name }).eq('id', r.id));
                        }}
                      >
                        <label className="sr-only" htmlFor={`name-${r.id}`}>
                          Rename run
                        </label>
                        <input id={`name-${r.id}`} name="name" defaultValue={r.name} autoFocus onBlur={(e) => e.currentTarget.form?.requestSubmit()} className="w-full border-0 border-b border-fg bg-surface-2 px-1 py-1 text-[14px] text-fg" />
                      </form>
                    ) : (
                      <p className="truncate text-[15px] text-fg">{r.name}</p>
                    )}
                    <p className="label num mt-0.5 text-subtle">{new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ')}Z</p>
                  </div>
                  <span className="label text-muted">{TOOL_LABEL[r.tool]}</span>
                  <span className="num truncate text-[12px] text-body">
                    {Object.entries(r.summary)
                      .slice(0, 4)
                      .map(([k, v]) => `${k.toUpperCase()} ${v}`)
                      .join(' · ')}
                  </span>
                  <span className="label num text-muted">{r.seed != null ? `SEED ${fmtSeed(r.seed)}` : '—'}</span>
                  <div className="flex items-center gap-1 md:justify-end">
                    {confirm === r.id ? (
                      <>
                        <span className="label mr-2 text-fg">Delete?</span>
                        <Button size="sm" onClick={() => sb && (setConfirm(null), void mutate(() => sb.from('saved_runs').delete().eq('id', r.id)))}>
                          Delete
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Link href={`/tools/${r.tool}?${r.params}`} aria-label={`Open ${r.name} in tool`} title="Open in tool" className="inline-flex size-8 items-center justify-center text-muted hover:text-fg max-md:size-11">
                          <ExternalLink size={14} strokeWidth={1.5} aria-hidden />
                        </Link>
                        <IconButton label={`Rename ${r.name}`} onClick={() => setEditing(r.id)}>
                          <Pencil size={14} strokeWidth={1.5} aria-hidden />
                        </IconButton>
                        <IconButton
                          label={`Duplicate ${r.name}`}
                          onClick={() => sb && void mutate(() => sb.from('saved_runs').insert({ tool: r.tool, name: `${r.name} (copy)`.slice(0, 120), params: r.params, summary: r.summary, seed: r.seed }))}
                        >
                          <Copy size={14} strokeWidth={1.5} aria-hidden />
                        </IconButton>
                        <IconButton label={`Delete ${r.name}`} onClick={() => setConfirm(r.id)}>
                          <Trash2 size={14} strokeWidth={1.5} aria-hidden />
                        </IconButton>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4">
            <StatusChip status="live" detail="ROW-LEVEL SECURITY" /> <span className="label text-muted">ONLY YOU CAN READ THESE ROWS</span>
          </p>
        </>
      )}
    </div>
  );
}
