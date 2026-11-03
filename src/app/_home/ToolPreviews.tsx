/**
 * Small static illustrations for the landing-page tool cards. Deterministic
 * (seeded) so server and client render the same SVG; decorative only.
 */

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: () => number) {
  const u = Math.max(1e-9, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

const W = 320;
const H = 150;
const pts = (xs: number[], ys: number[]) => xs.map((x, i) => `${x.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ');

export function FanPreview() {
  const r = rng(7);
  const steps = 48;
  const n = 36;
  const x0 = 12;
  const y0 = H * 0.55;
  const xs = Array.from({ length: steps + 1 }, (_, i) => x0 + (i / steps) * (W - x0 - 8));
  const paths = Array.from({ length: n }, () => {
    let y = y0;
    const ys = [y];
    for (let i = 0; i < steps; i++) {
      y -= gauss(r) * 3.2 + 0.08;
      ys.push(y);
    }
    return ys;
  });
  const median = xs.map((_, i) => {
    const col = paths.map((p) => p[i]!).sort((a, b) => a - b);
    return col[Math.floor(col.length / 2)]!;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      <line x1={x0} x2={W - 8} y1={y0} y2={y0} stroke="var(--rule-strong)" strokeDasharray="2 3" />
      {paths.map((ys, k) => {
        const up = ys[ys.length - 1]! <= y0;
        return (
          <polyline
            key={k}
            points={pts(xs, ys)}
            fill="none"
            stroke={up ? 'var(--gain)' : 'var(--loss)'}
            strokeOpacity={0.45}
            strokeWidth={1}
            strokeDasharray={up ? undefined : '3 2'}
          />
        );
      })}
      <polyline points={pts(xs, median)} fill="none" stroke="var(--fg)" strokeWidth={2} />
    </svg>
  );
}

export function FrontierPreview() {
  const r = rng(11);
  const n = 140;
  const left = 16;
  const bottom = H - 12;
  const front = (v: number) => bottom - 118 * Math.sqrt(Math.max(0, (v - 0.12) / 0.88));
  const dots = Array.from({ length: n }, () => {
    const v = 0.14 + r() * 0.84;
    const top = front(v);
    const y = top + Math.pow(r(), 0.7) * (bottom - top) * 0.85 + 4;
    const sharpe = (bottom - y) / (v * 220);
    return { x: left + v * (W - left - 12), y, a: Math.min(0.9, 0.18 + sharpe * 0.7) };
  });
  const fx = Array.from({ length: 40 }, (_, i) => 0.12 + (i / 39) * 0.88);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      <line x1={left} x2={W - 8} y1={bottom} y2={bottom} stroke="var(--rule-strong)" />
      <line x1={left} x2={left} y1={8} y2={bottom} stroke="var(--rule-strong)" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={1.8} fill="var(--fg)" fillOpacity={d.a} />
      ))}
      <polyline
        points={pts(
          fx.map((v) => left + v * (W - left - 12)),
          fx.map(front),
        )}
        fill="none"
        stroke="var(--fg)"
        strokeWidth={2}
      />
      <circle cx={left + 0.42 * (W - left - 12)} cy={front(0.42)} r={5} fill="var(--gain)" stroke="var(--bg)" strokeWidth={1.5} />
      <rect x={left + 0.14 * (W - left - 12) - 4} y={front(0.14) - 4} width={8} height={8} fill="var(--fg)" stroke="var(--bg)" strokeWidth={1.5} />
    </svg>
  );
}

export function EquityPreview() {
  const r = rng(3);
  const steps = 90;
  const top = 92;
  const xs = Array.from({ length: steps + 1 }, (_, i) => 8 + (i / steps) * (W - 16));
  let e = 1;
  let b = 1;
  let peak = 1;
  const eq: number[] = [];
  const bm: number[] = [];
  const dd: number[] = [];
  for (let i = 0; i <= steps; i++) {
    if (i) {
      const shock = gauss(r) * 0.03;
      b *= 1 + 0.004 + shock;
      e *= 1 + 0.006 + shock * 0.7;
    }
    peak = Math.max(peak, e);
    eq.push(e);
    bm.push(b);
    dd.push(e / peak - 1);
  }
  const lo = Math.min(...eq, ...bm);
  const hi = Math.max(...eq, ...bm);
  const y = (v: number) => 8 + (1 - (v - lo) / (hi - lo)) * (top - 16);
  const minDd = Math.min(...dd, -0.01);
  const yd = (v: number) => top + 8 + (v / minDd) * (H - top - 14);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" aria-hidden>
      <polyline points={pts(xs, bm.map(y))} fill="none" stroke="var(--fg-muted)" strokeWidth={1} strokeDasharray="1 3" />
      <polyline points={pts(xs, eq.map(y))} fill="none" stroke="var(--fg)" strokeWidth={1.75} />
      <line x1={8} x2={W - 8} y1={top + 8} y2={top + 8} stroke="var(--rule-strong)" />
      <polygon
        points={`8,${top + 8} ${pts(xs, dd.map(yd))} ${W - 8},${top + 8}`}
        fill="var(--loss)"
        fillOpacity={0.2}
        stroke="var(--loss)"
        strokeWidth={1}
      />
    </svg>
  );
}
