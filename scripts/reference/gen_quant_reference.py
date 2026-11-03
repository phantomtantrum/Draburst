"""Generate reference values for src/lib/quant tests using numpy/scipy/sklearn.

Usage:  PYTHONPATH=<dir with scipy+sklearn> python3 scripts/reference/gen_quant_reference.py
Writes: src/lib/quant/__fixtures__/reference.json
"""
import json, pathlib
import numpy as np
from scipy import stats, optimize
from sklearn.covariance import ledoit_wolf

rs = np.random.RandomState(20261103)
out = {}

# ── stats ──
x = rs.normal(0.0005, 0.02, 250)
out["stats"] = {
    "x": x.tolist(),
    "mean": float(np.mean(x)),
    "var": float(np.var(x, ddof=1)),
    "std": float(np.std(x, ddof=1)),
    "q": {str(p): float(np.quantile(x, p)) for p in [0.01, 0.05, 0.25, 0.5, 0.75, 0.95, 0.99]},
    "skew": float(stats.skew(x, bias=True)),
    "exkurt": float(stats.kurtosis(x, fisher=True, bias=True)),
}
ps = [1e-10, 1e-5, 0.001, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 0.7, 0.9, 0.95, 0.975, 0.99, 0.999, 1 - 1e-7]
out["norm"] = {
    "p": ps,
    "ppf": [float(stats.norm.ppf(p)) for p in ps],
    "z": [-6, -3, -1.96, -1, -0.5, 0, 0.5, 1, 1.645, 3, 6],
}
out["norm"]["cdf"] = [float(stats.norm.cdf(z)) for z in out["norm"]["z"]]

# ── risk on x ──
out["risk"] = {
    "hvar95": float(-np.quantile(x, 0.05)),
    "hvar99": float(-np.quantile(x, 0.01)),
    "hcvar95": float(-x[x <= np.quantile(x, 0.05)].mean()),
    "pvar95": float(-(x.mean() + x.std(ddof=1) * stats.norm.ppf(0.05))),
    "pcvar95": float(-x.mean() + x.std(ddof=1) * stats.norm.pdf(stats.norm.ppf(0.95)) / 0.05),
}

# ── covariance ──
T, N = 120, 6
L = rs.normal(0, 1, (N, N)) * 0.3 + np.eye(N)
X = rs.normal(0, 0.015, (T, N)) @ L.T + rs.normal(0.0004, 0.0002, N)
lw_cov, lw_shrink = ledoit_wolf(X)
out["cov"] = {
    "cols": X.T.tolist(),
    "sample": np.cov(X, rowvar=False, ddof=1).tolist(),
    "lw": lw_cov.tolist(),
    "lwShrinkage": float(lw_shrink),
}
# small-sample case (T < N) where shrinkage matters
X2 = rs.normal(0, 0.01, (8, 12))
c2, s2 = ledoit_wolf(X2)
out["cov"]["small"] = {"cols": X2.T.tolist(), "lw": c2.tolist(), "lwShrinkage": float(s2)}

# ── optimization ──
S = np.array([[0.04, 0.006, 0.012, 0.002], [0.006, 0.09, 0.018, 0.004], [0.012, 0.018, 0.0625, 0.01], [0.002, 0.004, 0.01, 0.0225]])
mu = np.array([0.08, 0.12, 0.10, 0.05])
rf = 0.02
inv = np.linalg.inv(S)
one = np.ones(4)
w_mv = inv @ one / (one @ inv @ one)
w_tan = inv @ (mu - rf); w_tan = w_tan / w_tan.sum()

def solve(obj, lo, hi):
    cons = [{"type": "eq", "fun": lambda w: w.sum() - 1}]
    best = None
    for start in [np.full(4, 0.25), np.array([0.7, 0.1, 0.1, 0.1]), np.array([0.1, 0.1, 0.1, 0.7])]:
        r = optimize.minimize(obj, start, bounds=[(lo, hi)] * 4, constraints=cons, method="SLSQP", options={"ftol": 1e-15, "maxiter": 2000})
        if best is None or r.fun < best.fun:
            best = r
    return best.x

w_mv_lo = solve(lambda w: w @ S @ w, 0.0, 1.0)
w_tan_lo = solve(lambda w: -(w @ mu - rf) / np.sqrt(w @ S @ w), 0.0, 1.0)
w_mv_box = solve(lambda w: w @ S @ w, 0.1, 0.4)
w_tan_box = solve(lambda w: -(w @ mu - rf) / np.sqrt(w @ S @ w), 0.05, 0.3)
out["opt"] = {
    "cov": S.tolist(), "mu": mu.tolist(), "rf": rf,
    "minVarUnconstrained": w_mv.tolist(),
    "tangencyUnconstrained": w_tan.tolist(),
    "minVarLongOnly": w_mv_lo.tolist(),
    "tangencyLongOnly": w_tan_lo.tolist(),
    "tangencyLongOnlySharpe": float((w_tan_lo @ mu - rf) / np.sqrt(w_tan_lo @ S @ w_tan_lo)),
    "minVarBox": w_mv_box.tolist(),
    "tangencyBox": w_tan_box.tolist(),
    "tangencyBoxSharpe": float((w_tan_box @ mu - rf) / np.sqrt(w_tan_box @ S @ w_tan_box)),
}

# ── GBM lognormal analytic ──
s0, m_, sg, Tyr = 100.0, 0.08, 0.3, 1.0
mlog = np.log(s0) + (m_ - sg**2 / 2) * Tyr
out["gbm"] = {
    "s0": s0, "mu": m_, "sigma": sg, "T": Tyr,
    "median": float(np.exp(mlog)),
    "mean": float(s0 * np.exp(m_ * Tyr)),
    "pAbove120": float(1 - stats.norm.cdf((np.log(120) - mlog) / (sg * np.sqrt(Tyr)))),
    "q05": float(np.exp(mlog + sg * np.sqrt(Tyr) * stats.norm.ppf(0.05))),
}

# binding long-only case: low-return asset 0 gets a negative unconstrained weight
mu2 = np.array([0.01, 0.14, 0.11, 0.06])
w_tan2 = inv @ (mu2 - rf); w_tan2 = w_tan2 / w_tan2.sum()
def solve2(obj, lo, hi):
    cons = [{"type": "eq", "fun": lambda w: w.sum() - 1}]
    best = None
    for start in [np.full(4, 0.25), np.array([0.05, 0.45, 0.25, 0.25]), np.array([0.0, 0.3, 0.3, 0.4])]:
        r = optimize.minimize(obj, start, bounds=[(lo, hi)] * 4, constraints=cons, method="SLSQP", options={"ftol": 1e-15, "maxiter": 2000})
        if best is None or r.fun < best.fun:
            best = r
    return best.x
w_tan2_lo = solve2(lambda w: -(w @ mu2 - rf) / np.sqrt(w @ S @ w), 0.0, 1.0)
out["opt2"] = {
    "mu": mu2.tolist(),
    "tangencyUnconstrained": w_tan2.tolist(),
    "tangencyLongOnly": w_tan2_lo.tolist(),
    "tangencyLongOnlySharpe": float((w_tan2_lo @ mu2 - rf) / np.sqrt(w_tan2_lo @ S @ w_tan2_lo)),
}

p = pathlib.Path(__file__).resolve().parents[2] / "src/lib/quant/__fixtures__/reference.json"
p.write_text(json.dumps(out, indent=1))
print("wrote", p)
