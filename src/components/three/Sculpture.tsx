'use client';
/* eslint-disable react-hooks/immutability -- three.js uniforms and scene objects are mutated inside useFrame by design (standard R3F hot-loop pattern); nothing here feeds React rendering. */

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createRng } from '@/lib/quant/prng';

/**
 * Live market sculpture (design-system pages/home.md).
 * One particle system; each asset is a cluster:
 *   turbulence = realized volatility, scale = 24h quote volume,
 *   position = correlation layout (correlated assets attract).
 * Every live tick launches a ripple across its cluster (up-tick: solid ring,
 * down-tick: dashed ring). The cursor repels particles. `morph` (0…3)
 * re-forms all particles into the three tools: fan → cloud → ribbon.
 */

export const MAX_CLUSTERS = 12;

export interface ClusterState {
  center: [number, number, number];
  scale: number;
  turbulence: number;
  rippleT: number;
  rippleSign: number;
  rippleAmp: number;
}

export interface SculptureInputs {
  /** mutable: read every frame (no React re-render per tick) */
  clusters: ClusterState[];
  /** mutable target morph 0..3 */
  morph: { target: number };
  /** shader clock (seconds), written by the scene every frame */
  clock: { now: number };
}

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.5-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 105.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const vert = /* glsl */ `
#define MAXC ${MAX_CLUSTERS}
attribute float aCluster;
attribute vec3 aSphere;
attribute vec3 aFan;
attribute vec3 aCloud;
attribute vec3 aRibbon;
attribute float aSeed;
uniform float uTime;
uniform float uMorph;
uniform vec3 uMouse;
uniform float uMouseOn;
uniform vec3 uCenter[MAXC];
uniform float uScale[MAXC];
uniform float uTurb[MAXC];
uniform float uRippleT[MAXC];
uniform float uRippleSign[MAXC];
uniform float uRippleAmp[MAXC];
uniform float uSize;
varying float vAlpha;
${NOISE}
void main() {
  int c = int(aCluster + 0.5);
  vec3 dir = aSphere;
  float turb = uTurb[c];
  float n = snoise(dir * 1.6 + vec3(uTime * (0.15 + turb * 0.6), aCluster * 7.1, 0.0));
  float r = uScale[c] * (1.0 + n * (0.08 + turb * 0.55));
  // ripple: a ring travelling from the cluster's pole
  float age = uTime - uRippleT[c];
  float theta = acos(clamp(dir.y, -1.0, 1.0));
  float front = age * 2.4;
  float band = exp(-pow((theta - front) * 3.0, 2.0)) * exp(-age * 1.4);
  float dashed = uRippleSign[c] < 0.0 ? step(0.5, fract(atan(dir.z, dir.x) * 2.5)) : 1.0;
  r += band * uRippleAmp[c] * dashed;
  vec3 sculpt = uCenter[c] + dir * r;

  // morph targets: sculpture → fan → cloud → ribbon
  vec3 p = sculpt;
  float m = clamp(uMorph, 0.0, 3.0);
  if (m <= 1.0) p = mix(sculpt, aFan, smoothstep(0.0, 1.0, m));
  else if (m <= 2.0) p = mix(aFan, aCloud, smoothstep(0.0, 1.0, m - 1.0));
  else p = mix(aCloud, aRibbon, smoothstep(0.0, 1.0, m - 2.0));
  float settle = 1.0 - smoothstep(0.0, 0.6, m) * 0.8;
  p += vec3(snoise(p * 0.7 + uTime * 0.2), snoise(p * 0.7 + 11.0 + uTime * 0.2), 0.0) * 0.04 * (1.0 + turb) * (1.0 - settle * 0.0);

  // cursor disturbance (repel)
  vec3 d = p - uMouse;
  float f = exp(-dot(d, d) * 1.6) * uMouseOn;
  p += normalize(d + 1e-4) * f * 0.55;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = uSize * (0.6 + 0.8 * fract(aSeed * 13.7)) * (12.0 / -mv.z);
  vAlpha = 0.35 + 0.65 * band * dashed + 0.15 * f;
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;
  gl_FragColor = vec4(vec3(1.0), clamp(vAlpha, 0.0, 1.0));
}`;

