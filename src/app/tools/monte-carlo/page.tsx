import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MonteCarloTool } from './MonteCarloTool';
import { McMethodology } from './methodology';

export const metadata: Metadata = {
  title: 'Monte Carlo simulator',
  description: 'Simulate thousands of price paths with GBM or a block bootstrap of real history. Percentile bands, target probabilities, VaR and CVaR.',
};

export default function Page() {
  return (
    <Suspense fallback={<ToolSkeleton />}>
      <MonteCarloTool methodology={<McMethodology />} />
    </Suspense>
  );
}

function ToolSkeleton() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 lg:px-6">
      <p className="label text-muted">01 / MONTE CARLO</p>
      <div className="mt-3 h-[min(72svh,640px)] border border-rule" aria-busy="true" />
    </div>
  );
}
