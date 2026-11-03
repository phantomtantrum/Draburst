'use client';

import { Sym } from '@/components/ui/Sym';
import { useState } from 'react';
import { Stage, StageCorners } from '@/components/three/Stage';
import { CorrField3D, PortfolioCloud3D } from '@/components/three/Portfolio3D';
import { WeightsMini } from '@/components/charts/FrontierChart';
import type { PortfolioOutput } from '@/lib/quant/portfolio';
import type { StageMode } from '@/lib/hooks/useMedia';
import { fmtInt, fmtNum, fmtPct } from '@/lib/format';

const GLYPH = { minvar: 'square', maxsharpe: 'disc', equal: 'diamond', custom: 'ring' } as const;

export default function PortfolioStage({ mode, out, symbols, view }: { mode: Exclude<StageMode, 'none'>; out: PortfolioOutput; symbols: string[]; view: 'cloud' | 'corr' }) {
  const [hover, setHover] = useState<number | null>(null);
  const N = symbols.length;
  const h = hover != null && hover < out.cloud.vol.length ? hover : null;
  return (
    <Stage
      mode={mode}
      height="min(72svh, 640px)"
      camera={view === 'cloud' ? [6, 3.5, 7] : [5, 5.5, 6.5]}
      autoRotate={hover == null}
      label={
        view === 'cloud'
          ? `3D portfolio space: ${out.cloud.vol.length} random portfolios by volatility, return and Sharpe; efficient frontier as a white ridge. Hover a point for its weights. The same data is in the frontier chart and tables below.`
          : `3D correlation bar field for ${N} assets; positive correlations rise, negative hang below. Exact values are in the correlation table below.`
      }
      overlay={
        <StageCorners
          tl={<>{view === 'cloud' ? <>N={fmtInt(out.cloud.vol.length)} RANDOM · {N} ASSETS</> : <><Sym>ρ</Sym> FIELD · {N}×{N}</>}</>}
          tr={view === 'cloud' ? <>X <Sym>σ</Sym> · Y <Sym>μ</Sym> · Z SHARPE</> : <>▲ <Sym>ρ</Sym>&gt;0 SOLID · ▼ <Sym>ρ</Sym>&lt;0 WIRE</>}
          bl={
            view === 'cloud' ? (
              <>■ MIN-VAR · ● MAX-SHARPE · ◆ EQUAL · ○ CUSTOM</>
            ) : (
              <>{symbols.map((s, i) => `${i + 1}:${s}`).join(' ')}</>
            )
          }
          br={
            h != null ? (
              <div className="min-w-36 text-left normal-case">
                <p className="text-fg">
                  μ {fmtPct(out.cloud.ret[h], 1)} · σ {fmtPct(out.cloud.vol[h], 1)} · SR {fmtNum(out.cloud.sharpe[h], 2)}
                </p>
                <WeightsMini weights={out.cloud.weights.subarray(h * N, (h + 1) * N)} symbols={symbols} top={5} />
              </div>
            ) : view === 'cloud' ? (
              <>HOVER A POINT FOR WEIGHTS</>
            ) : null
          }
        />
      }
    >
      {view === 'cloud' ? (
        <PortfolioCloud3D
          cloud={out.cloud}
          frontier={out.frontier}
          markers={out.portfolios.map((p) => ({ key: p.key, vol: p.vol, ret: p.ret, sharpe: p.sharpe, glyph: GLYPH[p.key] }))}
          hovered={h}
          onHover={setHover}
        />
      ) : (
        <CorrField3D corr={out.corr} />
      )}
    </Stage>
  );
}
