import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PortfolioTool } from './PortfolioTool';
import { PortfolioMethodology } from './methodology';

export const metadata: Metadata = {
  title: 'Portfolio optimizer',
  description: 'Efficient frontier for 2–20 crypto and stock assets on an aligned calendar. Min-variance, max-Sharpe, Ledoit–Wolf, risk contribution.',
};

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto h-screen max-w-[1600px] px-4 py-6 lg:px-6" aria-busy="true" />}>
      <PortfolioTool methodology={<PortfolioMethodology />} />
    </Suspense>
  );
}
