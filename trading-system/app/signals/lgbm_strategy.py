"""LightGBM baseline strategy with walk-forward retraining, wired to the same
`StrategyFn` interface (`Callable[[str, list[Bar]], Signal | None]`) the
event-driven backtest engine and the paper-trading loop both call.

Unlike `app.signals.model.WalkForwardLGBM` (an offline tool for evaluating a
model's walk-forward fold metrics before deploying it), this class *is* the
walk-forward mechanism for live use: it is called once per bar, in
chronological order, and periodically retrains on everything seen so far —
never on future data — so the event-driven backtest loop itself provides the
out-of-sample walk-forward evaluation. LightGBM is imported lazily so the
rest of the system never needs the `[ml]` extra installed.
"""
from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from app.features.indicators import atr, macd, returns, rsi, volatility
from app.models.trading import Signal, SignalDirection


class LGBMWalkForwardSignalGenerator:
    """Stateful strategy object — construct one fresh instance per backtest
    or paper-trading run; it accumulates its own bar history internally as
    it's called, so it doesn't depend on the caller's per-call window size
    beyond that window's last (current) bar.
    """

    def __init__(
        self,
        feature_lookback: int = 30,
        min_train_size: int = 60,
        retrain_every: int = 20,
        confidence_threshold: float = 0.05,
        params: dict[str, Any] | None = None,
    ):
        self.feature_lookback = feature_lookback
        self.min_train_size = min_train_size
        self.retrain_every = retrain_every
        self.confidence_threshold = confidence_threshold
        self.params = params or {"n_estimators": 50, "max_depth": 4, "learning_rate": 0.1, "verbosity": -1}

        self._history: list[Any] = []
        self._model: Any = None
        self._last_train_size = 0
        self.retrain_count = 0

    def _featurize(self, bars_slice: list[Any]) -> list[float] | None:
        if len(bars_slice) < self.feature_lookback:
            return None
        closes = [b.close for b in bars_slice]
        highs = [b.high for b in bars_slice]
        lows = [b.low for b in bars_slice]
        r = returns(closes)
        return [
            r[-1] if r else 0.0,
            volatility(closes, window=min(20, len(closes) - 1)),
            atr(highs, lows, closes, window=min(14, len(closes) - 1)),
            rsi(closes, window=min(14, len(closes) - 1)),
            macd(closes)[2],
            getattr(bars_slice[-1], "funding_rate", 0.0) or 0.0,
        ]

    def _build_training_set(self) -> tuple[list[list[float]], list[int]]:
        X: list[list[float]] = []
        y: list[int] = []
        n = len(self._history)
        # j needs feature_lookback bars ending at j, and a known label from j+1
        for j in range(self.feature_lookback - 1, n - 1):
            window = self._history[max(0, j - self.feature_lookback + 1) : j + 1]
            feats = self._featurize(window)
            if feats is None:
                continue
            next_return = (
                (self._history[j + 1].close - self._history[j].close) / self._history[j].close
                if self._history[j].close
                else 0.0
            )
            X.append(feats)
            y.append(1 if next_return > 0 else 0)
        return X, y

    def _retrain(self) -> None:
        import lightgbm as lgb

        X, y = self._build_training_set()
        if len(X) < 10 or len(set(y)) < 2:
            # not enough signal yet (too little data, or a single class so far)
            return
        model = lgb.LGBMClassifier(**self.params)
        model.fit(X, y)
        self._model = model
        self._last_train_size = len(self._history)
        self.retrain_count += 1

    def __call__(self, symbol: str, bars: list[Any]) -> Signal | None:
        current_bar = bars[-1]
        self._history.append(current_bar)

        if len(self._history) < self.min_train_size:
            return None

        if self._model is None or (len(self._history) - self._last_train_size) >= self.retrain_every:
            self._retrain()

        if self._model is None:
            return None

        feats = self._featurize(self._history[-self.feature_lookback :])
        if feats is None:
            return None

        classes = list(self._model.classes_)
        proba = self._model.predict_proba([feats])[0]
        p_up = proba[classes.index(1)] if 1 in classes else 0.5

        edge = p_up - 0.5
        if edge > self.confidence_threshold:
            direction = SignalDirection.LONG
        elif edge < -self.confidence_threshold:
            direction = SignalDirection.SHORT
        else:
            direction = SignalDirection.FLAT

        confidence = min(1.0, abs(edge) * 2)
        ts = current_bar.ts if isinstance(current_bar.ts, datetime) else datetime.now(UTC)

        return Signal(
            symbol=symbol,
            ts=ts,
            direction=direction,
            confidence=confidence,
            predicted_return=edge,
            model_name="lightgbm_walkforward",
            model_version=f"retrain_{self.retrain_count}",
        )
