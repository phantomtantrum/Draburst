'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';
import type { McParams, McSummary } from '@/lib/quant/montecarlo';
import type { McWorkerApi } from '@/workers/mc.worker';

export interface McDisplay {
  /** concatenated display paths, row-major count × G */
  paths: Float32Array;
  terminal: Float32Array;
  count: number;
  G: number;
}

export type McState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number; display: McDisplay | null }
  | { status: 'done'; summary: McSummary; display: McDisplay; params: McParams }
  | { status: 'error'; message: string };

/**
 * Runs Monte Carlo in a dedicated worker. Starting a new run terminates the
 * previous worker (instant cancel, no stale results).
 */
export function useMonteCarlo() {
  const [state, setState] = useState<McState>({ status: 'idle' });
  const worker = useRef<Worker | null>(null);
  const runId = useRef(0);

  const kill = () => {
    worker.current?.terminate();
    worker.current = null;
  };
  useEffect(() => kill, []);

  const run = useCallback(async (params: McParams) => {
    kill();
    const id = ++runId.current;
    const w = new Worker(new URL('../../workers/mc.worker.ts', import.meta.url), { type: 'module', name: 'monte-carlo' });
    worker.current = w;
    const api = Comlink.wrap<McWorkerApi>(w);
    let display: McDisplay | null = null;
    let lastPaint = 0;
    setState({ status: 'running', done: 0, total: params.nPaths, display: null });
    try {
      const summary = await api.run(
        params,
        Comlink.proxy((b) => {
          if (id !== runId.current) return;
          const G = b.display.length / Math.max(1, b.displayCount) || 0;
          if (b.displayCount > 0) {
            const prev = display;
            const paths = new Float32Array((prev?.paths.length ?? 0) + b.display.length);
            if (prev) paths.set(prev.paths);
            paths.set(b.display, prev?.paths.length ?? 0);
            const terminal = new Float32Array((prev?.count ?? 0) + b.displayCount);
            if (prev) terminal.set(prev.terminal);
            terminal.set(b.displayTerminal.subarray(0, b.displayCount), prev?.count ?? 0);
            display = { paths, terminal, count: (prev?.count ?? 0) + b.displayCount, G: prev?.G ?? G };
          }
          const now = performance.now();
          if (now - lastPaint > 60 || b.pathsDone === params.nPaths) {
            lastPaint = now;
            setState({ status: 'running', done: b.pathsDone, total: params.nPaths, display });
          }
        }),
      );
      if (id !== runId.current) return;
      setState({
        status: 'done',
        summary,
        display: display ?? { paths: new Float32Array(0), terminal: new Float32Array(0), count: 0, G: summary.grid.length },
        params,
      });
    } catch (e) {
      if (id !== runId.current) return;
      setState({ status: 'error', message: e instanceof Error ? e.message : 'Simulation failed' });
    } finally {
      if (id === runId.current) {
        w.terminate();
        if (worker.current === w) worker.current = null;
      }
    }
  }, []);

  return { state, run };
}
