import { mean, normInv, normPdf, sortedCopy, std, quantileSorted, type Num } from './stats';

/**
 * Value at Risk and Conditional VaR (Expected Shortfall).
 * Sign convention: losses are reported as POSITIVE fractions.
 * `confidence` is e.g. 0.95 → the 5% left tail.
 */

/** Historical VaR: −q_{1−c}(r), linear-interpolated empirical quantile (type 7). */
export function historicalVaR(returns: Num, confidence = 0.95): number {
  const s = sortedCopy(returns);
  return -quantileSorted(s, 1 - confidence);
}

/** Historical CVaR: −mean of returns at or below the (1−c) quantile. */
export function historicalCVaR(returns: Num, confidence = 0.95): number {
  const s = sortedCopy(returns);
  const q = quantileSorted(s, 1 - confidence);
  let sum = 0,
    k = 0;
  for (let i = 0; i < s.length && s[i]! <= q; i++) {
    sum += s[i]!;
    k++;
  }
  return k ? -sum / k : NaN;
}

/** Parametric (Gaussian) VaR: −(μ + σ Φ⁻¹(1−c)). */
export function parametricVaR(returns: Num, confidence = 0.95): number {
  return gaussianVaR(mean(returns), std(returns), confidence);
}

/** Parametric (Gaussian) CVaR: −μ + σ φ(Φ⁻¹(c)) / (1−c). */
export function parametricCVaR(returns: Num, confidence = 0.95): number {
  return gaussianCVaR(mean(returns), std(returns), confidence);
}

export function gaussianVaR(mu: number, sigma: number, confidence = 0.95): number {
  return -(mu + sigma * normInv(1 - confidence));
}

export function gaussianCVaR(mu: number, sigma: number, confidence = 0.95): number {
  const z = normInv(confidence);
  return -mu + (sigma * normPdf(z)) / (1 - confidence);
}

/** Scale a 1-period VaR to h periods under i.i.d. Gaussian (√h rule). */
export function scaleVaR(mu: number, sigma: number, h: number, confidence = 0.95): number {
  return gaussianVaR(mu * h, sigma * Math.sqrt(h), confidence);
}
