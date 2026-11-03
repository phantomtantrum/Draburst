import Link from 'next/link';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { ScrambleText } from '@/components/ui/ScrambleText';

const TOOLS = [
  {
    idx: '01',
    href: '/tools/monte-carlo',
    title: 'Monte Carlo',
    body: 'Thousands of possible futures from GBM or a block bootstrap of real history. Percentile bands, target probabilities, VaR and CVaR at horizon.',
    shape: 'FAN',
  },
  {
    idx: '02',
    href: '/tools/portfolio',
    title: 'Portfolio',
    body: 'Efficient frontier across crypto and equities on an aligned calendar. Min-variance, max-Sharpe, Ledoit–Wolf shrinkage, risk contribution.',
    shape: 'CLOUD',
  },
  {
    idx: '03',
    href: '/tools/backtest',
    title: 'Backtest',
    body: 'Parameterized strategies with no look-ahead: signal on close, fill on next open, commissions and slippage. Parameter sweeps as surfaces.',
    shape: 'RIBBON',
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
      <section aria-labelledby="hero-title" className="flex min-h-[calc(100svh-48px)] flex-col justify-end border-b border-rule py-12">
        <SectionLabel index="00" title="Live market sculpture" />
        <h1 id="hero-title" className="display-xl mt-6 text-fg">
          <ScrambleText text="quantphantom" />
        </h1>
        <p className="mt-10 max-w-xl text-[18px] text-body">
          A research terminal designed by a gallery. Real market data, rigorous quant math, and every number on screen
          ready to become a physical sculpture.
        </p>
      </section>

      <section aria-labelledby="tools-title" className="py-24">
        <SectionLabel index="04" title="Instruments" as="h2" />
        <h2 id="tools-title" className="sr-only">
          Instruments
        </h2>
        <ul className="mt-10 grid border-t border-rule md:grid-cols-3">
          {TOOLS.map((t) => (
            <li key={t.href} className="border-b border-rule md:border-r md:last:border-r-0">
              <Link href={t.href} className="group flex h-full flex-col gap-6 p-6 hover:bg-surface">
                <span className="label flex justify-between text-muted">
                  <span className="num">{t.idx}</span>
                  <span>{t.shape}</span>
                </span>
                <span className="display-m">{t.title}</span>
                <span className="text-[15px] text-muted">{t.body}</span>
                <span className="label mt-auto text-fg group-hover:underline group-hover:underline-offset-4">Open tool →</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
