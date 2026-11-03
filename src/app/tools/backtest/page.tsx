import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToolHeader } from '@/components/tool/ToolHeader';
import { ToolSkeleton } from '@/components/tool/ToolSkeleton';
import { BacktestTool } from './BacktestTool';
import { BacktestMethodology } from './methodology';

export const metadata: Metadata = {
  title: 'Strategy backtester',
  description: 'Parameterized strategies with no look-ahead bias: signal on close, fill on next open, commissions, slippage, stop-loss and parameter sweeps.',
};

export default function Page() {
  return (
    <>
      <ToolHeader index="03" title="Backtest" subtitle="Parameterized strategies with no look-ahead: decisions on the close, fills on the next open, real costs. Sweep two parameters to see how fragile the edge is." />
      <Suspense fallback={<ToolSkeleton stageBar />}>
      <BacktestTool methodology={<BacktestMethodology />} />
      </Suspense>
    </>
  );
}
