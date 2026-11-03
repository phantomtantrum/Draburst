'use client';

import { useEffect, useMemo, useState } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Backtest sculptures (design-system pages/backtest.md).
 *
 * EquityRibbon3D — equity extruded through time: x = time, y = log equity,
 *   ribbon width = exposure. A solid "landscape" wall drops to the floor;
 *   drawdowns are carved out as a ghost of vertical hairlines between the
 *   running peak and equity. Entries ▲ solid cones, exits ▽ wireframe.
 *
 * SweepSurface3D — Sharpe over two parameters: solid where Sharpe > 0,
 *   wireframe where ≤ 0, white pin at the current parameters. Click to load.
 */

const W = 9;
const H = 3.6;
const FLOOR = -H / 2 - 0.35;

function downsample(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (max - 1);
  return Array.from({ length: max }, (_, k) => Math.round(k * step));
}

export function EquityRibbon3D({
  equity,
  benchmark,
  exposure,
  trades,
}: {
  equity: Float64Array;
  benchmark: Float64Array;
  exposure: Float64Array;
  trades: Array<{ entryIndex: number; exitIndex: number; reason: string }>;
}) {
  const built = useMemo(() => {
    const n = equity.length;
    const idx = downsample(n, 700);
    const m = idx.length;
    let lo = Infinity,
      hi = -Infinity;
    for (let i = 0; i < n; i++) {
      lo = Math.min(lo, equity[i]!, benchmark[i]!);
      hi = Math.max(hi, equity[i]!, benchmark[i]!);
    }
    const a = Math.log(Math.max(lo, 1e-9)),
      b = Math.log(Math.max(hi, lo * 1.0001));
    const ly = (v: number) => ((Math.log(Math.max(v, 1e-9)) - a) / (b - a || 1) - 0.5) * H;
    const xOf = (i: number) => (i / (n - 1) - 0.5) * W;

    // running peak (full resolution), then sampled
    const peak = new Float64Array(n);
    let pk = -Infinity;
    for (let i = 0; i < n; i++) peak[i] = pk = Math.max(pk, equity[i]!);

    const top = new Float32Array(m * 2 * 3);
    const wall = new Float32Array(m * 2 * 3);
    const carve: number[] = [];
    const peakPts: THREE.Vector3[] = [];
    const benchPts: THREE.Vector3[] = [];
    idx.forEach((i, k) => {
      const x = xOf(i);
      const y = ly(equity[i]!);
      const w = 0.18 + Math.min(1.5, Math.max(0, exposure[i]!)) * 0.9;
      top.set([x, y, -w / 2, x, y, w / 2], k * 6);
      wall.set([x, FLOOR, w / 2, x, y, w / 2], k * 6);
      const yp = ly(peak[i]!);
      if (yp - y > 0.01) carve.push(x, y, 0, x, yp, 0);
      peakPts.push(new THREE.Vector3(x, yp, 0));
      benchPts.push(new THREE.Vector3(x, ly(benchmark[i]!), -1.3));
    });
    const strip = (pos: Float32Array) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const ind: number[] = [];
      for (let k = 0; k < m - 1; k++) {
        const p = k * 2;
        ind.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
      }
      g.setIndex(ind);
      return g;
    };
    const carveGeo = new THREE.BufferGeometry();
    carveGeo.setAttribute('position', new THREE.Float32BufferAttribute(carve, 3));

    const shown = trades.slice(0, 300);
    const entries = shown.map((t) => new THREE.Vector3(xOf(t.entryIndex), ly(equity[t.entryIndex]!) + 0.16, 0.9));
    const exits = shown.map((t) => new THREE.Vector3(xOf(t.exitIndex), ly(equity[t.exitIndex]!) + 0.16, 0.9));
    return { topGeo: strip(top), wallGeo: strip(wall), carveGeo, peakPts, benchPts, entries, exits };
  }, [equity, benchmark, exposure, trades]);

  useEffect(
    () => () => {
      built.topGeo.dispose();
      built.wallGeo.dispose();
      built.carveGeo.dispose();
    },
    [built],
  );
  const cone = useMemo(() => new THREE.ConeGeometry(0.05, 0.12, 4), []);
  useEffect(() => () => cone.dispose(), [cone]);

  return (
    <group position={[0, 0.2, 0]}>
      <mesh geometry={built.topGeo}>
        <meshBasicMaterial color={0xededed} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={built.wallGeo}>
        <meshBasicMaterial color={0x474747} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <lineSegments geometry={built.carveGeo}>
        <lineBasicMaterial color={0x8a8a8a} transparent opacity={0.7} />
      </lineSegments>
      <Line points={built.peakPts} color="white" lineWidth={1} dashed dashSize={0.06} gapSize={0.05} />
      <Line points={built.benchPts} color={0xb0b0b0} lineWidth={1.2} dashed dashSize={0.02} gapSize={0.06} />
      {built.entries.length > 0 && (
        <instancedMesh
          args={[cone, undefined, built.entries.length]}
          ref={(m) => {
            if (!m) return;
            const o = new THREE.Object3D();
            built.entries.forEach((p, i) => {
              o.position.copy(p);
              o.rotation.set(0, 0, 0);
              o.updateMatrix();
              m.setMatrixAt(i, o.matrix);
            });
            m.instanceMatrix.needsUpdate = true;
          }}
        >
          <meshBasicMaterial color={0xffffff} />
        </instancedMesh>
      )}
      {built.exits.length > 0 && (
        <instancedMesh
          args={[cone, undefined, built.exits.length]}
          ref={(m) => {
            if (!m) return;
            const o = new THREE.Object3D();
            built.exits.forEach((p, i) => {
              o.position.copy(p);
              o.rotation.set(Math.PI, 0, 0);
              o.updateMatrix();
              m.setMatrixAt(i, o.matrix);
            });
            m.instanceMatrix.needsUpdate = true;
          }}
        >
          <meshBasicMaterial color={0xffffff} wireframe />
        </instancedMesh>
      )}
      <gridHelper args={[W + 2, 22, 0x2e2e2e, 0x171717]} position={[0, FLOOR, 0]} />
    </group>
  );
}

