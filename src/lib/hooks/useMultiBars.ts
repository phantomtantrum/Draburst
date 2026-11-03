'use client';

import { useEffect, useState } from 'react';
import { fetchBars, MarketClientError } from '@/lib/market/client';
import type { BarsResponse } from '@/lib/market/types';

export type MultiBars = {
  loading: boolean;
  ok: BarsResponse[];
  failed: Array<{ id: string; code: string; message: string }>;
};

/** Load several assets in parallel; failures are reported per asset, not fatal. */
export function useMultiBars(ids: ReadonlyArray<string>, years: number, reloadKey = 0): MultiBars {
  const key = ids.join(',');
  const [state, setState] = useState<MultiBars & { key: string }>({ loading: true, ok: [], failed: [], key: '' });
  useEffect(() => {
    let alive = true;
    const list = key ? key.split(',') : [];
    Promise.allSettled(list.map((id) => fetchBars(id, years))).then((res) => {
      if (!alive) return;
      const ok: BarsResponse[] = [];
      const failed: MultiBars['failed'] = [];
      res.forEach((r, i) => {
        if (r.status === 'fulfilled') ok.push(r.value);
        else {
          const e = r.reason instanceof MarketClientError ? r.reason : new MarketClientError('UPSTREAM', 'Failed to load');
          failed.push({ id: list[i]!, code: e.code, message: e.message });
        }
      });
      setState({ loading: false, ok, failed, key: `${key}|${years}|${reloadKey}` });
    });
    return () => {
      alive = false;
    };
  }, [key, years, reloadKey]);
  const fresh = state.key === `${key}|${years}|${reloadKey}`;
  return fresh ? state : { loading: true, ok: state.ok, failed: [] };
}
