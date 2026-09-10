"""Feature engineering. Pure-Python/stdlib-math implementations so they can
run on plain lists of bars without pulling in pandas/polars — callers that
already have a DataFrame can vectorize equivalently with polars/pandas for
speed; these are the reference implementations used in tests and small
backtests."""
from __future__ import annotations

import math


def returns(closes: list[float]) -> list[float]:
    return [
        (closes[i] - closes[i - 1]) / closes[i - 1] if closes[i - 1] else 0.0
        for i in range(1, len(closes))
    ]


def volatility(closes: list[float], window: int = 20) -> float:
    r = returns(closes[-(window + 1):])
    if len(r) < 2:
        return 0.0
    mean = sum(r) / len(r)
    var = sum((x - mean) ** 2 for x in r) / (len(r) - 1)
    return math.sqrt(var)


def atr(highs: list[float], lows: list[float], closes: list[float], window: int = 14) -> float:
    n = len(closes)
    if n < 2:
        return 0.0
    true_ranges = []
    for i in range(1, n):
        tr = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i] - closes[i - 1]),
        )
        true_ranges.append(tr)
    window_trs = true_ranges[-window:]
    return sum(window_trs) / len(window_trs) if window_trs else 0.0


def rsi(closes: list[float], window: int = 14) -> float:
    if len(closes) < window + 1:
        return 50.0
    diffs = [closes[i] - closes[i - 1] for i in range(len(closes) - window, len(closes))]
    gains = [d for d in diffs if d > 0]
    losses = [-d for d in diffs if d < 0]
    avg_gain = sum(gains) / window
    avg_loss = sum(losses) / window
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return 100 - (100 / (1 + rs))


def ema(values: list[float], span: int) -> list[float]:
    if not values:
        return []
    alpha = 2 / (span + 1)
    out = [values[0]]
    for v in values[1:]:
        out.append(alpha * v + (1 - alpha) * out[-1])
    return out


def macd(closes: list[float], fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[float, float, float]:
    if len(closes) < slow + signal:
        return 0.0, 0.0, 0.0
    ema_fast = ema(closes, fast)
    ema_slow = ema(closes, slow)
    macd_line = [f - s for f, s in zip(ema_fast, ema_slow)]
    signal_line = ema(macd_line, signal)
    hist = macd_line[-1] - signal_line[-1]
    return macd_line[-1], signal_line[-1], hist


def order_flow_imbalance(bid_volume: float, ask_volume: float) -> float:
    total = bid_volume + ask_volume
    if total == 0:
        return 0.0
    return (bid_volume - ask_volume) / total


def funding_basis(spot_price: float, perp_price: float) -> float:
    if spot_price == 0:
        return 0.0
    return (perp_price - spot_price) / spot_price
