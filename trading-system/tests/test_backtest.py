import math
from datetime import UTC, datetime, timedelta

import pytest

from app.backtest.engine import BacktestEngine, Bar
from app.config import Settings
from app.models.trading import Signal, SignalDirection
from app.signals.baseline import BaselineSignalGenerator


def _synthetic_bars(symbol: str, n: int = 300) -> list[Bar]:
    """Oscillating price series so RSI/MACD actually swing between
    overbought/oversold and the baseline strategy generates real signals."""
    start = datetime(2024, 1, 1, tzinfo=UTC)
    bars = []
    price = 100.0
    for i in range(n):
        price = 100.0 + 15.0 * math.sin(i / 12.0) + (i % 7) * 0.05
        high = price * 1.002
        low = price * 0.998
        bars.append(
            Bar(
                symbol=symbol,
                ts=start + timedelta(hours=i),
                open=price,
                high=high,
                low=low,
                close=price,
                volume=1_000.0,
            )
        )
    return bars


def test_backtest_end_to_end_produces_sane_output():
    settings = Settings(max_position_pct=0.2, max_order_notional=50_000.0)
    engine = BacktestEngine(settings=settings, starting_equity=100_000.0)
    bars = _synthetic_bars("BTC/USDT")

    result = engine.run({"BTC/USDT": bars}, BaselineSignalGenerator())

    assert len(result.equity_curve) == len(bars)
    assert len(result.timestamps) == len(bars)
    assert all(e > 0 for e in result.equity_curve), "equity should never go non-positive in this scenario"
    assert result.accepted_orders + result.rejected_orders >= 0
    # the oscillating series should trigger at least one real signal
    assert result.accepted_orders > 0
    assert result.metrics.num_trades >= 0
    assert isinstance(result.metrics.sharpe, float)
    assert isinstance(result.metrics.max_drawdown, float)
    assert 0.0 <= result.metrics.max_drawdown <= 1.0


def test_backtest_routes_every_order_through_risk_engine_and_can_reject():
    """The backtest engine must use the exact same RiskEngine as paper trading
    (see app.risk.engine.RiskEngine) rather than a bypassed/simplified copy —
    proven here by making the order-size cap so tight that fills are vetoed,
    which is only possible if every simulated order actually reaches it."""
    permissive = Settings(max_position_pct=0.2, max_order_notional=1_000_000.0)
    bars = _synthetic_bars("BTC/USDT")
    baseline_result = BacktestEngine(settings=permissive, starting_equity=100_000.0).run(
        {"BTC/USDT": bars}, BaselineSignalGenerator()
    )
    assert baseline_result.accepted_orders > 0

    tight = Settings(max_position_pct=0.2, max_order_notional=1.0)  # $1 cap — everything gets vetoed
    tight_result = BacktestEngine(settings=tight, starting_equity=100_000.0).run(
        {"BTC/USDT": bars}, BaselineSignalGenerator()
    )
    assert tight_result.accepted_orders == 0
    assert tight_result.rejected_orders > 0
    # equity is untouched when every order is vetoed (no fills, no fees)
    assert tight_result.equity_curve[-1] == tight_result.equity_curve[0] == 100_000.0


def test_funding_accrues_every_bar_a_position_is_held_not_just_on_fill_bars():
    """A held position accrues funding on every bar until closed, not only on
    the bar where a fill happened — funding is charged per settlement period
    regardless of trading activity."""
    start = datetime(2024, 1, 1, tzinfo=UTC)
    n_bars = 6
    funding_rate = 0.001

    def make_bars(rate: float) -> list[Bar]:
        return [
            Bar(
                symbol="BTC/USDT",
                ts=start + timedelta(hours=i),
                open=100.0,
                high=100.0,
                low=100.0,
                close=100.0,
                volume=1_000.0,
                funding_rate=rate,
            )
            for i in range(n_bars)
        ]

    calls = {"n": 0}

    def enter_once_then_hold(symbol: str, window: list[Bar]):
        calls["n"] += 1
        if calls["n"] == 1:
            return Signal(
                symbol=symbol, ts=window[-1].ts, direction=SignalDirection.LONG, confidence=1.0, model_name="test"
            )
        return None  # hold — never trades again

    settings = Settings(max_position_pct=1.0, max_leverage=1.0, max_order_notional=1_000_000.0)

    no_funding = BacktestEngine(settings=settings, starting_equity=100_000.0).run(
        {"BTC/USDT": make_bars(0.0)}, enter_once_then_hold, lookback=1
    )
    calls["n"] = 0
    with_funding = BacktestEngine(settings=settings, starting_equity=100_000.0).run(
        {"BTC/USDT": make_bars(funding_rate)}, enter_once_then_hold, lookback=1
    )

    # entry: full equity -> 1000 units @ 100.0, held unchanged for the rest of the run
    qty = 1000.0
    single_bar_funding = qty * 100.0 * funding_rate  # = 100.0

    diff = no_funding.equity_curve[-1] - with_funding.equity_curve[-1]
    # position is open (and thus accruing funding) for bars 1..n_bars-1 = 5 bars,
    # not just the single entry bar
    assert diff == pytest.approx(single_bar_funding * (n_bars - 1), rel=1e-9)
