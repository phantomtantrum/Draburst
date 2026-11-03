import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-16 lg:grid-cols-12 lg:px-6">
      <div className="lg:col-span-5">
        <p className="label text-muted">— 06 / ACCESS</p>
        <h1 className="display-l mt-4">Sign in</h1>
        <p className="mt-4 max-w-md text-[15px] text-muted">
          Accounts let you save Monte Carlo runs, portfolios and backtests (inputs, seed and summary metrics) and request AI explanations of results.
          The tools themselves work without an account.
        </p>
      </div>
      <div className="lg:col-span-5 lg:col-start-8">
        <Suspense fallback={<div className="h-64 border border-rule" aria-busy="true" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
