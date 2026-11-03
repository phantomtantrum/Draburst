'use client';

import { useRef, useState, type RefObject } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer } from '@react-three/postprocessing';
import { PhantomEffect } from '@/components/three/PhantomEffect';
import { STAGE_BG } from '@/components/three/bg';
import { Sculpture, type SculptureInputs } from '@/components/three/Sculpture';
import { useActive } from '@/lib/hooks/useInView';
import { useMediaQuery } from '@/lib/hooks/useMedia';

/** Lazy-loaded WebGL hero. Pauses offscreen / hidden; static under reduced motion. */
export default function HeroCanvas({ inputs, nClusters, animate, label }: { inputs: RefObject<SculptureInputs>; nClusters: number; animate: boolean; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const active = useActive(ref, '0px');
  const small = useMediaQuery('(max-width: 767px)');
  const [dpr, setDpr] = useState(1.5);
  return (
    <div ref={ref} className="absolute inset-0">
      <Canvas
        role="img"
        aria-label={label}
        dpr={[1, dpr]}
        frameloop={!active ? 'never' : animate ? 'always' : 'demand'}
        camera={{ position: [0, 0.6, 9.5], fov: 40, near: 0.1, far: 60 }}
        gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor(STAGE_BG, 1)}
      >
        <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(1)} />
        <AdaptiveDpr pixelated />
        <Sculpture inputs={inputs} nClusters={nClusters} perCluster={small ? 650 : 1400} animate={animate} />
        <EffectComposer multisampling={0}>
          <PhantomEffect animate={animate} grain={0.09} levels={6} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
