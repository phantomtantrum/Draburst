'use client';

import { useState } from 'react';
import { Stage, StageCorners } from '@/components/three/Stage';
import { EquityRibbon3D, SweepSurface3D } from '@/components/three/Backtest3D';
import type { BacktestResult } from '@/lib/quant/backtest';
import type { StageMode } from '@/lib/hooks/useMedia';
import type { SweepResult } from '@/workers/backtest.worker';
import { fmtNum, fmtPct, fmtPrice } from '@/lib/format';

export default function BacktestStage({
  mode,
  view,
  result,
  sweep,
  current,
  onPick,
  xLabel,
  yLabel,
  fmtX,
  fmtY,
}: {
  mode: Exclude<StageMode, 'none'>;
  view: 'ribbon' | 'sweep';
  result: BacktestResult | null;
  sweep: SweepResult | null;
  current: { x: number; y: number } | null;
  onPick: (x: number, y: number) => void;
  xLabel: string;
  yLabel: string;
  fmtX: (v: number) => string;
  fmtY: (v: number) => string;
}) {
  const [hover, setHover] = useState<{ i: number; j: number } | null>(null);
  const hv = hover && sweep ? sweep.sharpe[hover.j * sweep.xs.length + hover.i] : null;
  if (view === 'sweep' && sweep) {
    return (
      <Stage
        mode={mode}
        height="min(72svh, 640px)"
        camera={[6.5, 5.5, 7.5]}
        autoRotate={hover == null}
        label={`3D Sharpe surface over ${xLabel} and ${yLabel}. Click a cell to load its parameters. An accessible heatmap with the same values is below.`}
        overlay={
          <StageCorners
            tl={<>SWEEP {sweep.xs.length}×{sweep.ys.length} · IN-SAMPLE · BEST CELL IS OPTIMISTIC</>}
            tr={<>X {xLabel} · Z {yLabel} · Y SHARPE</>}
            bl={<>SOLID SHARPE &gt; 0 · WIRE ≤ 0 · PIN = CURRENT</>}
            br={
              hover ? (
                <>
                  {xLabel} {fmtX(sweep.xs[hover.i]!)} · {yLabel} {fmtY(sweep.ys[hover.j]!)} · SR {hv != null && Number.isFinite(hv) ? fmtNum(hv, 2) : '—'} · CLICK TO LOAD
                </>
              ) : (
                <>HOVER · CLICK TO LOAD</>
              )
            }
          />
        }
      >
        <SweepSurface3D xs={sweep.xs} ys={sweep.ys} values={sweep.sharpe} current={current} onPick={onPick} onHover={setHover} />
      </Stage>
    );
  }
  if (!result) return null;
  return (
    <Stage
      mode={mode}
      height="min(72svh, 640px)"
      camera={[2.5, 3.2, 9]}
      label={`3D equity ribbon: strategy equity through time, ribbon width = exposure, drawdowns carved below the running peak, dashed benchmark behind. The equity and drawdown charts below show the same data.`}
      overlay={
        <StageCorners
          tl={<>EQUITY RIBBON · LOG · {result.trades.length} TRADES</>}
          tr={<>X TIME · Y LOG EQUITY · WIDTH EXPOSURE</>}
          bl={<>━ STRATEGY · ┈ BENCH · ⦙ DRAWDOWN · ▲ ENTRY ▽ EXIT</>}
          br={
            <>
              END {fmtPrice(result.equity[result.equity.length - 1])} · MDD {fmtPct(-result.metrics.maxDrawdown, 1)}
            </>
          }
        />
      }
    >
      <EquityRibbon3D equity={result.equity} benchmark={result.benchmark} exposure={result.exposure} trades={result.trades} />
    </Stage>
  );
}
