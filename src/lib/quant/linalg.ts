/** Minimal dense linear algebra on row-major Float64Array (n ≤ ~50). */
export type Mat = { n: number; m: number; d: Float64Array };

export function mat(n: number, m: number, d?: ArrayLike<number>): Mat {
  return { n, m, d: d ? Float64Array.from(d) : new Float64Array(n * m) };
}

export function fromRows(rows: ReadonlyArray<ArrayLike<number>>): Mat {
  const n = rows.length;
  const m = n ? rows[0]!.length : 0;
  const out = mat(n, m);
  rows.forEach((r, i) => {
    for (let j = 0; j < m; j++) out.d[i * m + j] = r[j]!;
  });
  return out;
}

export function toRows(a: Mat): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < a.n; i++) out.push(Array.from(a.d.subarray(i * a.m, (i + 1) * a.m)));
  return out;
}

export function get(a: Mat, i: number, j: number): number {
  return a.d[i * a.m + j]!;
}

export function identity(n: number): Mat {
  const I = mat(n, n);
  for (let i = 0; i < n; i++) I.d[i * n + i] = 1;
  return I;
}

/** y = A x */
export function matVec(a: Mat, x: ArrayLike<number>, out = new Float64Array(a.n)): Float64Array {
  for (let i = 0; i < a.n; i++) {
    let s = 0;
    const row = i * a.m;
    for (let j = 0; j < a.m; j++) s += a.d[row + j]! * x[j]!;
    out[i] = s;
  }
  return out;
}

export function dot(x: ArrayLike<number>, y: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < x.length; i++) s += x[i]! * y[i]!;
  return s;
}

/** x' A x */
export function quadForm(a: Mat, x: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < a.n; i++) {
    let r = 0;
    const row = i * a.m;
    for (let j = 0; j < a.m; j++) r += a.d[row + j]! * x[j]!;
    s += x[i]! * r;
  }
  return s;
}

/** Cholesky A = L Lᵀ (lower). Returns null if not positive definite. */
export function cholesky(a: Mat): Mat | null {
  const n = a.n;
  const L = mat(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a.d[i * n + j]!;
      for (let k = 0; k < j; k++) s -= L.d[i * n + k]! * L.d[j * n + k]!;
      if (i === j) {
        if (s <= 0) return null;
        L.d[i * n + i] = Math.sqrt(s);
      } else {
        L.d[i * n + j] = s / L.d[j * n + j]!;
      }
    }
  }
  return L;
}

/** Solve A x = b for SPD A via Cholesky; falls back to Gaussian elimination. */
export function solve(a: Mat, b: ArrayLike<number>): Float64Array {
  const n = a.n;
  const L = cholesky(a);
  if (L) {
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let s = b[i]!;
      for (let k = 0; k < i; k++) s -= L.d[i * n + k]! * y[k]!;
      y[i] = s / L.d[i * n + i]!;
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i]!;
      for (let k = i + 1; k < n; k++) s -= L.d[k * n + i]! * x[k]!;
      x[i] = s / L.d[i * n + i]!;
    }
    return x;
  }
  // Gaussian elimination with partial pivoting
  const A = Float64Array.from(a.d);
  const x = Float64Array.from(b);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r * n + c]!) > Math.abs(A[p * n + c]!)) p = r;
    if (Math.abs(A[p * n + c]!) < 1e-300) throw new Error('singular matrix');
    if (p !== c) {
      for (let k = 0; k < n; k++) [A[c * n + k], A[p * n + k]] = [A[p * n + k]!, A[c * n + k]!];
      [x[c], x[p]] = [x[p]!, x[c]!];
    }
    for (let r = c + 1; r < n; r++) {
      const f = A[r * n + c]! / A[c * n + c]!;
      for (let k = c; k < n; k++) A[r * n + k]! -= f * A[c * n + k]!;
      x[r]! -= f * x[c]!;
    }
  }
  for (let r = n - 1; r >= 0; r--) {
    let s = x[r]!;
    for (let k = r + 1; k < n; k++) s -= A[r * n + k]! * x[k]!;
    x[r] = s / A[r * n + r]!;
  }
  return x;
}

/** Largest eigenvalue of a symmetric PSD matrix (power iteration). */
export function maxEigen(a: Mat, iters = 200): number {
  let v = new Float64Array(a.n).fill(1 / Math.sqrt(a.n));
  let lambda = 0;
  const w = new Float64Array(a.n);
  for (let it = 0; it < iters; it++) {
    matVec(a, v, w);
    const norm = Math.sqrt(dot(w, w));
    if (norm === 0) return 0;
    const next = w.map((x) => x / norm);
    const l = dot(next, matVec(a, next));
    v = next;
    if (Math.abs(l - lambda) < 1e-14 * Math.abs(l)) return l;
    lambda = l;
  }
  return lambda;
}
