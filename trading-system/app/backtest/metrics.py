"""Backtest performance metrics computed from an equity curve and trade log."""
from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class Metrics:
    total_return: float
    sharpe: float
    sortino: float
    max_drawdown: float
    calmar: float
    turnover: float
    hit_rate: float
    num_trades: int


def compute_metrics(
    equity_curve: list[float],
    trade_pnls: list[float],
    turnover_notional: float,
    periods_per_year: float = 365.0,
) -> Metrics:
    if len(equity_curve) < 2:
        return Metrics(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0)

    returns = [
        (equity_curve[i] - equity_curve[i - 1]) / equity_curve[i - 1]
        for i in range(1, len(equity_curve))
        if equity_curve[i - 1] != 0
    ]
    total_return = (equity_curve[-1] - equity_curve[0]) / equity_curve[0] if equity_curve[0] else 0.0

    mean_r = sum(returns) / len(returns) if returns else 0.0
    std_r = _stdev(returns)
    sharpe = (mean_r / std_r) * math.sqrt(periods_per_year) if std_r > 0 else 0.0

    downside = [r for r in returns if r < 0]
    downside_std = _stdev(downside)
    sortino = (mean_r / downside_std) * math.sqrt(periods_per_year) if downside_std > 0 else 0.0

    peak = equity_curve[0]
    max_dd = 0.0
    for v in equity_curve:
        peak = max(peak, v)
        if peak > 0:
            max_dd = max(max_dd, (peak - v) / peak)

    calmar = (total_return / max_dd) if max_dd > 0 else 0.0

    avg_equity = sum(equity_curve) / len(equity_curve) if equity_curve else 1.0
    turnover = turnover_notional / avg_equity if avg_equity else 0.0

    wins = sum(1 for p in trade_pnls if p > 0)
    hit_rate = wins / len(trade_pnls) if trade_pnls else 0.0

    return Metrics(
        total_return=total_return,
        sharpe=sharpe,
        sortino=sortino,
        max_drawdown=max_dd,
        calmar=calmar,
        turnover=turnover,
        hit_rate=hit_rate,
        num_trades=len(trade_pnls),
    )


def _stdev(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((v - mean) ** 2 for v in values) / (len(values) - 1)
    return math.sqrt(variance)
