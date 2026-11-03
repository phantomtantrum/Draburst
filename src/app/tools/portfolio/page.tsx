import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ToolHeader } from '@/components/tool/ToolHeader';
import { ToolSkeleton } from '@/components/tool/ToolSkeleton';
import { PortfolioTool } from './PortfolioTool';
import { PortfolioMethodology } from './methodology';

export const metadata: Metadata = {
  title: 'Portfolio optimizer',
  description: 'Efficient frontier for 2–20 crypto and stock assets on an aligned calendar. Min-variance, max-Sharpe, Ledoit–Wolf, risk contribution.',
};

export default function Page() {
  return (
    <>
      <ToolHeader index="02" title="Portfolio" subtitle="Efficient frontier across crypto and equities on one aligned calendar: minimum variance, maximum Sharpe, equal weight and your own mix." />
      <Suspense fallback={<ToolSkeleton stageBar />}>
      <PortfolioTool methodology={<PortfolioMethodology />} />
      </Suspense>
    </>
  );
}
