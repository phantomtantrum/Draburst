'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

/**
 * Portfolio space (design-system pages/portfolio.md):
 *   x = volatility, y = expected return, z = Sharpe.
 * Random portfolios are points whose luminance ∝ Sharpe; the efficient
 * frontier is a white tube ("ridge"); named portfolios are solid glyph meshes.
 */

const SX = 6,
  SY = 4,
  SZ = 3;

const pointVert = /* glsl */ `
attribute float aLum;
attribute float aHot;
varying float vLum;
varying float vHot;
uniform float uSize;
void main() {
  vLum = aLum;
  vHot = aHot;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = uSize * (1.0 + aHot * 2.5) * (10.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const pointFrag = /* glsl */ `
varying float vLum;
varying float vHot;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (max(abs(c.x), abs(c.y)) > 0.5) discard;
  float l = mix(0.18, 1.0, vLum);
  gl_FragColor = vec4(vec3(max(l, vHot)), mix(0.75, 1.0, vHot));
}`;

export interface Space {
  vol: [number, number];
  ret: [number, number];
  sharpe: [number, number];
}

export function spaceOf(cloud: { vol: Float32Array; ret: Float32Array; sharpe: Float32Array }, extra: Array<{ vol: number; ret: number; sharpe: number }>): Space {
  let v0 = Infinity,
    v1 = -Infinity,
    r0 = Infinity,
    r1 = -Infinity,
    s0 = Infinity,
    s1 = -Infinity;
  const take = (v: number, r: number, s: number) => {
    v0 = Math.min(v0, v);
    v1 = Math.max(v1, v);
    r0 = Math.min(r0, r);
    r1 = Math.max(r1, r);
    if (Number.isFinite(s)) {
      s0 = Math.min(s0, s);
      s1 = Math.max(s1, s);
    }
  };
  for (let i = 0; i < cloud.vol.length; i++) take(cloud.vol[i]!, cloud.ret[i]!, cloud.sharpe[i]!);
  for (const p of extra) take(p.vol, p.ret, p.sharpe);
  return { vol: [v0, v1], ret: [r0, r1], sharpe: [s0, s1] };
}

const norm = (v: number, [a, b]: [number, number], s: number) => ((v - a) / (b - a || 1) - 0.5) * s;

export function PortfolioCloud3D({
  cloud,
  frontier,
  markers,
  hovered,
  onHover,
}: {
  cloud: { vol: Float32Array; ret: Float32Array; sharpe: Float32Array };
  frontier: Array<{ vol: number; ret: number; sharpe: number }>;
  markers: Array<{ key: string; vol: number; ret: number; sharpe: number; glyph: 'square' | 'disc' | 'diamond' | 'ring' }>;
  hovered: number | null;
  onHover: (i: number | null) => void;
}) {
  const space = useMemo(() => spaceOf(cloud, [...frontier, ...markers]), [cloud, frontier, markers]);
  const P = (v: number, r: number, s: number) =>
    new THREE.Vector3(norm(v, space.vol, SX), norm(r, space.ret, SY), norm(Number.isFinite(s) ? s : space.sharpe[0], space.sharpe, SZ));

  const geo = useMemo(() => {
    const n = cloud.vol.length;
    const pos = new Float32Array(n * 3);
    const lum = new Float32Array(n);
    const [s0, s1] = space.sharpe;
    for (let i = 0; i < n; i++) {
      pos[i * 3] = norm(cloud.vol[i]!, space.vol, SX);
      pos[i * 3 + 1] = norm(cloud.ret[i]!, space.ret, SY);
      pos[i * 3 + 2] = norm(cloud.sharpe[i]!, space.sharpe, SZ);
      lum[i] = (cloud.sharpe[i]! - s0) / (s1 - s0 || 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aLum', new THREE.BufferAttribute(lum, 1));
    g.setAttribute('aHot', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.computeBoundingSphere();
    return g;
  }, [cloud, space]);
  useEffect(() => () => geo.dispose(), [geo]);

  useEffect(() => {
    const a = geo.getAttribute('aHot') as THREE.BufferAttribute;
    (a.array as Float32Array).fill(0);
    if (hovered != null && hovered < a.count) (a.array as Float32Array)[hovered] = 1;
    a.needsUpdate = true;
  }, [geo, hovered]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: pointVert,
        fragmentShader: pointFrag,
        uniforms: { uSize: { value: cloud.vol.length > 8000 ? 2.2 : 3 } },
        transparent: true,
        depthWrite: false,
      }),
    [cloud.vol.length],
  );
  useEffect(() => () => mat.dispose(), [mat]);

  const tube = useMemo(() => {
    if (frontier.length < 2) return null;
    const pts = frontier.map((p) => P(p.vol, p.ret, p.sharpe));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(32, pts.length * 6), 0.035, 8, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontier, space]);
  useEffect(() => () => tube?.dispose(), [tube]);

  return (
    <group>
      <points
        geometry={geo}
        material={mat}
        onPointerMove={(e) => {
          e.stopPropagation();
          onHover(e.index ?? null);
        }}
        onPointerOut={() => onHover(null)}
      />
      {tube && (
        <mesh geometry={tube}>
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      )}
      {markers.map((m) => {
        const p = P(m.vol, m.ret, m.sharpe);
        return (
          <mesh key={m.key} position={p}>
            {m.glyph === 'square' && <boxGeometry args={[0.2, 0.2, 0.2]} />}
            {m.glyph === 'disc' && <sphereGeometry args={[0.13, 20, 14]} />}
            {m.glyph === 'diamond' && <octahedronGeometry args={[0.15]} />}
            {m.glyph === 'ring' && <torusGeometry args={[0.13, 0.025, 8, 24]} />}
            <meshBasicMaterial color={0xffffff} wireframe={false} />
          </mesh>
        );
      })}
      <Axes />
    </group>
  );
}

function Axes() {
  const geo = useMemo(() => {
    const v = [
      [-SX / 2, -SY / 2, -SZ / 2, SX / 2, -SY / 2, -SZ / 2],
      [-SX / 2, -SY / 2, -SZ / 2, -SX / 2, SY / 2, -SZ / 2],
      [-SX / 2, -SY / 2, -SZ / 2, -SX / 2, -SY / 2, SZ / 2],
    ].flat();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    return g;
  }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <>
      <lineSegments geometry={geo}>
        <lineBasicMaterial color={0x8a8a8a} />
      </lineSegments>
      <gridHelper args={[SX + 1, 14, 0x2e2e2e, 0x171717]} position={[0, -SY / 2 - 0.01, 0]} />
    </>
  );
}

/**
 * Correlation as a bar field: height = ρ. Positive bars rise as solid
 * blocks (luminance ∝ ρ); negative bars hang below the plane as wireframes.
 */
export function CorrField3D({ corr }: { corr: number[][] }) {
  const n = corr.length;
  const cell = Math.min(0.55, 6 / n);
  const { pos, neg, box } = useMemo(() => {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const pos: Array<{ m: THREE.Matrix4; l: number }> = [];
    const wire: number[] = [];
    const edges = new THREE.EdgesGeometry(box);
    const ep = edges.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const r = corr[i]![j]!;
        const h = Math.max(0.01, Math.abs(r) * 2.2);
        const m = new THREE.Matrix4().compose(
          new THREE.Vector3((j - (n - 1) / 2) * cell, r >= 0 ? h / 2 : -h / 2, (i - (n - 1) / 2) * cell),
          new THREE.Quaternion(),
          new THREE.Vector3(cell * 0.82, h, cell * 0.82),
        );
        if (r >= 0) pos.push({ m, l: 0.25 + 0.75 * r });
        else {
          const v = new THREE.Vector3();
          for (let k = 0; k < ep.count; k++) {
            v.fromBufferAttribute(ep, k).applyMatrix4(m);
            wire.push(v.x, v.y, v.z);
          }
        }
      }
    edges.dispose();
    const neg = new THREE.BufferGeometry();
    neg.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
    return { pos, neg, box };
  }, [corr, n, cell]);
  useEffect(
    () => () => {
      box.dispose();
      neg.dispose();
    },
    [box, neg],
  );
  return (
    <group position={[0, -0.6, 0]}>
      <instancedMesh
        args={[box, undefined, Math.max(1, pos.length)]}
        ref={(m) => {
          if (!m) return;
          const c = new THREE.Color();
          pos.forEach((p, i) => {
            m.setMatrixAt(i, p.m);
            m.setColorAt(i, c.setScalar(p.l));
          });
          m.count = pos.length;
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        }}
      >
        <meshBasicMaterial color={0xffffff} />
      </instancedMesh>
      <lineSegments geometry={neg}>
        <lineBasicMaterial color={0xb0b0b0} />
      </lineSegments>
      <gridHelper args={[n * cell + 0.4, n, 0x474747, 0x1f1f1f]} />
    </group>
  );
}
