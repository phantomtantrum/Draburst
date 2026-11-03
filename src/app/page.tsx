import Link from 'next/link';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Tex } from '@/components/math/Tex';
import { HomeExperience } from './_home/HomeExperience';

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
    <>
      <HomeExperience />
      <div className="mx-auto max-w-[1600px] px-4 lg:px-6">
        <section aria-labelledby="tools-title" className="py-24">
          <SectionLabel index="04" title="Instruments" />
          <h2 id="tools-title" className="display-m mt-4">
            Three instruments, one grammar.
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
        <section aria-labelledby="method-title" className="border-t border-rule py-24">
          <SectionLabel index="05" title="Method" />
          <h2 id="method-title" className="display-m mt-4 max-w-3xl">
            Correctness before features. Every formula is on the page.
          </h2>
          <div className="mt-10 grid gap-0 border-t border-l border-rule md:grid-cols-3">
            {[
              { k: 'GBM', tex: String.raw`S_{t+\Delta t}=S_t\,e^{(\mu-\frac12\sigma^2)\Delta t+\sigma\sqrt{\Delta t}\,Z}` },
              { k: 'LEDOIT–WOLF', tex: String.raw`\hat\Sigma=(1-\delta^*)S+\delta^*\bar m I` },
              { k: 'SHARPE', tex: String.raw`\mathrm{SR}=\frac{\overline{r-r_f}}{s(r-r_f)}\sqrt{P}` },
            ].map((f) => (
              <div key={f.k} className="border-r border-b border-rule p-6">
                <p className="label text-muted">{f.k}</p>
                <Tex block>{f.tex}</Tex>
              </div>
            ))}
          </div>
          <Link href="/methodology" className="label mt-8 inline-block border border-rule-strong px-4 py-3 text-fg hover:border-fg">
            Read the methodology →
          </Link>
        </section>
      </div>
    </>
  );
}
