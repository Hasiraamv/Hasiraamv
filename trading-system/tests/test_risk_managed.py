"""Tests for StopLossTakeProfitWrapper — proves it actually flattens a
losing/winning position rather than flipping into an opposite one, since
that's the sharp edge in how Signal.confidence maps to target notional."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from app.backtest.engine import Bar
from app.models.trading import Signal, SignalDirection
from app.signals.risk_managed import StopLossTakeProfitWrapper


def _bar(price: float, i: int) -> Bar:
    return Bar(
        symbol="BTC/USDT",
        ts=datetime(2026, 1, 1, tzinfo=UTC) + timedelta(hours=i),
        open=price,
        high=price,
        low=price,
        close=price,
        volume=1.0,
    )


class _ScriptedStrategy:
    """Emits a fixed sequence of signals, one per call, then FLAT forever."""

    def __init__(self, signals: list[Signal | None]):
        self._signals = signals
        self._i = 0

    def __call__(self, symbol: str, bars: list[Bar]) -> Signal | None:
        if self._i >= len(self._signals):
            return None
        s = self._signals[self._i]
        self._i += 1
        return s


def _long_signal(bar: Bar, confidence: float = 1.0) -> Signal:
    return Signal(symbol="BTC/USDT", ts=bar.ts, direction=SignalDirection.LONG, confidence=confidence, model_name="test")


def test_stop_loss_flattens_not_flips():
    bars = [_bar(100.0, 0), _bar(94.0, 1)]  # -6% move, past a 5% stop
    inner = _ScriptedStrategy([_long_signal(bars[0])])
    wrapped = StopLossTakeProfitWrapper(inner, stop_loss_pct=0.05, take_profit_pct=0.10)

    entry_signal = wrapped("BTC/USDT", bars[:1])
    assert entry_signal is not None and entry_signal.direction == SignalDirection.LONG

    exit_signal = wrapped("BTC/USDT", bars[:2])
    assert exit_signal is not None
    assert exit_signal.confidence == 0.0, "confidence must be 0.0 so target notional is exactly zero (flat), not a flip"
    assert "stop_loss" in exit_signal.model_name


def test_take_profit_flattens():
    bars = [_bar(100.0, 0), _bar(111.0, 1)]  # +11% move, past a 10% take-profit
    inner = _ScriptedStrategy([_long_signal(bars[0])])
    wrapped = StopLossTakeProfitWrapper(inner, stop_loss_pct=0.05, take_profit_pct=0.10)

    wrapped("BTC/USDT", bars[:1])
    exit_signal = wrapped("BTC/USDT", bars[:2])
    assert exit_signal is not None
    assert exit_signal.confidence == 0.0
    assert "take_profit" in exit_signal.model_name


def test_no_exit_within_band():
    bars = [_bar(100.0, 0), _bar(102.0, 1)]  # +2%, inside both bands
    inner = _ScriptedStrategy([_long_signal(bars[0]), None])
    wrapped = StopLossTakeProfitWrapper(inner, stop_loss_pct=0.05, take_profit_pct=0.10)

    wrapped("BTC/USDT", bars[:1])
    result = wrapped("BTC/USDT", bars[:2])
    assert result is None, "should defer to inner strategy when neither band is breached"


def test_full_backtest_integration_caps_a_losing_trade():
    """End to end through the real BacktestEngine: a strategy that goes long
    and then the price craters should have the loss capped near stop_loss_pct
    of the position notional, not ride the full drawdown."""
    from app.backtest.engine import BacktestEngine
    from app.config import Settings

    # Gradual decline so the stop can actually catch it near -5% — a coarser
    # path that gaps straight past the stop (e.g. 100 -> 80 in one bar) will
    # legitimately realize a larger loss, since this wrapper only checks at
    # bar close, not intrabar; that's a real, documented limitation, not
    # what this test is checking.
    prices = [100.0, 100.0, 99.0, 97.0, 94.0, 90.0, 85.0, 80.0]
    bars = [_bar(p, i) for i, p in enumerate(prices)]

    inner = _ScriptedStrategy([_long_signal(bars[0])])
    wrapped = StopLossTakeProfitWrapper(inner, stop_loss_pct=0.05, take_profit_pct=0.10)

    settings = Settings(max_position_pct=0.5, max_order_notional=1_000_000.0)
    engine = BacktestEngine(settings=settings, starting_equity=1000.0)
    result = engine.run({"BTC/USDT": bars}, wrapped, lookback=10)

    assert result.accepted_orders >= 2, "expected an entry and a stop-loss exit"
    assert len(result.trade_pnls) == 1
    pnl = result.trade_pnls[0]
    position_notional = 1000.0 * 0.5  # max_position_pct * starting_equity
    assert pnl < 0, "the trade should be a loss given the price crater"
    assert abs(pnl) < position_notional * 0.15, (
        f"loss {pnl} should be capped near the 5% stop, not the full ~40% price drop"
    )
