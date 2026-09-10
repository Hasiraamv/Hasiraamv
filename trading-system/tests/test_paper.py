"""Tests for the paper-trading loop: live-data fetch (mocked ccxt), signal
generation, the risk-engine gate, simulated fills with fees/slippage, and
that every decision gets logged. No network access; testnet-only guard is
also verified directly.
"""
from __future__ import annotations

import sys
import types
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from app.backtest.engine import Bar
from app.config import Settings
from app.execution.broker import SimulatedBroker, TestnetBroker
from app.models.trading import Signal, SignalDirection
from app.paper.scheduler import PaperTradingLoop


def _settings(**overrides) -> Settings:
    defaults = {"max_position_pct": 0.5, "max_order_notional": 1_000_000.0, "max_leverage": 1.0}
    defaults.update(overrides)
    return Settings(**defaults)


def _bar(ts: datetime, price: float = 50_000.0) -> Bar:
    return Bar(symbol="BTC/USDT", ts=ts, open=price, high=price, low=price, close=price, volume=1.0)


def _long_signal(symbol: str, bars) -> Signal:
    return Signal(symbol=symbol, ts=bars[-1].ts, direction=SignalDirection.LONG, confidence=1.0, model_name="test")


def _flat_signal(symbol: str, bars) -> Signal | None:
    return None


# =========================================================================
# Testnet-only enforcement
# =========================================================================


def test_defaults_to_simulated_broker_with_no_exchange_keys():
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=_settings())
    assert isinstance(loop.broker, SimulatedBroker)


def test_refuses_to_build_broker_against_live_endpoint():
    """EXCHANGE_API_KEY set but EXCHANGE_TESTNET false must fail loudly, not
    silently fall back to simulation or (worse) hit a live endpoint."""
    settings = _settings(exchange_api_key="fake-key", exchange_api_secret="fake-secret", exchange_testnet=False)
    with pytest.raises(RuntimeError, match="testnet-only"):
        PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=settings)


def test_builds_testnet_broker_when_keys_and_testnet_flag_present(tmp_path):
    settings = _settings(exchange_api_key="fake-key", exchange_api_secret="fake-secret", exchange_testnet=True)

    fake_exchange = MagicMock()
    fake_exchange_class = MagicMock(return_value=fake_exchange)
    fake_ccxt_module = types.SimpleNamespace(binance=fake_exchange_class)

    with patch.dict(sys.modules, {"ccxt": fake_ccxt_module}):
        loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=settings)

    assert isinstance(loop.broker, TestnetBroker)
    fake_exchange.set_sandbox_mode.assert_called_once_with(True)


# =========================================================================
# fetch_latest_bar — live data via mocked ccxt REST
# =========================================================================


@pytest.mark.asyncio
async def test_fetch_latest_bar_normalizes_live_ticker(tmp_path):
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=settings)

    fake_exchange = MagicMock()
    fake_exchange.fetch_ohlcv.return_value = [[1_700_000_000_000, 100.0, 101.0, 99.0, 100.5, 10.0]]
    fake_exchange_class = MagicMock(return_value=fake_exchange)
    fake_ccxt_module = types.SimpleNamespace(binance=fake_exchange_class)

    with patch.dict(sys.modules, {"ccxt": fake_ccxt_module}):
        bar = await loop.fetch_latest_bar("BTC/USDT")

    assert bar.close == 100.5
    assert bar.symbol == "BTC/USDT"
    fake_exchange.fetch_ohlcv.assert_called_once_with("BTC/USDT", timeframe="1m", limit=1)


# =========================================================================
# process_bar — signal -> risk engine -> simulated fill, with logging
# =========================================================================


