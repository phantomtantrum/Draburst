'use client';

import { useEffect, useRef } from 'react';

/**
 * Film-grain overlay (MASTER §7). Pre-renders 6 tiles of 192² gray noise once,
 * then cycles them as a tiled background at 12 fps. Static under reduced
 * motion, paused while the tab is hidden. pointer-events: none.
 */
export function Grain() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const size = 192;
    const frames: string[] = [];
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    for (let f = 0; f < 6; f++) {
      const img = ctx.createImageData(size, size);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      frames.push(`url(${c.toDataURL('image/png')})`);
    }
    el.style.backgroundImage = frames[0]!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let i = 0;
    let timer: number | undefined;
    const start = () => {
      if (timer || reduce.matches || document.hidden) return;
      timer = window.setInterval(() => {
        i = (i + 1) % frames.length;
        el.style.backgroundImage = frames[i]!;
        el.style.backgroundPosition = `${(Math.random() * size) | 0}px ${(Math.random() * size) | 0}px`;
      }, 1000 / 12);
    };
    const stop = () => {
      if (timer) window.clearInterval(timer);
      timer = undefined;
    };
    const onVis = () => (document.hidden ? stop() : start());
    const onReduce = () => (reduce.matches ? stop() : start());
    start();
    document.addEventListener('visibilitychange', onVis);
    reduce.addEventListener('change', onReduce);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVis);
      reduce.removeEventListener('change', onReduce);
    };
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[100] mix-blend-overlay"
      style={{ opacity: 'var(--grain-opacity)' }}
    />
  );
}
