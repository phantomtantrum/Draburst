import { Tex } from '@/components/math/Tex';

export function PortfolioMethodology() {
  return (
    <>
      <h3 className="label text-fg">Inputs</h3>
      <p>
        Daily closes are aligned on the intersection of dates across all assets (no forward-fill). When crypto and stocks are mixed, crypto
        returns span the same wall-clock interval as the stock’s (e.g. Friday→Monday includes the weekend) and annualization uses P = 252.
      </p>
      <Tex block>{String.raw`\mu_i = P\cdot\overline{r_i},\qquad \Sigma = P\cdot\widehat{\mathrm{Cov}}(r)`}</Tex>

      <h3 className="label pt-4 text-fg">Ledoit–Wolf shrinkage</h3>
      <p>With few observations relative to assets, the sample covariance is noisy and ill-conditioned. Shrinkage toward a scaled identity:</p>
      <Tex block>{String.raw`\hat\Sigma_{LW} = (1-\delta^*)\,S + \delta^*\,\bar m\,I,\qquad \bar m = \tfrac{\operatorname{tr}S}{N},\qquad \delta^* = \min\!\Big(1,\tfrac{\bar\beta^2}{\lVert S-\bar m I\rVert_F^2/N}\Big)`}</Tex>
      <p>The optimal intensity δ* is estimated from the data (Ledoit &amp; Wolf, 2004) and shown with the results.</p>

      <h3 className="label pt-4 text-fg">Optimization</h3>
      <Tex block>{String.raw`\min_{w}\; w^\top\Sigma w - \lambda\,\mu^\top w\quad\text{s.t.}\quad \textstyle\sum_i w_i = 1,\ \ \ell_i \le w_i \le u_i`}</Tex>
      <p>
        Solved by accelerated projected gradient (FISTA with restart). The projection onto the budget-and-box set is exact. λ = 0 gives the minimum-variance
        portfolio; sweeping λ traces the efficient frontier. Max-Sharpe maximizes
      </p>
      <Tex block>{String.raw`\mathrm{SR}(w) = \frac{\mu^\top w - r_f}{\sqrt{w^\top\Sigma w}}`}</Tex>
      <p>along the frontier (where it is unimodal) by golden-section search. Risk contribution of asset i:</p>
      <Tex block>{String.raw`\mathrm{RC}_i = \frac{w_i(\Sigma w)_i}{w^\top\Sigma w},\qquad \textstyle\sum_i \mathrm{RC}_i = 1`}</Tex>

      <h3 className="label pt-4 text-fg">Limitations</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>Mean–variance is extremely sensitive to μ. Historical means are poor forecasts; max-Sharpe weights can swing with a small window change.</li>
        <li>Correlations rise in crises; a covariance estimated in calm periods understates joint downside.</li>
        <li>No transaction costs, taxes or rebalancing frictions; crypto and equity closes are ~3–4 hours apart.</li>
      </ul>
    </>
  );
}
