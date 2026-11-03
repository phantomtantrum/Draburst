'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Comlink from 'comlink';

export type TaskState<R> = { status: 'idle' } | { status: 'running'; prev: R | null } | { status: 'done'; result: R } | { status: 'error'; message: string; prev: R | null };

/**
 * Runs one call in a fresh worker; a newer call terminates the older worker
 * (instant cancellation, never a stale result). `create` must call
 * `new Worker(new URL('…', import.meta.url))` itself so the bundler sees it.
 */
export function useWorkerTask<Api, A, R>(create: () => Worker, call: (api: Comlink.Remote<Api>, arg: A) => Promise<R>) {
  const [state, setState] = useState<TaskState<R>>({ status: 'idle' });
  const worker = useRef<Worker | null>(null);
  const id = useRef(0);
  const last = useRef<R | null>(null);
  const createRef = useRef(create);
  const callRef = useRef(call);
  useEffect(() => {
    createRef.current = create;
    callRef.current = call;
  });
  useEffect(() => () => worker.current?.terminate(), []);

  const run = useCallback(async (arg: A) => {
    worker.current?.terminate();
    const my = ++id.current;
    const w = createRef.current();
    worker.current = w;
    setState({ status: 'running', prev: last.current });
    try {
      const result = await callRef.current(Comlink.wrap<Api>(w), arg);
      if (my !== id.current) return;
      last.current = result;
      setState({ status: 'done', result });
    } catch (e) {
      if (my !== id.current) return;
      setState({ status: 'error', message: e instanceof Error ? e.message : String(e), prev: last.current });
    } finally {
      if (my === id.current) {
        w.terminate();
        worker.current = null;
      }
    }
  }, []);

  return { state, run };
}

/** Latest result, including while a newer run is in flight. */
export function latest<R>(s: TaskState<R>): R | null {
  return s.status === 'done' ? s.result : s.status === 'running' || s.status === 'error' ? s.prev : null;
}
