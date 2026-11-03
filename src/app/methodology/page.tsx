import type { Metadata } from 'next';
import Link from 'next/link';
import { Tex } from '@/components/math/Tex';
import { SectionLabel } from '@/components/ui/SectionLabel';
import { Disclaimer } from '@/components/ui/Disclaimer';

export const metadata: Metadata = {
  title: 'Methodology',
  description: 'Every formula behind quantphantom: returns, risk metrics, VaR/CVaR, covariance shrinkage, optimization, Monte Carlo, backtesting rules, data sources and limitations.',
};

const TOC = [
  ['returns', 'Returns & annualization'],
  ['metrics', 'Performance metrics'],
  ['risk', 'VaR & CVaR'],
  ['covariance', 'Covariance & shrinkage'],
  ['optimization', 'Portfolio optimization'],
  ['monte-carlo', 'Monte Carlo'],
  ['backtest', 'Backtesting rules'],
  ['prng', 'Randomness & reproducibility'],
  ['data', 'Data sources'],
  ['limitations', 'Limitations'],
  ['terms', 'Terms & disclaimer'],
] as const;

function Sec({ id, idx, title, children }: { id: string; idx: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 border-t border-rule py-12">
      <SectionLabel index={idx} title={title} />
      <h2 id={`${id}-h`} className="display-m mt-4">
        {title}
      </h2>
      <div className="mt-6 max-w-3xl space-y-4 text-[15px] leading-relaxed text-body">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <div className="mx-auto grid max-w-[1600px] gap-10 px-4 py-10 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-6">
      <nav aria-label="Methodology contents" className="lg:sticky lg:top-20 lg:self-start">
        <p className="label text-muted">— 04 / METHODOLOGY</p>
        <ol className="mt-4">
          {TOC.map(([id, t], i) => (
            <li key={id}>
              <a href={`#${id}`} className="label flex min-h-7 items-center gap-2 text-muted hover:text-fg">
                <span className="num text-muted">{String(i + 1).padStart(2, '0')}</span>
                {t}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="min-w-0">
        <h1 className="display-l">Methodology</h1>
        <p className="mt-4 max-w-2xl text-[16px] text-muted">
          Correctness before features. The quant engine is plain TypeScript with unit tests against hand-computed values and reference outputs from
          NumPy, SciPy and scikit-learn. This page is the specification.
        </p>

        <Sec id="returns" idx={1} title="Returns & annualization">
          <p>Simple and logarithmic returns from consecutive adjusted closes:</p>
          <Tex block>{String.raw`r_t = \frac{P_t}{P_{t-1}} - 1,\qquad \ell_t = \ln\frac{P_t}{P_{t-1}} = \ln(1+r_t)`}</Tex>
          <p>
            Annualization uses P periods per year: <strong className="text-fg">252</strong> for exchange-traded assets, <strong className="text-fg">365</strong> for crypto (it trades every day),
            and 252 for portfolios that mix both, because mixed series are aligned to the exchange calendar.
          </p>
          <Tex block>{String.raw`\mu_{ann} = P\,\bar r,\qquad \sigma_{ann} = \sqrt P\,s(r),\qquad s^2 = \tfrac{1}{n-1}\textstyle\sum (r_t-\bar r)^2`}</Tex>
        </Sec>

        <Sec id="metrics" idx={2} title="Performance metrics">
          <Tex block>{String.raw`\mathrm{CAGR} = \Big(\frac{E_n}{E_0}\Big)^{P/n} - 1`}</Tex>
          <p>The annual risk-free rate is converted to a per-period rate geometrically, r<sub>f,p</sub> = (1+r<sub>f</sub>)<sup>1/P</sup> − 1.</p>
          <Tex block>{String.raw`\mathrm{Sharpe} = \frac{\overline{r - r_{f,p}}}{s(r - r_{f,p})}\sqrt P,\qquad \mathrm{Sortino} = \frac{\overline{r - r_{f,p}}}{\sqrt{\frac1n\sum_t \min(r_t - r_{f,p},0)^2}}\sqrt P`}</Tex>
          <p>The Sortino downside deviation averages over all observations (Sortino &amp; Price), not only negative ones.</p>
          <Tex block>{String.raw`\mathrm{DD}_t = \frac{E_t}{\max_{u\le t}E_u} - 1,\qquad \mathrm{MDD} = -\min_t \mathrm{DD}_t,\qquad \mathrm{Calmar} = \frac{\mathrm{CAGR}}{\mathrm{MDD}}`}</Tex>
          <p>Drawdown duration is measured from the peak preceding the maximum drawdown to full recovery, or to the last bar if unrecovered.</p>
          <Tex block>{String.raw`\beta = \frac{\mathrm{Cov}(r, r_b)}{\mathrm{Var}(r_b)}`}</Tex>
        </Sec>

        <Sec id="risk" idx={3} title="VaR & CVaR">
          <p>Losses are reported as positive fractions at confidence c (95% or 99%).</p>
          <Tex block>{String.raw`\mathrm{VaR}^{hist}_c = -q_{1-c}(r),\qquad \mathrm{CVaR}^{hist}_c = -\,\mathbb E\big[r\mid r \le q_{1-c}(r)\big]`}</Tex>
          <p>Empirical quantiles use linear interpolation between order statistics (Hyndman–Fan type 7, NumPy’s default). Gaussian versions:</p>
          <Tex block>{String.raw`\mathrm{VaR}^{N}_c = -\big(\mu + \sigma\,\Phi^{-1}(1-c)\big),\qquad \mathrm{CVaR}^{N}_c = -\mu + \sigma\,\frac{\varphi\big(\Phi^{-1}(c)\big)}{1-c}`}</Tex>
          <p>Φ⁻¹ uses Acklam’s rational approximation refined by one Halley step (relative error ~1e−15).</p>
        </Sec>

        <Sec id="covariance" idx={4} title="Covariance & shrinkage">
          <Tex block>{String.raw`S = \frac{1}{T-1}\sum_{t}(x_t-\bar x)(x_t-\bar x)^\top`}</Tex>
          <p>
            Ledoit–Wolf (2004) shrinks the maximum-likelihood covariance toward a scaled identity with a data-driven intensity. The implementation matches
            scikit-learn’s <code className="text-fg">ledoit_wolf</code> to 1e−15 in the test suite.
          </p>
          <Tex block>{String.raw`\hat\Sigma = (1-\delta^*)S_{ML} + \delta^*\,\bar m\,I,\quad \bar m=\tfrac{\mathrm{tr}\,S_{ML}}{N},\quad \delta^*=\min\!\Big(1,\ \frac{\tfrac{1}{NT^2}\sum_t\lVert x_tx_t^\top - S_{ML}\rVert_F^2}{\tfrac1N\lVert S_{ML}-\bar mI\rVert_F^2}\Big)`}</Tex>
        </Sec>

        <Sec id="optimization" idx={5} title="Portfolio optimization">
          <Tex block>{String.raw`\min_w\ w^\top\Sigma w - \lambda\mu^\top w\quad \text{s.t.}\quad \mathbf 1^\top w = 1,\ \ \ell \le w \le u`}</Tex>
          <p>
            Solved with FISTA (accelerated projected gradient, adaptive restart, step 1/L with L = 2λ<sub>max</sub>(Σ)). The projection onto the budget-and-box set is
            exact: w<sub>i</sub> = clip(v<sub>i</sub> − τ, ℓ<sub>i</sub>, u<sub>i</sub>), with τ found by bisection. λ = 0 gives the minimum-variance portfolio, and a log-spaced λ sweep traces the efficient
            frontier. Max-Sharpe is found by golden-section search on log λ. Results are checked against closed forms (Σ⁻¹1/1ᵀΣ⁻¹1, the tangency Σ⁻¹(μ−r<sub>f</sub>)) and SciPy SLSQP with binding constraints.
          </p>
          <Tex block>{String.raw`\mathrm{RC}_i = \frac{w_i(\Sigma w)_i}{w^\top\Sigma w}`}</Tex>
        </Sec>

        <Sec id="monte-carlo" idx={6} title="Monte Carlo">
          <Tex block>{String.raw`S_{t+\Delta t} = S_t\exp\!\Big(\big(\mu-\tfrac12\sigma^2\big)\Delta t + \sigma\sqrt{\Delta t}\,Z_t\Big)`}</Tex>
          <Tex block>{String.raw`\hat\sigma = \sqrt P\,s(\ell),\qquad \hat\mu = P\,\bar\ell + \tfrac12\hat\sigma^2`}</Tex>
          <p>
            The circular block bootstrap resamples blocks of b consecutive historical log returns. Percentile bands are exact order statistics across all paths at up to 121 checkpoints,
            and terminal statistics use every path. The GBM output is checked against the lognormal closed form in tests.
          </p>
        </Sec>

        <Sec id="backtest" idx={7} title="Backtesting rules">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-fg">No look-ahead:</strong> signals are computed on the close of bar t using data up to t and executed at the open of t+1. Tests verify that changing bar t never changes the position held during bar t.
            </li>
            <li>Commission and slippage are charged in basis points of traded notional; buys fill at O(1+s), sells at O(1−s).</li>
            <li>The stop-loss triggers intrabar on the low and fills at the stop, or at the open on a gap. No re-entry until the signal resets.</li>
            <li>Monthly rebalancing happens at the first open of each month; the benchmark is the same weights left to drift.</li>
            <li>Parameter sweeps are in-sample: the best cell is optimistic by construction.</li>
          </ul>
        </Sec>

        <Sec id="prng" idx={8} title="Randomness & reproducibility">
          <p>
            xoshiro128** seeded via splitmix32, using 32-bit integer operations only, so every engine and worker produces identical sequences. Normals come from the Marsaglia polar method.
            A regression snapshot in the test suite guarantees that saved seeds replay exactly. Seeds are part of the URL and of saved runs.
          </p>
        </Sec>

        <Sec id="data" idx={9} title="Data sources">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-fg">Crypto — Binance</strong> public market data (data-api.binance.vision): daily candles 00:00–24:00 UTC for USDT pairs. Live 24h mini-tickers come over WebSocket. No splits or dividends apply.
            </li>
            <li>
              <strong className="text-fg">Stocks &amp; ETFs — Tiingo</strong> end-of-day prices adjusted for splits and dividends. Shown as EOD, never as live. Free-tier limits apply, so results are cached for hours.
            </li>
            <li>
              <strong className="text-fg">Metadata — CoinGecko</strong> as a fallback.
            </li>
          </ul>
          <p>
            All vendor requests go through server route handlers. Keys stay in server environment variables and the browser never calls a vendor directly. Every chart shows its source and fetch time.
          </p>
        </Sec>

        <Sec id="limitations" idx={10} title="Limitations">
          <ul className="list-disc space-y-1 pl-5">
            <li>History is one sample path. Estimates of expected return in particular are extremely noisy.</li>
            <li>Gaussian models understate fat tails, jumps and volatility clustering; correlations rise in crises.</li>
            <li>Bootstraps cannot produce regimes absent from the lookback window.</li>
            <li>Mixing crypto (00:00 UTC close) with US equities (16:00 New York close) introduces a 3–4 hour timing offset.</li>
            <li>No taxes, borrow or funding costs, liquidity limits, partial fills or survivorship correction.</li>
            <li>AI explanations are generated from summary numbers only and may be wrong.</li>
          </ul>
        </Sec>

        <Sec id="terms" idx={11} title="Terms & disclaimer">
          <Disclaimer />
          <p>
            quantphantom is an educational research tool. Nothing on this site is an offer, solicitation or recommendation to buy or sell any security or digital asset. Market data belongs to its providers and is shown under their terms.
            Past performance, simulated or real, does not guarantee future results.
          </p>
          <p>
            <Link className="underline" href="/">
              Back to index
            </Link>
          </p>
        </Sec>
      </div>
    </div>
  );
}
