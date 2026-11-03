'use client';

import { useEffect, useState, type RefObject } from 'react';

/** True while the element is in the viewport AND the tab is visible. */
export function useActive(ref: RefObject<Element | null>, rootMargin = '100px'): boolean {
  const [inView, setInView] = useState(true);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(!!e?.isIntersecting), { rootMargin });
    io.observe(el);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [ref, rootMargin]);
  return inView && visible;
}
