/**
 * Classical multidimensional scaling of a correlation matrix into 3D:
 * distance d_ij = √(2(1−ρ_ij)) (0 for identical, 2 for perfectly opposite),
 * so correlated assets sit close together ("attract").
 */
export function correlationLayout(corr: number[][], dims = 3): number[][] {
  const n = corr.length;
  if (n === 0) return [];
  const D2 = corr.map((row) => row.map((r) => 2 * (1 - Math.max(-1, Math.min(1, r)))));
  // double centering: B = −½ J D² J
  const rowMean = D2.map((r) => r.reduce((a, b) => a + b, 0) / n);
  const all = rowMean.reduce((a, b) => a + b, 0) / n;
  const B = D2.map((r, i) => r.map((v, j) => -0.5 * (v - rowMean[i]! - rowMean[j]! + all)));
  const coords = Array.from({ length: n }, () => new Array<number>(dims).fill(0));
  const M = B.map((r) => r.slice());
  for (let k = 0; k < dims; k++) {
    // power iteration for the top eigenpair, then deflate
    let v = Array.from({ length: n }, (_, i) => Math.sin(i * 1.7 + k * 3.1 + 1));
    let lambda = 0;
    for (let it = 0; it < 200; it++) {
      const w = M.map((r) => r.reduce((a, x, j) => a + x * v[j]!, 0));
      const norm = Math.hypot(...w) || 1;
      v = w.map((x) => x / norm);
      lambda = v.reduce((a, x, i) => a + x * M[i]!.reduce((b, y, j) => b + y * v[j]!, 0), 0);
    }
    const s = Math.sqrt(Math.max(0, lambda));
    for (let i = 0; i < n; i++) coords[i]![k] = v[i]! * s;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) M[i]![j]! -= lambda * v[i]! * v[j]!;
  }
  return coords;
}
