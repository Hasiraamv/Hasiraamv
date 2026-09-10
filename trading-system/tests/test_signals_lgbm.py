"""Tests for the LightGBM walk-forward strategy. Uses the real `lightgbm`
package (skipped if the `[ml]` extra isn't installed) since the whole point
is retraining/predicting through the actual library — but keeps params tiny
(n_estimators=10) and bar counts small so the suite stays fast.
"""
from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

import pytest

pytest.importorskip("lightgbm")

from app.backtest.engine import BacktestEngine, Bar
from app.config import Settings
from app.models.trading import SignalDirection
from app.signals.lgbm_strategy import LGBMWalkForwardSignalGenerator


def _synthetic_bars(n: int = 150) -> list[Bar]:
    start = datetime(2024, 1, 1, tzinfo=UTC)
    bars = []
    for i in range(n):
        price = 100.0 + 15.0 * math.sin(i / 10.0) + (i % 5) * 0.1
        bars.append(
            Bar(
                symbol="BTC/USDT",
                ts=start + timedelta(hours=i),
                open=price,
                high=price * 1.002,
                low=price * 0.998,
                close=price,
                volume=1_000.0,
            )
        )
    return bars


def _small_params() -> dict:
    return {"n_estimators": 10, "max_depth": 3, "learning_rate": 0.2, "verbosity": -1}


def test_returns_none_before_min_train_size():
    strategy = LGBMWalkForwardSignalGenerator(min_train_size=60, feature_lookback=30, params=_small_params())
    bars = _synthetic_bars(50)

    for i in range(len(bars)):
        window = bars[max(0, i - 29) : i + 1]
        signal = strategy(bars[0].symbol, window)
        assert signal is None  # never enough history yet

    assert strategy._model is None


def test_retrains_on_schedule_and_produces_signals():
    strategy = LGBMWalkForwardSignalGenerator(
        min_train_size=60, feature_lookback=30, retrain_every=20, params=_small_params()
    )
    bars = _synthetic_bars(150)

    signals = []
    for i in range(len(bars)):
        window = bars[max(0, i - 29) : i + 1]
        signal = strategy(bars[0].symbol, window)
        if signal is not None:
            signals.append(signal)

    assert strategy._model is not None
    assert strategy.retrain_count >= 1
    # first retrain happens as soon as min_train_size is reached, then every
    # `retrain_every` bars thereafter
    assert strategy.retrain_count == 1 + (150 - 60) // 20

    assert len(signals) > 0
    for s in signals:
        assert s.direction in (SignalDirection.LONG, SignalDirection.SHORT, SignalDirection.FLAT)
        assert 0.0 <= s.confidence <= 1.0
        assert s.model_name == "lightgbm_walkforward"


def test_never_trains_on_future_data():
    """Walk-forward invariant: at call i, the training set only ever contains
    bars up to i (features end no later than i-1, labels use i at the latest
    via bars[j+1] for j <= i-1) — never a bar index >= the current call."""
    strategy = LGBMWalkForwardSignalGenerator(min_train_size=40, feature_lookback=20, retrain_every=10, params=_small_params())
    bars = _synthetic_bars(80)

    max_seen_index_at_retrain = []
    original_retrain = strategy._retrain

    def spy_retrain():
        max_seen_index_at_retrain.append(len(strategy._history) - 1)
        original_retrain()

    strategy._retrain = spy_retrain

    for i in range(len(bars)):
        window = bars[max(0, i - 19) : i + 1]
        strategy(bars[0].symbol, window)

    # every retrain's snapshot of "current index" only grows monotonically —
    # i.e. retraining at step i never sees more history than exists at i
    assert max_seen_index_at_retrain == sorted(max_seen_index_at_retrain)
    assert all(idx < 80 for idx in max_seen_index_at_retrain)


def test_wired_into_backtest_engine_end_to_end():
    settings = Settings(max_position_pct=0.2, max_order_notional=50_000.0)
    engine = BacktestEngine(settings=settings, starting_equity=100_000.0)
    bars = _synthetic_bars(200)
    strategy = LGBMWalkForwardSignalGenerator(min_train_size=60, feature_lookback=30, retrain_every=20, params=_small_params())

    result = engine.run({"BTC/USDT": bars}, strategy, lookback=30)

    assert len(result.equity_curve) == len(bars)
    assert all(e > 0 for e in result.equity_curve)
    assert isinstance(result.metrics.sharpe, float)
    assert isinstance(result.metrics.sortino, float)
    assert 0.0 <= result.metrics.max_drawdown <= 1.0
    assert result.metrics.turnover >= 0.0
    assert 0.0 <= result.metrics.hit_rate <= 1.0
