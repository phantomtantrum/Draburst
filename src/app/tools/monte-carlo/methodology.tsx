import { Tex } from '@/components/math/Tex';

export function McMethodology() {
  return (
    <>
      <h3 className="label text-fg">Geometric Brownian motion</h3>
      <p>Prices follow a lognormal random walk with constant annual drift μ and volatility σ. With Δt = 1/periods-per-year:</p>
      <Tex block>{String.raw`S_{t+\Delta t} = S_t \exp\!\Big(\big(\mu - \tfrac{1}{2}\sigma^2\big)\Delta t + \sigma\sqrt{\Delta t}\,Z_t\Big),\quad Z_t \sim \mathcal N(0,1)`}</Tex>
      <p>μ and σ are estimated from daily log returns r over the lookback window and can be edited:</p>
      <Tex block>{String.raw`\hat\sigma = s(r)\sqrt{P},\qquad \hat\mu = \bar r\,P + \tfrac12\hat\sigma^2,\qquad P = \begin{cases}252 & \text{stocks}\\ 365 & \text{crypto}\end{cases}`}</Tex>
      <p>The closed-form terminal distribution is shown alongside the simulation as a check:</p>
      <Tex block>{String.raw`\ln S_T \sim \mathcal N\!\Big(\ln S_0 + (\mu-\tfrac12\sigma^2)T,\ \sigma^2 T\Big)`}</Tex>

      <h3 className="label pt-4 text-fg">Historical block bootstrap</h3>
      <p>
        Instead of assuming normality, future log returns are resampled from the observed history in contiguous blocks of length b (circular),
        which preserves fat tails and short-range volatility clustering. b = 1 is the i.i.d. bootstrap.
      </p>
      <Tex block>{String.raw`\ln S_T = \ln S_0 + \sum_{k=1}^{\lceil H/b\rceil}\sum_{j=0}^{b-1} r_{(u_k + j) \bmod n},\qquad u_k \sim \mathcal U\{0,\dots,n-1\}`}</Tex>

      <h3 className="label pt-4 text-fg">Outputs</h3>
      <p>Percentile bands are exact order statistics across all paths at up to 121 checkpoints. Risk at the horizon uses the simple return R = S<sub>T</sub>/S<sub>0</sub> − 1:</p>
      <Tex block>{String.raw`\mathrm{VaR}_c = -q_{1-c}(R),\qquad \mathrm{CVaR}_c = -\,\mathbb E\big[R \mid R \le q_{1-c}(R)\big]`}</Tex>
      <p>Quantiles use linear interpolation between order statistics (Hyndman–Fan type 7). Probabilities are empirical frequencies across paths.</p>

      <h3 className="label pt-4 text-fg">Reproducibility</h3>
      <p>
        Random numbers come from xoshiro128** seeded via splitmix32; normals via the Marsaglia polar method. The same seed and inputs reproduce
        every path exactly — the seed is part of the URL and of saved runs.
      </p>

      <h3 className="label pt-4 text-fg">Limitations</h3>
      <ul className="list-disc space-y-1 pl-5">
        <li>GBM ignores fat tails, jumps and volatility clustering; it understates extreme moves, especially in crypto.</li>
        <li>The bootstrap can only replay what happened in the lookback window — regimes it did not see are absent.</li>
        <li>Drift estimates from a few years of data are extremely noisy; small changes in μ dominate long horizons.</li>
        <li>No transaction costs, taxes, dividends reinvestment differences or liquidity effects are modelled.</li>
      </ul>
    </>
  );
}