const surfVert = /* glsl */ `
attribute float aVal;
varying float vVal;
void main() {
  vVal = aVal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const surfFrag = /* glsl */ `
varying float vVal;
void main() {
  if (vVal <= 0.0) discard;
  float l = mix(0.35, 1.0, clamp(vVal, 0.0, 1.0));
  gl_FragColor = vec4(vec3(l), 1.0);
}`;

export function SweepSurface3D({
  xs,
  ys,
  values,
  current,
  onPick,
  onHover,
}: {
  xs: number[];
  ys: number[];
  values: Float64Array;
  current: { x: number; y: number } | null;
  onPick: (x: number, y: number) => void;
  onHover: (cell: { i: number; j: number } | null) => void;
}) {
  const SX = 6,
    SZ = 6;
  const nx = xs.length,
    ny = ys.length;
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const geo = useMemo(() => {
    const finite = Array.from(values).filter(Number.isFinite);
    const max = Math.max(0.05, ...finite.map(Math.abs));
    const minV = finite.length ? Math.min(...finite) : 0;
    const pos = new Float32Array(nx * ny * 3);
    const val = new Float32Array(nx * ny);
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const k = j * nx + i;
        const v = values[k]!;
        const vv = Number.isFinite(v) ? v : minV;
        pos[k * 3] = (i / Math.max(1, nx - 1) - 0.5) * SX;
        pos[k * 3 + 1] = (vv / max) * 1.6;
        pos[k * 3 + 2] = -(j / Math.max(1, ny - 1) - 0.5) * SZ;
        val[k] = Number.isFinite(v) ? v / max : -1;
      }
    const ind: number[] = [];
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = j * nx + i,
          b = a + 1,
          c = a + nx,
          d = c + 1;
        ind.push(a, c, b, b, c, d);
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aVal', new THREE.BufferAttribute(val, 1));
    g.setIndex(ind);
    g.computeBoundingSphere();
    return { g, max };
  }, [values, nx, ny]);
  useEffect(() => () => geo.g.dispose(), [geo]);

  const solid = useMemo(() => new THREE.ShaderMaterial({ vertexShader: surfVert, fragmentShader: surfFrag, side: THREE.DoubleSide }), []);
  useEffect(() => () => solid.dispose(), [solid]);

  const cellAt = (p: THREE.Vector3) => {
    const i = Math.round((p.x / SX + 0.5) * (nx - 1));
    const j = Math.round((-p.z / SZ + 0.5) * (ny - 1));
    return i >= 0 && i < nx && j >= 0 && j < ny ? { i, j } : null;
  };
  const posOf = (i: number, j: number) => {
    const v = values[j * nx + i]!;
    return new THREE.Vector3((i / Math.max(1, nx - 1) - 0.5) * SX, ((Number.isFinite(v) ? v : 0) / geo.max) * 1.6, -(j / Math.max(1, ny - 1) - 0.5) * SZ);
  };
  const ci = current ? xs.indexOf(current.x) : -1;
  const cj = current ? ys.indexOf(current.y) : -1;
  const pin = ci >= 0 && cj >= 0 ? posOf(ci, cj) : null;
  const hp = hover ? posOf(hover.i, hover.j) : null;

  return (
    <group position={[0, -0.4, 0]}>
      <mesh geometry={geo.g} material={solid} />
      <mesh
        geometry={geo.g}
        onPointerMove={(e) => {
          e.stopPropagation();
          const c = cellAt(e.point);
          setHover(c);
          onHover(c);
        }}
        onPointerOut={() => {
          setHover(null);
          onHover(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          const c = cellAt(e.point);
          if (c && Number.isFinite(values[c.j * nx + c.i]!)) onPick(xs[c.i]!, ys[c.j]!);
        }}
      >
        <meshBasicMaterial color={0x6b6b6b} wireframe transparent opacity={0.6} />
      </mesh>
      {/* zero plane outline */}
      <lineLoop position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([-SX / 2, 0, -SZ / 2, SX / 2, 0, -SZ / 2, SX / 2, 0, SZ / 2, -SX / 2, 0, SZ / 2]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={0x474747} />
      </lineLoop>
      {pin && (
        <>
          <Line points={[new THREE.Vector3(pin.x, Math.min(0, pin.y), pin.z), new THREE.Vector3(pin.x, pin.y + 0.9, pin.z)]} color="white" lineWidth={2} />
          <mesh position={[pin.x, pin.y + 0.95, pin.z]}>
            <sphereGeometry args={[0.07, 16, 12]} />
            <meshBasicMaterial color={0xffffff} />
          </mesh>
        </>
      )}
      {hp && (
        <mesh position={[hp.x, hp.y + 0.05, hp.z]}>
          <boxGeometry args={[SX / nx, 0.02, SZ / ny]} />
          <meshBasicMaterial color={0xffffff} wireframe />
        </mesh>
      )}
    </group>
  );
}
