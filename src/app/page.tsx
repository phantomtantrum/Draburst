import Link from 'next/link';
import type { ReactNode } from 'react';
import { Tex } from '@/components/math/Tex';
import { HomeHero } from './_home/HomeExperience';
import { EquityPreview, FanPreview, FrontierPreview } from './_home/ToolPreviews';

const TOOLS: ReadonlyArray<{ href: string; title: string; question: string; body: string; points: string[]; preview: ReactNode }> = [
  {
    href: '/tools/monte-carlo',
    title: 'Monte Carlo',
    question: 'Where could the price be in a year?',
    body: 'Thousands of possible futures from a GBM model or a bootstrap of the asset’s own history.',
    points: ['Percentile bands and target probabilities', 'Value at Risk and CVaR at the horizon', 'Seeded, so every run is reproducible'],
    preview: <FanPreview />,
  },
  {
    href: '/tools/portfolio',
    title: 'Portfolio',
    question: 'How should I weight these assets?',
    body: 'Efficient frontier across crypto and stocks, aligned on a common calendar.',
    points: ['Min-variance and max-Sharpe portfolios', 'Ledoit–Wolf shrinkage for stable covariance', 'Risk contribution per asset'],
    preview: <FrontierPreview />,
  },
  {
    href: '/tools/backtest',
    title: 'Backtest',
    question: 'Would this strategy have worked?',
    body: 'Rule-based strategies tested on history with no look-ahead and realistic costs.',
    points: ['Signal on close, fill on next open', 'CAGR, Sharpe, Sortino, max drawdown', 'Parameter sweeps to spot overfitting'],
    preview: <EquityPreview />,
  },
];

const STEPS = [
  { n: '1', title: 'Pick assets', body: 'Search any of the top crypto assets, or stocks and ETFs when a Tiingo key is configured.' },
  { n: '2', title: 'Set the parameters', body: 'Lookback, horizon, strategy rules, costs. Everything is kept in the URL, so a link reproduces the run.' },
  { n: '3', title: 'Read the result', body: 'Charts, tables and a 3D view of the same numbers. Save runs to your dashboard or ask for a plain-English explanation.' },
];

export default function Home() {
  return (
    <>
      <HomeHero />

      <section id="tools" aria-labelledby="tools-title" className="scroll-mt-16 border-t border-rule bg-surface">
        <div className="mx-auto max-w-[1400px] px-4 py-20 lg:px-6 lg:py-24">
          <p className="ui-label text-muted">Tools</p>
          <h2 id="tools-title" className="mt-2 text-[clamp(28px,3vw,40px)] leading-tight font-bold tracking-[-0.025em] text-fg">
            Three questions, three tools.
          </h2>
          <ul className="mt-10 grid gap-6 md:grid-cols-3">
            {TOOLS.map((t) => (
              <li key={t.href}>
                <Link href={t.href} className="group flex h-full flex-col border border-rule bg-bg transition-colors duration-[var(--dur-micro)] hover:border-rule-strong">
                  <div className="border-b border-rule px-5 pt-5 pb-4">{t.preview}</div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <p className="text-[14px] text-muted">{t.question}</p>
                    <h3 className="text-[24px] leading-tight font-bold tracking-[-0.02em] text-fg">{t.title}</h3>
                    <p className="text-[15px] leading-relaxed text-body">{t.body}</p>
                    <ul className="mt-1 space-y-1.5 text-[14px] text-body">
                      {t.points.map((p) => (
                        <li key={p} className="flex gap-2">
                          <span aria-hidden className="text-gain">
                            ✓
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                    <span className="ui-label mt-auto pt-4 text-fg group-hover:underline group-hover:underline-offset-4">Open {t.title} →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="how-title" className="border-t border-rule">
        <div className="mx-auto max-w-[1400px] px-4 py-20 lg:px-6 lg:py-24">
          <p className="ui-label text-muted">How it works</p>
          <h2 id="how-title" className="mt-2 text-[clamp(28px,3vw,40px)] leading-tight font-bold tracking-[-0.025em] text-fg">
            From question to answer in a minute.
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span aria-hidden className="num flex size-9 shrink-0 items-center justify-center border border-rule-strong text-[15px] text-fg">
                  {s.n}
                </span>
                <div>
                  <h3 className="text-[18px] font-semibold text-fg">{s.title}</h3>
                  <p className="mt-1.5 text-[15px] leading-relaxed text-body">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="method-title" className="border-t border-rule bg-surface">
        <div className="mx-auto max-w-[1400px] px-4 py-20 lg:px-6 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16">
            <div>
              <p className="ui-label text-muted">Method</p>
              <h2 id="method-title" className="mt-2 text-[clamp(28px,3vw,40px)] leading-tight font-bold tracking-[-0.025em] text-fg">
                No black boxes.
              </h2>
              <p className="mt-4 max-w-md text-[16px] leading-relaxed text-body">
                Every model is written out with its formula and assumptions, and the quant engine is tested against NumPy, SciPy and
                scikit-learn reference values.
              </p>
              <Link href="/methodology" className="ui-label mt-6 inline-flex h-11 items-center border border-rule-strong px-5 text-fg hover:border-fg">
                Read the methodology →
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { k: 'Price paths (GBM)', tex: String.raw`S_{t+\Delta t}=S_t\,e^{(\mu-\frac12\sigma^2)\Delta t+\sigma\sqrt{\Delta t}\,Z}` },
                { k: 'Covariance shrinkage', tex: String.raw`\hat\Sigma=(1-\delta^*)S+\delta^*\bar m I` },
                { k: 'Sharpe ratio', tex: String.raw`\mathrm{SR}=\frac{\overline{r-r_f}}{s(r-r_f)}\sqrt{P}` },
              ].map((f) => (
                <div key={f.k} className="min-w-0 overflow-x-auto border border-rule bg-bg p-5">
                  <p className="ui-label text-[13px] text-muted">{f.k}</p>
                  <Tex block>{f.tex}</Tex>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="cta-title" className="border-t border-rule">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-6 px-4 py-16 md:flex-row md:items-center lg:px-6">
          <div>
            <h2 id="cta-title" className="text-[clamp(24px,2.4vw,32px)] leading-tight font-bold tracking-[-0.02em] text-fg">
              Try it now, it runs on live data.
            </h2>
            <p className="mt-2 text-[15px] text-muted">No account needed. Sign in only if you want to save runs.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/tools/monte-carlo" className="ui-label inline-flex h-11 items-center border border-fg bg-fg px-5 text-bg hover:bg-transparent hover:text-fg">
              Open Monte Carlo →
            </Link>
            <Link href="/tools/backtest" className="ui-label inline-flex h-11 items-center border border-rule-strong px-5 text-fg hover:border-fg">
              Open Backtest
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
