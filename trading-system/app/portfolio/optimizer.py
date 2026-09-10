"""Portfolio construction: risk parity, mean-variance, capped Kelly, CVaR.

Heavy optimization libraries (riskfolio-lib, PyPortfolioOpt, cvxpy) are
imported lazily inside each method — install with `pip install -e .[portfolio]`.
Every method returns weights already clipped to [0, max_position_pct] and
renormalized, so callers never need to re-apply position caps, though
app.risk.engine still re-checks every resulting order independently.
"""
from __future__ import annotations

from app.config import Settings, get_settings


def capped_kelly_weights(
    expected_returns: list[float],
    variances: list[float],
    kelly_fraction: float = 0.5,
    max_weight: float = 0.25,
) -> list[float]:
    """Simple per-asset capped-Kelly sizing: f* = fraction * mu / sigma^2, then
    clip and renormalize so weights sum to <= 1. No external deps."""
    raw = []
    for mu, var in zip(expected_returns, variances):
        f = kelly_fraction * mu / var if var > 0 else 0.0
        raw.append(max(0.0, min(f, max_weight)))
    total = sum(raw)
    if total > 1.0:
        raw = [w / total for w in raw]
    return raw


class PortfolioOptimizer:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def _clip_and_normalize(self, weights: dict[str, float]) -> dict[str, float]:
        cap = self.settings.max_position_pct
        clipped = {s: max(0.0, min(w, cap)) for s, w in weights.items()}
        total = sum(clipped.values())
        if total > 1.0:
            clipped = {s: w / total for s, w in clipped.items()}
        return clipped

    def risk_parity(self, returns_by_symbol: dict[str, list[float]]) -> dict[str, float]:
        import pandas as pd
        import riskfolio as rp

        df = pd.DataFrame(returns_by_symbol)
        port = rp.Portfolio(returns=df)
        port.assets_stats(method_mu="hist", method_cov="hist")
        weights = port.rp_optimization(model="Classic", rm="MV", rf=0, b=None)
        return self._clip_and_normalize(weights["weights"].to_dict())

    def mean_variance(self, returns_by_symbol: dict[str, list[float]], target_return: float | None = None) -> dict[str, float]:
        import pandas as pd
        from pypfopt import EfficientFrontier, expected_returns, risk_models

        df = pd.DataFrame(returns_by_symbol)
        prices = (1 + df).cumprod()
        mu = expected_returns.mean_historical_return(prices, returns_data=False, frequency=1)
        s = risk_models.sample_cov(prices, returns_data=False, frequency=1)
        ef = EfficientFrontier(mu, s, weight_bounds=(0, self.settings.max_position_pct))
        if target_return is not None:
            ef.efficient_return(target_return)
        else:
            ef.max_sharpe(risk_free_rate=0)
        weights = ef.clean_weights()
        return self._clip_and_normalize(dict(weights))

    def cvar_optimal(self, returns_by_symbol: dict[str, list[float]], alpha: float = 0.05) -> dict[str, float]:
        import cvxpy as cp
        import numpy as np

        symbols = list(returns_by_symbol.keys())
        R = np.array([returns_by_symbol[s] for s in symbols]).T  # (T, N)
        T, N = R.shape

        w = cp.Variable(N)
        var = cp.Variable()
        u = cp.Variable(T)

        portfolio_returns = R @ w
        cvar = var + (1 / (alpha * T)) * cp.sum(u)

        constraints = [
            u >= 0,
            u >= -portfolio_returns - var,
            cp.sum(w) == 1,
            w >= 0,
            w <= self.settings.max_position_pct,
        ]
        problem = cp.Problem(cp.Minimize(cvar), constraints)
        problem.solve()

        if w.value is None:
            return {s: 1.0 / N for s in symbols}
        return self._clip_and_normalize({s: float(v) for s, v in zip(symbols, w.value)})
