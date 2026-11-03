'use client';

import { useSyncExternalStore } from 'react';
import { BINANCE_WS } from '@/lib/market/binance';

/**
 * Live 24h mini-tickers from Binance's public market-data stream (no key).
 * One combined socket; exponential-backoff reconnect; "stale" after 15 s of
 * silence. Consumers read a snapshot via useSyncExternalStore; the 3D scene
 * reads `getLive()` directly inside useFrame (no React re-render per tick).
 */
export interface Tick {
  symbol: string;
  price: number;
  open24: number;
  high24: number;
  low24: number;
  quoteVol24: number;
  /** last tick direction vs previous price: 1 up, −1 down, 0 flat */
  dir: 1 | -1 | 0;
  /** |Δp/p| of the last tick */
  move: number;
  ts: number;
  /** increments on every update (drives ripples) */
  seq: number;
}

export type LiveStatus = 'connecting' | 'live' | 'stale' | 'offline';

interface Snapshot {
  status: LiveStatus;
  ticks: Record<string, Tick>;
  lastMessage: number;
}

let snap: Snapshot = { status: 'connecting', ticks: {}, lastMessage: 0 };
const listeners = new Set<() => void>();
let ws: WebSocket | null = null;
let retries = 0;
let symbols: string[] = [];
let staleTimer: number | undefined;
let refCount = 0;
let reconnectTimer: number | undefined;
let pendingEmit = false;

function emit() {
  // coalesce bursts into one notification per animation frame
  if (pendingEmit) return;
  pendingEmit = true;
  requestAnimationFrame(() => {
    pendingEmit = false;
    listeners.forEach((l) => l());
  });
}

function set(next: Partial<Snapshot>) {
  snap = { ...snap, ...next };
  emit();
}

function connect() {
  if (typeof window === 'undefined' || !symbols.length) return;
  const streams = symbols.map((s) => `${s.toLowerCase()}usdt@miniTicker`).join('/');
  try {
    ws = new WebSocket(`${BINANCE_WS}/stream?streams=${streams}`);
  } catch {
    scheduleReconnect();
    return;
  }
  set({ status: snap.lastMessage ? 'stale' : 'connecting' });
  ws.onopen = () => {
    retries = 0;
  };
  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data as string) as { data?: { s: string; c: string; o: string; h: string; l: string; q: string; E: number } };
      const d = msg.data;
      if (!d || !d.s.endsWith('USDT')) return;
      const sym = d.s.slice(0, -4);
      const price = +d.c;
      const prev = snap.ticks[sym];
      const dir = prev ? (price > prev.price ? 1 : price < prev.price ? -1 : 0) : 0;
      const tick: Tick = {
        symbol: sym,
        price,
        open24: +d.o,
        high24: +d.h,
        low24: +d.l,
        quoteVol24: +d.q,
        dir,
        move: prev ? Math.abs(price / prev.price - 1) : 0,
        ts: d.E,
        seq: (prev?.seq ?? 0) + 1,
      };
      snap = { status: 'live', lastMessage: Date.now(), ticks: { ...snap.ticks, [sym]: tick } };
      emit();
    } catch {
      /* ignore malformed frames */
    }
  };
  ws.onclose = () => {
    ws = null;
    if (refCount > 0) scheduleReconnect();
  };
  ws.onerror = () => ws?.close();
}

function scheduleReconnect() {
  window.clearTimeout(reconnectTimer);
  retries++;
  if (retries > 6) {
    set({ status: snap.lastMessage ? 'stale' : 'offline' });
  }
  const delay = Math.min(30_000, 500 * 2 ** retries) * (0.75 + Math.random() * 0.5);
  reconnectTimer = window.setTimeout(connect, delay);
}

/** Start streaming the given base symbols (e.g. ['BTC','ETH']). Returns a stop function. */
export function startLive(list: string[]): () => void {
  refCount++;
  if (refCount === 1) {
    symbols = list;
    connect();
    staleTimer = window.setInterval(() => {
      if (snap.status === 'live' && Date.now() - snap.lastMessage > 15_000) set({ status: 'stale' });
    }, 3000);
  }
  return () => {
    refCount--;
    if (refCount === 0) {
      window.clearInterval(staleTimer);
      window.clearTimeout(reconnectTimer);
      ws?.close();
      ws = null;
      retries = 0;
    }
  };
}

export function getLive(): Snapshot {
  return snap;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const server: Snapshot = { status: 'connecting', ticks: {}, lastMessage: 0 };

export function useLive(): Snapshot {
  return useSyncExternalStore(subscribe, getLive, () => server);
}