def test_approved_signal_goes_through_risk_engine_and_fills_with_fees_and_slippage():
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_long_signal, settings=settings)

    logged = []
    with patch("app.paper.scheduler.log_decision", side_effect=lambda **kw: logged.append(kw)):
        loop.process_bar("BTC/USDT", _bar(datetime(2024, 1, 1, tzinfo=UTC)))

    assert loop.positions["BTC/USDT"] > 0  # filled: a long position was opened
    assert loop.equity < 100_000.0  # fee was deducted

    kinds = [entry["kind"] for entry in logged]
    assert "signal" in kinds
    assert "order" in kinds
    order_entries = [e for e in logged if e["kind"] == "order"]
    assert order_entries[-1]["outcome"] == "filled"
    assert "slippage_bps" in order_entries[-1]["payload"]
    assert "fee" in order_entries[-1]["payload"]


def test_rejected_signal_never_touches_broker_and_logs_rejection():
    """An order that the risk engine vetoes must not reach the broker at
    all — position/equity stay untouched, and the rejection is logged."""
    tight_settings = _settings(max_order_notional=1.0)  # nothing can ever clear this
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_long_signal, settings=tight_settings)
    loop.broker = MagicMock()  # any call to this is a bug

    logged = []
    with patch("app.paper.scheduler.log_decision", side_effect=lambda **kw: logged.append(kw)):
        loop.process_bar("BTC/USDT", _bar(datetime(2024, 1, 1, tzinfo=UTC)))

    loop.broker.execute.assert_not_called()
    assert loop.positions["BTC/USDT"] == 0.0
    assert loop.equity == 100_000.0

    order_entries = [e for e in logged if e["kind"] == "order"]
    assert order_entries[-1]["outcome"] == "rejected"
    assert order_entries[-1]["payload"]["reasons"]


def test_flat_signal_does_nothing():
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=settings)
    loop.broker = MagicMock()

    loop.process_bar("BTC/USDT", _bar(datetime(2024, 1, 1, tzinfo=UTC)))

    loop.broker.execute.assert_not_called()
    assert loop.positions["BTC/USDT"] == 0.0
    assert loop.equity == 100_000.0


def test_risk_engine_is_the_only_approval_path():
    """process_bar must call RiskEngine.approve (not bypass it) before ever
    touching the broker."""
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_long_signal, settings=settings)

    with patch.object(loop.risk_engine, "approve", wraps=loop.risk_engine.approve) as spy_approve:
        loop.process_bar("BTC/USDT", _bar(datetime(2024, 1, 1, tzinfo=UTC)))

    spy_approve.assert_called_once()


# =========================================================================
# run_forever — bounded loop, drives fetch + process each poll
# =========================================================================


@pytest.mark.asyncio
async def test_run_forever_polls_every_symbol_each_round():
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT", "ETH/USDT"], strategy=_flat_signal, settings=settings, poll_interval_seconds=0.0)

    fetched = []

    async def fake_fetch(symbol):
        fetched.append(symbol)
        return _bar(datetime(2024, 1, 1, tzinfo=UTC))

    with patch.object(loop, "fetch_latest_bar", side_effect=fake_fetch):
        await loop.run_forever(max_iterations=2)

    assert fetched == ["BTC/USDT", "ETH/USDT", "BTC/USDT", "ETH/USDT"]
    assert loop._running is False


@pytest.mark.asyncio
async def test_run_forever_survives_a_fetch_error_and_continues():
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=settings, poll_interval_seconds=0.0)

    calls = {"n": 0}

    async def flaky_fetch(symbol):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("network blip")
        return _bar(datetime(2024, 1, 1, tzinfo=UTC))

    with patch.object(loop, "fetch_latest_bar", side_effect=flaky_fetch):
        await loop.run_forever(max_iterations=2)

    assert calls["n"] == 2  # the loop kept going after the first failure


def test_stop_halts_the_loop():
    settings = _settings()
    loop = PaperTradingLoop(symbols=["BTC/USDT"], strategy=_flat_signal, settings=settings)
    loop._running = True
    loop.stop()
    assert loop._running is False
