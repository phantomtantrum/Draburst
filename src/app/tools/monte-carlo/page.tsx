import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToolHeader } from '@/components/tool/ToolHeader';
import { ToolSkeleton } from '@/components/tool/ToolSkeleton';
import { MonteCarloTool } from './MonteCarloTool';
import { McMethodology } from './methodology';

export const metadata: Metadata = {
  title: 'Monte Carlo simulator',
  description: 'Simulate thousands of price paths with GBM or a block bootstrap of real history. Percentile bands, target probabilities, VaR and CVaR.',
};

export default function Page() {
  return (
    <>
      <ToolHeader index="01" title="Monte Carlo" subtitle="Thousands of possible futures from today's price. GBM with estimated drift and volatility, or a block bootstrap of the asset's own history." />
      <Suspense fallback={<ToolSkeleton />}>
      <MonteCarloTool methodology={<McMethodology />} />
      </Suspense>
    </>
  );
}

