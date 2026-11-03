'use client';

import { useEffect, useRef, useState } from 'react';

const GLYPHS = '░▒▓█#%@*+=-:.';

/**
 * "Resolve from static" — characters scramble then lock in left→right.
 * SSR renders the final text (no layout shift, no hydration mismatch);
 * reduced-motion users never see the scramble.
 */
export function ScrambleText({
  text,
  duration = 380,
  className,
  trigger = 'mount',
}: {
  text: string;
  duration?: number;
  className?: string;
  trigger?: 'mount' | 'visible';
}) {
  const [frame, setFrame] = useState<{ for: string; out: string }>({ for: text, out: text });
  const out = frame.for === text ? frame.out : text;
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let started = false;
    const run = () => {
      if (started) return;
      started = true;
      const t0 = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        const lock = Math.floor(p * text.length);
        let s = '';
        for (let i = 0; i < text.length; i++) {
          const c = text[i]!;
          s += i < lock || c === ' ' ? c : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        setFrame({ for: text, out: p < 1 ? s : text });
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    if (trigger === 'mount') {
      run();
      return () => cancelAnimationFrame(raf);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [text, duration, trigger]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}
