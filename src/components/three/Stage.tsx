'use client';

import { Suspense, useRef, useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { PhantomEffect } from './PhantomEffect';
import { useActive } from '@/lib/hooks/useInView';
import type { StageMode } from '@/lib/hooks/useMedia';
import { STAGE_BG } from './bg';

/**
 * WebGL stage used by every tool.
 * - pauses rendering when offscreen / tab hidden (frameloop "never")
 * - adaptive DPR + PerformanceMonitor degrade on slow GPUs
 * - "static" mode (reduced motion / low-end): renders on demand, no auto-rotate, frozen grain
 * - canvas is role="img" with an aria-label; every insight also exists in 2D
 */
export function Stage({
  mode,
  label,
  children,
  height = 520,
  camera = [6.5, 3.4, 7.5],
  overlay,
  autoRotate = true,
  target = [0, 0, 0],
  pointThreshold = 0.06,
}: {
  mode: Exclude<StageMode, 'none'>;
  label: string;
  children: ReactNode;
  height?: number | string;
  camera?: [number, number, number];
  overlay?: ReactNode;
  autoRotate?: boolean;
  target?: [number, number, number];
  /** raycast pick radius for THREE.Points (world units) */
  pointThreshold?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref);
  const [dpr, setDpr] = useState(1.5);
  const full = mode === 'full';
  return (
    <div ref={ref} className="relative w-full overflow-hidden border border-rule bg-bg" style={{ height }}>
      <Canvas
        role="img"
        aria-label={label}
        dpr={[1, dpr]}
        frameloop={!active ? 'never' : full ? 'always' : 'demand'}
        camera={{ position: camera, fov: 35, near: 0.1, far: 100 }}
        raycaster={{ params: { Points: { threshold: pointThreshold }, Mesh: {}, Line: { threshold: 1 }, LOD: {}, Sprite: {} } }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor(STAGE_BG, 1)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
        <AdaptiveDpr pixelated />
        <fog attach="fog" args={[STAGE_BG, 9, 22]} />
        <Suspense fallback={null}>{children}</Suspense>
        <OrbitControls
          makeDefault
          target={target}
          enablePan={false}
          enableDamping={full}
          dampingFactor={0.08}
          autoRotate={full && autoRotate}
          autoRotateSpeed={0.35}
          minDistance={4}
          maxDistance={18}
        />
        <EffectComposer multisampling={0}>
          <PhantomEffect animate={full} grain={0.07} levels={7} />
        </EffectComposer>
      </Canvas>
      {overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
    </div>
  );
}

/** Corner readouts in instrument style. */
export function StageCorners({ tl, tr, bl, br }: { tl?: ReactNode; tr?: ReactNode; bl?: ReactNode; br?: ReactNode }) {
  const c = 'label absolute text-muted bg-bg/80 px-1.5 py-1 num';
  return (
    <>
      {tl && <div className={c + ' top-2 left-2'}>{tl}</div>}
      {tr && <div className={c + ' top-2 right-2 text-right max-sm:hidden'}>{tr}</div>}
      {bl && <div className={c + ' bottom-2 left-2 max-sm:hidden'}>{bl}</div>}
      {br && <div className={c + ' right-2 bottom-2 text-right'}>{br}</div>}
    </>
  );
}
