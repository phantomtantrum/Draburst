'use client';

import { Stage, StageCorners } from '@/components/three/Stage';
import { McFan3D, approxFanScale, fanScale } from '@/components/three/McFan3D';
import type { McDisplay } from '@/lib/hooks/useMonteCarlo';
import type { McSummary } from '@/lib/quant/montecarlo';
import type { StageMode } from '@/lib/hooks/useMedia';
import { fmtInt, fmtPrice, fmtSeed } from '@/lib/format';
import { useMemo } from 'react';

/** Lazy-loaded 3D bundle for the Monte Carlo page. */
export default function McStage({
  mode,
  display,
  summary,
  s0,
  target,
  seed,
  nPaths,
  horizon,
  progress,
  sourceLabel,
  approx,
}: {
  mode: Exclude<StageMode, 'none'>;
  display: McDisplay | null;
  summary: McSummary | null;
  s0: number;
  target: number | null;
  seed: number;
  nPaths: number;
  horizon: number;
  progress: number;
  sourceLabel: string;
  /** drift/vol/years for a stable axis while streaming */
  approx: { mu: number; sigma: number; years: number };
}) {
  const { mu, sigma, years } = approx;
  const scale = useMemo(
    () => (summary ? fanScale(s0, summary.terminalSorted, summary.bands) : approxFanScale(s0, mu, sigma, years)),
    [s0, summary, mu, sigma, years],
  );
  return (
    <Stage
      mode={mode}
      height="min(72svh, 640px)"
      label={`3D Monte Carlo fan: ${display?.count ?? 0} sample paths over ${horizon} periods, ranked by terminal value; terminal distribution shown as a histogram wall. See the 2D charts and table below for the same data.`}
      overlay={
        <StageCorners
          tl={
            <>
              N={fmtInt(nPaths)} · SEED {fmtSeed(seed)}
            </>
          }
          tr={<>T+{horizon} · LOG PRICE</>}
          bl={
            <>
              X TIME · Y PRICE · Z RANK(S<sub>T</sub>)
            </>
          }
          br={progress < 1 ? <>PATHS {fmtInt(progress * nPaths)} / {fmtInt(nPaths)}</> : <>{sourceLabel} · S₀ {fmtPrice(s0)}</>}
        />
      }
    >
      <McFan3D display={display} s0={s0} target={target} bands={summary?.bands} grid={summary?.grid} histogram={summary?.histogram} scale={scale} />
    </Stage>
  );
}
