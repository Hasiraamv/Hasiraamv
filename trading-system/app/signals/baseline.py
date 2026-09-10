"""A dependency-free baseline strategy (RSI + MACD crossover) used for
backtest sanity checks and as a fallback when no trained model is available."""
from __future__ import annotations

from datetime import UTC, datetime

from app.features.indicators import macd, rsi
from app.models.trading import Signal, SignalDirection


class BaselineSignalGenerator:
    def __init__(self, rsi_window: int = 14, oversold: float = 30.0, overbought: float = 70.0):
        self.rsi_window = rsi_window
        self.oversold = oversold
        self.overbought = overbought

    def __call__(self, symbol: str, bars) -> Signal | None:
        closes = [b.close for b in bars]
        if len(closes) < self.rsi_window + 1:
            return None

        r = rsi(closes, self.rsi_window)
        _, _, hist = macd(closes)

        if r < self.oversold and hist > 0:
            direction = SignalDirection.LONG
            confidence = min(1.0, (self.oversold - r) / self.oversold + 0.3)
        elif r > self.overbought and hist < 0:
            direction = SignalDirection.SHORT
            confidence = min(1.0, (r - self.overbought) / (100 - self.overbought) + 0.3)
        else:
            direction = SignalDirection.FLAT
            confidence = 0.0

        return Signal(
            symbol=symbol,
            ts=bars[-1].ts if isinstance(bars[-1].ts, datetime) else datetime.now(UTC),
            direction=direction,
            confidence=confidence,
            model_name="baseline_rsi_macd",
        )
