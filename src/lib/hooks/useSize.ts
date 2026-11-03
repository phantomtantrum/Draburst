'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/** Element content-box size via ResizeObserver. */
export function useSize<T extends HTMLElement>(): [React.RefObject<T | null>, { width: number; height: number }] {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (!e) return;
      const { width, height } = e.contentRect;
      setSize((s) => (Math.abs(s.width - width) < 0.5 && Math.abs(s.height - height) < 0.5 ? s : { width, height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}
