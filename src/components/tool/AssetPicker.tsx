'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/cn';
import { UNIVERSE } from '@/lib/market/universe';
import { fetchStatus, searchAssets, type ProviderStatus } from '@/lib/market/client';
import type { Asset } from '@/lib/market/types';
import { Segmented } from '@/components/ui/Segmented';
import { inputClass } from '@/components/ui/Field';

/**
 * Asset chooser: CRYPTO / STOCKS tabs, curated list, live search through
 * our API. Keyboard: type to search, ↑↓ to move, Enter to select.
 */
export function AssetPicker({
  value,
  onChange,
  label = 'Asset',
  exclude = [],
  className,
}: {
  value: string | null;
  onChange: (a: Asset) => void;
  label?: string;
  exclude?: ReadonlyArray<string>;
  className?: string;
}) {
  const initialCls = value?.startsWith('stock:') ? 'stock' : 'crypto';
  const [cls, setCls] = useState<Asset['cls']>(initialCls);
  const [q, setQ] = useState('');
  const [remote, setRemote] = useState<Asset[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputId = useId();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetchStatus().then(setStatus);
  }, []);

  const stockOff = status != null && !status.stock.configured;

  useEffect(() => {
    const term = q.trim();
    if (term.length < 1 || (cls === 'stock' && stockOff)) return;
    const ctrl = new AbortController();
    const h = window.setTimeout(() => {
      searchAssets(term, cls, ctrl.signal)
        .then((r) => {
          setRemote(r);
          setErr(null);
        })
        .catch((e: { name?: string; message?: string }) => {
          if (e.name !== 'AbortError') setErr(e.message ?? 'Search failed');
        });
    }, 250);
    return () => {
      ctrl.abort();
      window.clearTimeout(h);
    };
  }, [q, cls, stockOff]);

  const items = useMemo(() => {
    const term = q.trim().toUpperCase();
    const local = UNIVERSE.filter((a) => a.cls === cls && (!term || a.symbol.includes(term) || a.name.toUpperCase().includes(term)));
    const merged = [...local];
    if (term && remote) for (const r of remote) if (r.cls === cls && !merged.some((m) => m.id === r.id)) merged.push(r);
    return merged.filter((a) => !exclude.includes(a.id)).slice(0, 40);
  }, [q, cls, remote, exclude]);

  const choose = (a: Asset) => {
    onChange(a);
    setQ('');
    setRemote(null);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Segmented
        label={label}
        value={cls}
        onChange={(v) => {
          setCls(v);
          setActive(0);
          setRemote(null);
        }}
        options={[
          { value: 'crypto', label: 'Crypto' },
          { value: 'stock', label: 'Stocks · ETFs' },
        ]}
      />
      {cls === 'stock' && stockOff && (
        <p className="border border-dashed border-rule-strong p-2 text-[13px] text-muted" role="status">
          <span className="num mr-1 text-fg">!</span>
          Stock data is not configured on this deployment (needs <code className="text-fg">TIINGO_API_KEY</code>). Crypto works without keys.
        </p>
      )}
      <div className="relative">
        <label htmlFor={inputId} className="sr-only">
          Search {cls === 'crypto' ? 'crypto assets' : 'stocks and ETFs'}
        </label>
        <Search aria-hidden size={14} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted" />
        <input
          id={inputId}
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          className={inputClass + ' pl-7 uppercase'}
          placeholder={cls === 'crypto' ? 'SEARCH · BTC, SOL…' : 'SEARCH · SPY, AAPL…'}
          value={q}
          disabled={cls === 'stock' && stockOff}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(items.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && items[active]) {
              e.preventDefault();
              choose(items[active]!);
            }
          }}
        />
      </div>
      {err && <p className="text-[12px] text-muted">! {err}</p>}
      <ul id={listId} ref={listRef} role="listbox" aria-label={`${label} options`} className="max-h-44 overflow-y-auto border border-rule">
        {items.length === 0 && <li className="label px-2 py-2 text-muted">No matches</li>}
        {items.map((a, i) => {
          const selected = a.id === value;
          return (
            <li
              key={a.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={selected}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(a)}
              onMouseEnter={() => setActive(i)}
              className={cn(
                'flex cursor-pointer items-baseline justify-between gap-2 border-b border-rule-faint px-2 py-1.5 last:border-b-0 max-md:py-2.5',
                selected ? 'bg-fg text-bg' : i === active && 'bg-surface-hover',
              )}
            >
              <span className={cn('num text-[13px]', selected ? 'text-bg' : 'text-fg')}>{a.symbol}</span>
              <span className={cn('truncate text-[12px]', selected ? 'text-bg' : 'text-muted')}>{a.name}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
