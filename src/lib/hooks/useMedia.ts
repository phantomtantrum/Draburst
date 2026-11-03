'use client';

import { useState, useSyncExternalStore } from 'react';

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

let webglCache: { ok: boolean; software: boolean } | null = null;
function probeWebGL() {
  if (webglCache) return webglCache;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    let software = false;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
      // CPU rasterizers: treat as a low-end device → static render (brief §9)
      software = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
    webglCache = { ok: !!gl, software };
  } catch {
    webglCache = { ok: false, software: false };
  }
  return webglCache;
}
export function hasWebGL(): boolean {
  return probeWebGL().ok;
}

/** 'full' | 'static' | 'none' — what the 3D stage may do on this device. */
export type StageMode = 'full' | 'static' | 'none';

export function useStageMode(): StageMode | null {
  const reduce = useReducedMotion();
  return useSyncExternalStore(
    () => () => {},
    () => {
      const probe = probeWebGL();
      if (!probe.ok) return 'none';
      // CPU-only WebGL: rasterizing thousands of lines blocks the main thread → 2D only (user can opt in)
      if (probe.software) return 'none';
      const lowEnd =
        (navigator.hardwareConcurrency ?? 8) <= 2 || ('deviceMemory' in navigator && (navigator as { deviceMemory?: number }).deviceMemory! <= 2);
      return reduce || lowEnd ? 'static' : 'full';
    },
    () => null,
  );
}

export function isSoftwareGL(): boolean {
  return typeof document !== 'undefined' && probeWebGL().software;
}

/** Stage mode plus a user override to force a static 3D render on CPU-only WebGL. */
export function useStage(): { mode: StageMode | null; software: boolean; forceStatic: () => void } {
  const auto = useStageMode();
  const [forced, setForced] = useState(false);
  const software = auto === 'none' && isSoftwareGL();
  return { mode: forced && software ? 'static' : auto, software, forceStatic: () => setForced(true) };
}
