'use client';

import { useSyncExternalStore } from 'react';

function subscribeMedia(query: string) {
  return (cb: () => void) => {
    const m = window.matchMedia(query);
    m.addEventListener('change', cb);
    return () => m.removeEventListener('change', cb);
  };
}

/** SSR-safe media query (server snapshot = `fallback`). */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)', false);

let webglCache: boolean | null = null;
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache;
  try {
    const c = document.createElement('canvas');
    webglCache = !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webglCache = false;
  }
  return webglCache;
}

/** 'full' | 'static' | 'none' — what the 3D stage may do on this device. */
export type StageMode = 'full' | 'static' | 'none';

export function useStageMode(): StageMode | null {
  const reduce = useReducedMotion();
  return useSyncExternalStore(
    () => () => {},
    () => {
      if (!hasWebGL()) return 'none';
      const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 2 || ('deviceMemory' in navigator && (navigator as { deviceMemory?: number }).deviceMemory! <= 2);
      return reduce || lowEnd ? 'static' : 'full';
    },
    () => null,
  );
}