function buildTargets(count: number, nClusters: number, per: number) {
  const rng = createRng(0x51c0);
  const cluster = new Float32Array(count);
  const sphere = new Float32Array(count * 3);
  const fan = new Float32Array(count * 3);
  const cloud = new Float32Array(count * 3);
  const ribbon = new Float32Array(count * 3);
  const seed = new Float32Array(count);

  // fan: K random-walk paths of length L, ranked by terminal value → z
  const K = 160;
  const L = Math.ceil(count / K);
  const walks: Float32Array[] = [];
  const ends: number[] = [];
  for (let k = 0; k < K; k++) {
    const w = new Float32Array(L);
    let x = 0;
    for (let t = 0; t < L; t++) {
      x += 0.11 * rng.normal() + 0.004;
      w[t] = x;
    }
    walks.push(w);
    ends.push(w[L - 1]!);
  }
  const rank = ends.map((e, i) => [e, i] as const).sort((a, b) => a[0] - b[0]);
  const zOf = new Float32Array(K);
  rank.forEach(([, i], r) => (zOf[i] = (r / (K - 1) - 0.5) * 3.2));

  // ribbon: one equity walk
  const eq = new Float32Array(1024);
  let e = 0,
    peak = -Infinity;
  for (let i = 0; i < 1024; i++) {
    e += 0.03 * rng.normal() + 0.0035;
    peak = Math.max(peak, e);
    eq[i] = e;
  }

  for (let i = 0; i < count; i++) {
    cluster[i] = Math.min(nClusters - 1, Math.floor(i / per));
    // uniform direction on the sphere
    const u = rng.next() * 2 - 1,
      th = rng.next() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    sphere.set([s * Math.cos(th), u, s * Math.sin(th)], i * 3);
    seed[i] = rng.next();

    const k = i % K,
      t = Math.floor(i / K);
    fan.set([(t / (L - 1) - 0.5) * 7, walks[k]![t]! * 0.9, zOf[k]!], i * 3);

    // cloud: below a concave frontier μ(σ) = √σ shape, z = Sharpe-ish
    const v = 0.08 + 0.92 * Math.pow(rng.next(), 0.7);
    const front = Math.sqrt(v) * 1.9 - 0.9;
    const depth = Math.pow(rng.next(), 2.2) * (0.4 + 1.4 * v);
    const ret = front - depth;
    cloud.set([(v - 0.5) * 6, ret, (ret + 0.9) / (v + 0.2) - 1.4], i * 3);

    const ti = Math.floor(rng.next() * 1024);
    const ex = ti / 1023;
    const width = 0.25 + 0.6 * (0.5 + 0.5 * Math.sin(ti * 0.02));
    const yTop = eq[ti]! * 1.1 - 1;
    const below = rng.next() < 0.55;
    ribbon.set([(ex - 0.5) * 8, below ? yTop - rng.next() * (yTop + 2.4) : yTop, below ? width / 2 : (rng.next() - 0.5) * width], i * 3);
  }
  return { cluster, sphere, fan, cloud, ribbon, seed };
}

export function Sculpture({ inputs: inputsRef, nClusters, perCluster, animate }: { inputs: RefObject<SculptureInputs>; nClusters: number; perCluster: number; animate: boolean }) {
  const count = nClusters * perCluster;
  const geo = useMemo(() => {
    const t = buildTargets(count, nClusters, perCluster);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('aCluster', new THREE.BufferAttribute(t.cluster, 1));
    g.setAttribute('aSphere', new THREE.BufferAttribute(t.sphere, 3));
    g.setAttribute('aFan', new THREE.BufferAttribute(t.fan, 3));
    g.setAttribute('aCloud', new THREE.BufferAttribute(t.cloud, 3));
    g.setAttribute('aRibbon', new THREE.BufferAttribute(t.ribbon, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(t.seed, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 20);
    return g;
  }, [count, nClusters, perCluster]);
  useEffect(() => () => geo.dispose(), [geo]);

  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uMorph: { value: 0 },
          uMouse: { value: new THREE.Vector3(99, 99, 99) },
          uMouseOn: { value: 0 },
          uCenter: { value: Array.from({ length: MAX_CLUSTERS }, () => new THREE.Vector3()) },
          uScale: { value: new Array(MAX_CLUSTERS).fill(0.5) },
          uTurb: { value: new Array(MAX_CLUSTERS).fill(0.2) },
          uRippleT: { value: new Array(MAX_CLUSTERS).fill(-99) },
          uRippleSign: { value: new Array(MAX_CLUSTERS).fill(1) },
          uRippleAmp: { value: new Array(MAX_CLUSTERS).fill(0) },
          uSize: { value: 2.2 },
        },
      }),
    [],
  );
  useEffect(() => () => mat.dispose(), [mat]);

  const group = useRef<THREE.Group>(null);
  const morph = useRef(0);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  const hit = useMemo(() => new THREE.Vector3(), []);
  const { camera, raycaster, pointer } = useThree();

  useFrame((state, dt) => {
    const inputs = inputsRef.current;
    const u = mat.uniforms;
    if (animate) u.uTime!.value += dt;
    inputs.clock.now = u.uTime!.value as number;
    // mechanical ease toward the scroll target (no overshoot)
    morph.current += (inputs.morph.target - morph.current) * (animate ? 1 - Math.exp(-dt * 4) : 1);
    u.uMorph!.value = morph.current;
    inputs.clusters.forEach((c, i) => {
      if (i >= MAX_CLUSTERS) return;
      (u.uCenter!.value as THREE.Vector3[])[i]!.set(...c.center);
      (u.uScale!.value as number[])[i] = c.scale;
      (u.uTurb!.value as number[])[i] = c.turbulence;
      (u.uRippleT!.value as number[])[i] = c.rippleT;
      (u.uRippleSign!.value as number[])[i] = c.rippleSign;
      (u.uRippleAmp!.value as number[])[i] = c.rippleAmp;
    });
    raycaster.setFromCamera(pointer, camera);
    if (raycaster.ray.intersectPlane(plane, hit) && group.current) {
      group.current.worldToLocal(hit);
      (u.uMouse!.value as THREE.Vector3).copy(hit);
      u.uMouseOn!.value = animate ? 1 : 0;
    }
    const g = group.current;
    if (g && animate) {
      if (morph.current < 0.5) g.rotation.y += dt * 0.06;
      else {
        // wrap to (−π, π] then ease to the tool's viewing angle
        g.rotation.y = Math.atan2(Math.sin(g.rotation.y), Math.cos(g.rotation.y));
        const targetY = [0, -0.35, -0.6, -0.15][Math.round(Math.min(3, morph.current))]!;
        g.rotation.y += (targetY - g.rotation.y) * (1 - Math.exp(-dt * 2));
      }
    }
    state.invalidate();
  });

  return (
    <group ref={group}>
      <points geometry={geo} material={mat} frustumCulled={false} />
    </group>
  );
}
