import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DashboardClient } from './DashboardClient';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[1600px] px-4 lg:px-6" aria-busy="true" />}>
      <DashboardClient />
    </Suspense>
  );
}
