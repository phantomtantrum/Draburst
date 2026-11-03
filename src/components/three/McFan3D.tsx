'use client';

import { useEffect, useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { McDisplay } from '@/lib/hooks/useMonteCarlo';

/**
 * Monte Carlo as a volumetric fan (design-system pages/monte-carlo.md):
 *   x = time, y = log price, z = rank of the path by terminal value.
 * Thousands of additive white lines → density emerges; the post pass dithers it.
 * Paths ending below S₀ are DASHED (fragment discard), above are solid.
 * The terminal distribution rises as a histogram wall at x = T:
 * bins ≥ S₀ solid, bins < S₀ wireframe.
 */

const W = 8; // time extent
const HGT = 4.6; // price extent
const D = 4; // rank extent

const lineVert = /* glsl */ `
attribute float aDown;
attribute float aX;
varying float vDown;
varying float vX;
varying float vFog;
void main() {
  vDown = aDown;
  vX = aX;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = smoothstep(22.0, 6.0, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;

const lineFrag = /* glsl */ `
uniform float uAlpha;
varying float vDown;
varying float vX;
varying float vFog;
void main() {
  if (vDown > 0.5 && fract(vX * 9.0) > 0.5) discard;
  gl_FragColor = vec4(vec3(1.0), uAlpha * vFog);
}`;

export interface FanScale {
  lo: number;
  hi: number;
}

/** Closed-form lognormal 1%/99% bounds — stable while paths stream in. */
export function approxFanScale(s0: number, mu: number, sigma: number, years: number): FanScale {
  const m = (mu - 0.5 * sigma * sigma) * years;
  const s = sigma * Math.sqrt(years);
  return { lo: Math.min(s0, s0 * Math.exp(m - 2.33 * s)) * 0.95, hi: Math.max(s0, s0 * Math.exp(m + 2.33 * s)) * 1.05 };
}

export function fanScale(s0: number, terminal: ArrayLike<number>, bands?: Float64Array[]): FanScale {
  const arr = Float64Array.from(terminal as ArrayLike<number>).sort();
  const q = (p: number) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(p * (arr.length - 1)))]! : s0);
  let lo = Math.min(s0, q(0.01)),
    hi = Math.max(s0, q(0.99));
  if (bands) {
    lo = Math.min(lo, ...Array.from(bands[0]!));
    hi = Math.max(hi, ...Array.from(bands[4]!));
  }
  return { lo: lo * 0.95, hi: hi * 1.05 };
}

export function McFan3D({
  display,
  s0,
  target,
  bands,
  grid,
  histogram,
  scale,
}: {
  display: McDisplay | null;
  s0: number;
  target: number | null;
  bands?: Float64Array[];
  grid?: Int32Array;
  histogram?: { edges: Float64Array; counts: Uint32Array };
  scale: FanScale;
}) {
  const ly = useMemo(() => {
    const a = Math.log(scale.lo),
      b = Math.log(scale.hi);
    return (p: number) => {
      const t = (Math.log(Math.max(p, 1e-12)) - a) / (b - a);
      return (Math.min(1.08, Math.max(-0.08, t)) - 0.5) * HGT;
    };
  }, [scale]);

  // ── paths ──
  const lines = useMemo(() => {
    if (!display || display.count === 0) return null;
    const { paths, terminal, count, G } = display;
    // rank by terminal → z
    const order = Array.from({ length: count }, (_, i) => i).sort((i, j) => terminal[i]! - terminal[j]!);
    const zOf = new Float32Array(count);
    order.forEach((idx, r) => (zOf[idx] = (count > 1 ? r / (count - 1) - 0.5 : 0) * D));
    const segs = G - 1;
    const pos = new Float32Array(count * segs * 6);
    const down = new Float32Array(count * segs * 2);
    const ax = new Float32Array(count * segs * 2);
    let k = 0,
      a = 0;
    for (let i = 0; i < count; i++) {
      const z = zOf[i]!;
      const isDown = terminal[i]! < s0 ? 1 : 0;
      for (let g = 0; g < segs; g++) {
        const x0 = (g / segs - 0.5) * W,
          x1 = ((g + 1) / segs - 0.5) * W;
        pos[k++] = x0;
        pos[k++] = ly(paths[i * G + g]!);
        pos[k++] = z;
        pos[k++] = x1;
        pos[k++] = ly(paths[i * G + g + 1]!);
        pos[k++] = z;
        down[a] = isDown;
        down[a + 1] = isDown;
        ax[a] = x0;
        ax[a + 1] = x1;
        a += 2;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aDown', new THREE.BufferAttribute(down, 1));
    geo.setAttribute('aX', new THREE.BufferAttribute(ax, 1));
    geo.computeBoundingSphere();
    return { geo, count };
  }, [display, s0, ly]);

  // more paths → fainter lines, so density (not count) is what you see
  const alpha = lines ? Math.round(Math.min(0.45, Math.max(0.035, 28 / lines.count)) * 200) / 200 : 0.1;
  const lineMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: lineVert,
        fragmentShader: lineFrag,
        uniforms: { uAlpha: { value: alpha } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [alpha],
  );
  useEffect(() => () => lines?.geo.dispose(), [lines]);
  useEffect(() => () => lineMat.dispose(), [lineMat]);

  // ── histogram wall ──
  const wall = useMemo(() => {
    if (!histogram) return null;
    const { edges, counts } = histogram;
    const max = Math.max(...Array.from(counts));
    const solid: THREE.Matrix4[] = [];
    const wire: number[] = [];
    const box = new THREE.BoxGeometry(1, 1, 1);
    const edgesGeo = new THREE.EdgesGeometry(box);
    const ep = edgesGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < counts.length; i++) {
      const c = counts[i]!;
      if (c === 0) continue;
      const y0 = ly(edges[i]!),
        y1 = ly(edges[i + 1]!);
      const h = Math.max(0.002, Math.abs(y1 - y0) * 0.86);
      const len = (c / max) * 2.4;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(W / 2 + 0.15 + len / 2, (y0 + y1) / 2, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(len, h, D),
      );
      if ((edges[i]! + edges[i + 1]!) / 2 >= s0) solid.push(m);
      else {
        const v = new THREE.Vector3();
        for (let j = 0; j < ep.count; j++) {
          v.fromBufferAttribute(ep, j).applyMatrix4(m);
          wire.push(v.x, v.y, v.z);
        }
      }
    }
    edgesGeo.dispose();
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    return { box, solid, wireGeo };
  }, [histogram, ly, s0]);
  useEffect(
    () => () => {
      wall?.box.dispose();
      wall?.wireGeo.dispose();
    },
    [wall],
  );

  // ── percentile curves at their rank depth ──
  const curves = useMemo(() => {
    if (!bands || !grid) return [];
    const G = grid.length;
    const H = grid[G - 1]!;
    const zFor = [0.05, 0.25, 0.5, 0.75, 0.95].map((p) => (p - 0.5) * D);
    return bands.map((b, j) => ({
      pts: Array.from(b, (v, g) => new THREE.Vector3((grid[g]! / H - 0.5) * W, ly(v), zFor[j]!)),
      width: j === 2 ? 2.2 : 1,
      dashed: j < 2,
      gray: j === 2 ? 1 : 0.75,
    }));
  }, [bands, grid, ly]);

  const y0 = ly(s0);
  const yT = target != null ? ly(target) : null;
  const floor = -HGT / 2 - 0.25;

  return (
    <group position={[-1, 0, 0]}>
      {lines && <lineSegments geometry={lines.geo} material={lineMat} frustumCulled={false} />}

      {curves.map((c, i) => (
        <Line key={i} points={c.pts} color={new THREE.Color(c.gray, c.gray, c.gray)} lineWidth={c.width} dashed={c.dashed} dashSize={0.12} gapSize={0.08} />
      ))}

      {/* S₀ plane edge and target */}
      <Line points={[new THREE.Vector3(-W / 2, y0, -D / 2), new THREE.Vector3(W / 2, y0, -D / 2), new THREE.Vector3(W / 2, y0, D / 2)]} color="white" lineWidth={1} dashed dashSize={0.04} gapSize={0.06} />
      {yT != null && (
        <Line points={[new THREE.Vector3(-W / 2, yT, D / 2), new THREE.Vector3(W / 2 + 2.6, yT, D / 2)]} color="white" lineWidth={1.4} dashed dashSize={0.2} gapSize={0.1} />
      )}

      {wall && (
        <>
          <instancedMesh
            args={[wall.box, undefined, Math.max(1, wall.solid.length)]}
            ref={(m) => {
              if (!m) return;
              wall.solid.forEach((mat, i) => m.setMatrixAt(i, mat));
              m.count = wall.solid.length;
              m.instanceMatrix.needsUpdate = true;
            }}
          >
            <meshBasicMaterial color={new THREE.Color(0.82, 0.82, 0.82)} transparent opacity={0.92} />
          </instancedMesh>
          <lineSegments geometry={wall.wireGeo}>
            <lineBasicMaterial color={new THREE.Color(0.7, 0.7, 0.7)} transparent opacity={0.8} />
          </lineSegments>
        </>
      )}

      {/* floor hairlines (instrument grid) */}
      <gridHelper args={[14, 28, new THREE.Color(0.22, 0.22, 0.22), new THREE.Color(0.1, 0.1, 0.1)]} position={[1, floor, 0]} />
    </group>
  );
}
