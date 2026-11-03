'use client';

import { useEffect, useState } from 'react';

/** Instrument-panel UTC clock. Renders a stable placeholder on the server. */
export function UtcClock({ className }: { className?: string }) {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setT(new Date().toISOString().slice(11, 19));
    f();
    const id = window.setInterval(f, 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <span className={className} aria-hidden>
      <span className="num">{t ?? '--:--:--'}</span> UTC
    </span>
  );
}
