import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BacktestTool } from './BacktestTool';
import { BacktestMethodology } from './methodology';

export const metadata: Metadata = {
  title: 'Strategy backtester',
  description: 'Parameterized strategies with no look-ahead bias: signal on close, fill on next open, commissions, slippage, stop-loss and parameter sweeps.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto h-screen max-w-[1600px] px-4 py-6 lg:px-6" aria-busy="true" />}>
      <BacktestTool methodology={<BacktestMethodology />} />
    </Suspense>
  );
}
