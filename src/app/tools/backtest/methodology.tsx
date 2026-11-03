import { Tex } from '@/components/math/Tex';

export function BacktestMethodology() {
  return (
    <>
      <h3 className="label text-fg">Execution model — no look-ahead</h3>
      <p>
        Every signal is computed on the <strong className="text-fg">close of bar t</strong> using data up to and including t, and executed at the{' '}
        <strong className="text-fg">open of bar t+1</strong>. Prices are split- and dividend-adjusted. Fills include slippage s and commission c (both in basis points of
        notional):
      </p>
      <Tex block>{String.raw`p^{\text{buy}} = O_{t+1}(1+s),\qquad p^{\text{sell}} = O_{t+1}(1-s),\qquad \text{fee} = c\cdot|\text{notional}|`}</Tex>
      <p>
        An optional stop-loss is checked intrabar against the low: if L<sub>t</sub> ≤ entry·(1−k) the position exits at the stop, or at the open if the bar gaps below it.
        After a stop the strategy waits for its signal to reset before re-entering.
      </p>

      <h3 className="label pt-4 text-fg">Strategies</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>MA crossover: long while SMA/EMA<sub>fast</sub> &gt; SMA/EMA<sub>slow</sub>. EMA uses α = 2/(n+1), seeded with the SMA.</li>
        <li>Time-series momentum: long while C<sub>t</sub>/C<sub>t−L</sub> − 1 &gt; threshold.</li>
        <li>RSI mean reversion (Wilder smoothing): enter when RSI &lt; lower, exit when RSI &gt; upper.</li>
        <li>Bollinger breakout: enter when C &gt; SMA + kσ (population σ), exit when C &lt; SMA.</li>
        <li>Portfolio: fixed weights, rebalanced at the first open of each month; benchmark = same weights left to drift.</li>
      </ul>
      <Tex block>{String.raw`\mathrm{RSI}_t = 100 - \frac{100}{1+\bar G_t/\bar L_t},\qquad \bar G_t = \tfrac{(n-1)\bar G_{t-1} + G_t}{n}`}</Tex>

      <h3 className="label pt-4 text-fg">Sizing</h3>
      <p>Fixed fraction f of equity at entry, or volatility targeting with trailing realized volatility σ̂ (no look-ahead: σ̂ uses closes up to t):</p>
      <Tex block>{String.raw`f_t = \min\!\Big(f_{\max},\ \frac{\sigma^{*}}{\hat\sigma_t}\Big)`}</Tex>

      <h3 className="label pt-4 text-fg">Metrics</h3>
      <Tex block>{String.raw`\mathrm{CAGR} = \Big(\tfrac{E_T}{E_0}\Big)^{P/n} - 1,\quad \mathrm{Sharpe} = \frac{\overline{r - r_f}}{s(r - r_f)}\sqrt P,\quad \mathrm{Sortino} = \frac{\overline{r - r_f}}{\sqrt{\tfrac1n\sum \min(r_t-r_f,0)^2}}\sqrt P`}</Tex>
      <Tex block>{String.raw`\mathrm{MDD} = \max_t\Big(1 - \frac{E_t}{\max_{u\le t}E_u}\Big),\qquad \mathrm{Calmar} = \frac{\mathrm{CAGR}}{\mathrm{MDD}},\qquad \beta = \frac{\mathrm{Cov}(r, r_b)}{\mathrm{Var}(r_b)}`}</Tex>
      <p>VaR/CVaR are reported on daily returns (historical and Gaussian). The annual risk-free rate is converted per period as (1+r<sub>f</sub>)<sup>1/P</sup> − 1.</p>

      <h3 className="label pt-4 text-fg">Parameter sweeps &amp; overfitting</h3>
      <p>
        The sweep re-runs the same backtest across a grid of two parameters on the same data. The best cell is an <em>in-sample</em> maximum: it is optimistic by
        construction (selection bias). Prefer broad plateaus over sharp peaks, and validate on data the sweep has not seen.
      </p>

      <h3 className="label pt-4 text-fg">Limitations</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Daily bars only: no intraday path, partial fills, borrow costs, funding or taxes.</li>
        <li>Opening prices for crypto are the 00:00 UTC print; liquidity at that instant varies.</li>
        <li>Survivorship: today’s listed assets have, by definition, survived.</li>
      </ul>
    </>
  );
}
