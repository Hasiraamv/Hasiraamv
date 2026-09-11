"""Wraps any StrategyFn with a per-trade stop-loss / take-profit exit.

The baseline RSI/MACD strategy (and any other signal generator) only ever
emits an exit by flipping to the opposite signal — there's no protection
against a position drifting against you between flips. This wrapper tracks
its own entry price per symbol and forces a flat/exit signal the moment
price breaches stop_loss_pct or take_profit_pct, independent of what the
wrapped strategy would otherwise say on that bar.

Approximate by design: it infers "am I in a position" from the signals it
has itself emitted, not from confirmed fills — a signal it emits can still
be rejected by RiskEngine, in which case this wrapper's internal state goes
briefly out of sync with the real position (a bit) until it re-evaluates.
Fine for backtest/paper use; a live-trading version should be told the real
fill outcome each bar instead of inferring it.
"""
from __future__ import annotations

from app.backtest.engine import Bar
from app.models.trading import Signal, SignalDirection


class StopLossTakeProfitWrapper:
    def __init__(
        self,
        inner,
        stop_loss_pct: float = 0.05,
        take_profit_pct: float = 0.10,
        model_name: str = "risk_managed",
    ):
        if stop_loss_pct <= 0 or take_profit_pct <= 0:
            raise ValueError("stop_loss_pct and take_profit_pct must both be positive fractions")
        self.inner = inner
        self.stop_loss_pct = stop_loss_pct
        self.take_profit_pct = take_profit_pct
        self.model_name = model_name
        self._entry_price: dict[str, float] = {}
        self._position: dict[str, SignalDirection] = {}

    def __call__(self, symbol: str, bars: list[Bar]) -> Signal | None:
        bar = bars[-1]
        price = bar.close
        pos = self._position.get(symbol, SignalDirection.FLAT)
        entry = self._entry_price.get(symbol)

        if pos != SignalDirection.FLAT and entry:
            direction_sign = 1 if pos == SignalDirection.LONG else -1
            change = direction_sign * (price - entry) / entry
            if change <= -self.stop_loss_pct:
                return self._exit(symbol, bar, "stop_loss")
            if change >= self.take_profit_pct:
                return self._exit(symbol, bar, "take_profit")

        signal = self.inner(symbol, bars)
        if signal is None:
            return None

        if signal.direction == SignalDirection.LONG:
            if pos != SignalDirection.LONG:
                self._position[symbol] = SignalDirection.LONG
                self._entry_price[symbol] = price
        elif signal.direction == SignalDirection.SHORT:
            if pos == SignalDirection.LONG:
                # Treat the inner strategy's SHORT as "exit the long" —
                # this wrapper is spot-only aware; see strategy.md.
                self._position[symbol] = SignalDirection.FLAT
                self._entry_price.pop(symbol, None)
            else:
                self._position[symbol] = SignalDirection.SHORT
                self._entry_price[symbol] = price

        return signal

    def _exit(self, symbol: str, bar: Bar, reason: str) -> Signal:
        exiting = self._position[symbol]
        self._position[symbol] = SignalDirection.FLAT
        self._entry_price.pop(symbol, None)
        # confidence=0.0 makes the engine/scheduler's target notional exactly
        # zero (equity * max_position_pct * confidence), which nets the
        # position fully flat regardless of which direction label we use —
        # NOT a flip into an opposite position of the same size. Direction is
        # kept only for audit-log readability.
        exit_direction = SignalDirection.SHORT if exiting == SignalDirection.LONG else SignalDirection.LONG
        return Signal(
            symbol=symbol,
            ts=bar.ts,
            direction=exit_direction,
            confidence=0.0,
            model_name=f"{self.model_name}:{reason}",
        )
