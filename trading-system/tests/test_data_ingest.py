"""Data layer tests, all with mocked CCXT (REST) / mocked ccxt.pro (WS) —
no network access. Covers OHLCV, trades, funding/open-interest, Postgres +
Parquet persistence, and reconnect/backoff on both REST pagination and WS
streaming.
"""
from __future__ import annotations

import sys
import types
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from app.config import Settings
from app.data.ingest import CCXTIngestor
from app.data.storage import ParquetStore


def _settings(tmp_path, **overrides) -> Settings:
    defaults = {
        "parquet_dir": tmp_path / "parquet",
        "database_url": f"sqlite:///{tmp_path / 'test.db'}",
        "exchange_id": "binance",
        "exchange_testnet": True,
    }
    defaults.update(overrides)
    return Settings(**defaults)


def _ohlcv_row(ts_ms: int, price: float = 50_000.0) -> list[float]:
    return [ts_ms, price, price * 1.01, price * 0.99, price, 10.0]


# =========================================================================
# Exchange construction — rate limiting + sandbox mode
# =========================================================================


def test_exchange_constructed_with_rate_limit_and_sandbox(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)

    fake_exchange_class = MagicMock()
    fake_ccxt_module = types.SimpleNamespace(binance=fake_exchange_class)

    with patch.dict(sys.modules, {"ccxt": fake_ccxt_module}):
        ingestor._get_exchange()

    (config,), _kwargs = fake_exchange_class.call_args
    assert config["enableRateLimit"] is True
    fake_exchange_class.return_value.set_sandbox_mode.assert_called_once_with(True)


# =========================================================================
# OHLCV
# =========================================================================


def test_fetch_ohlcv_batch_normalizes_rows(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_ohlcv.return_value = [_ohlcv_row(1_700_000_000_000)]
    ingestor._exchange = fake_exchange

    rows = ingestor.fetch_ohlcv_batch("BTC/USDT", timeframe="1h")

    assert len(rows) == 1
    assert rows[0]["symbol"] == "BTC/USDT"
    assert rows[0]["exchange"] == "binance"
    assert rows[0]["close"] == 50_000.0
    assert isinstance(rows[0]["ts"], datetime)


def test_backfill_ohlcv_reconnects_with_backoff_then_succeeds(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings, max_backoff_seconds=5.0)
    fake_exchange = MagicMock()
    fake_exchange.fetch_ohlcv.side_effect = [
        RuntimeError("connection reset"),
        [_ohlcv_row(1_700_000_000_000)],
        [],  # signals "no more data"
    ]
    ingestor._exchange = fake_exchange

    with patch("time.sleep") as mock_sleep:
        written = ingestor.backfill_ohlcv("BTC/USDT", "1h", since_ms=1_700_000_000_000)

    assert written == 1
    mock_sleep.assert_called_once()  # backed off exactly once, after the transient failure


def test_backfill_ohlcv_persists_to_parquet_and_sqlite(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_ohlcv.side_effect = [[_ohlcv_row(1_700_000_000_000)], []]
    ingestor._exchange = fake_exchange

    written = ingestor.backfill_ohlcv("BTC/USDT", "1h", since_ms=1_700_000_000_000)
    assert written == 1

    store = ParquetStore(settings.parquet_dir)
    df = store.read_ohlcv("binance", "BTC/USDT", "1h")
    assert len(df) == 1

    from sqlmodel import Session, create_engine, select

    from app.models.market import OHLCVBar

    engine = create_engine(settings.database_url)
    with Session(engine) as session:
        bars = session.exec(select(OHLCVBar)).all()
    assert len(bars) == 1
    assert bars[0].symbol == "BTC/USDT"


def test_backfill_ohlcv_enforces_until_ms_even_when_exchange_ignores_it(tmp_path):
    """Some exchanges (Kraken's OHLC endpoint included) ignore any upper bound
    and just return up to `limit` bars forward from `since` — until_ms must be
    enforced on the returned rows, not just used to decide whether to keep
    paginating, or a bounded range silently ingests everything up to 'now'."""
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    # a single page spanning far beyond the requested until_ms
    fake_exchange.fetch_ohlcv.return_value = [
        _ohlcv_row(1_700_000_000_000),  # in range
        _ohlcv_row(1_700_086_400_000),  # in range (1 day later)
        _ohlcv_row(1_700_172_800_000),  # OUT of range (2 days later)
        _ohlcv_row(1_700_259_200_000),  # OUT of range (3 days later)
    ]
    ingestor._exchange = fake_exchange

    until_ms = 1_700_100_000_000  # cuts off between the 2nd and 3rd row
    written = ingestor.backfill_ohlcv("BTC/USDT", "1h", since_ms=1_700_000_000_000, until_ms=until_ms)

    assert written == 2  # only the two in-range rows were persisted

    store = ParquetStore(settings.parquet_dir)
    df = store.read_ohlcv("binance", "BTC/USDT", "1h")
    assert len(df) == 2
    assert df["ts"].max().timestamp() * 1000 <= until_ms


# =========================================================================
# Trades
# =========================================================================


def test_fetch_trades_batch_normalizes_rows(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_trades.return_value = [
        {"timestamp": 1_700_000_000_000, "price": 50_000.0, "amount": 0.5, "side": "buy"},
    ]
    ingestor._exchange = fake_exchange

    rows = ingestor.fetch_trades_batch("BTC/USDT")

    assert rows == [
        {
            "exchange": "binance",
            "symbol": "BTC/USDT",
            "ts": datetime.fromtimestamp(1_700_000_000_000 / 1000, tz=UTC),
            "price": 50_000.0,
            "amount": 0.5,
            "side": "buy",
        }
    ]


def test_backfill_trades_paginates_until_no_more_rows(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_trades.side_effect = [
        [{"timestamp": 1_700_000_030_000, "price": 50_000.0, "amount": 1.0, "side": "buy"}],
        [{"timestamp": 1_700_000_060_000, "price": 50_010.0, "amount": 2.0, "side": "sell"}],
        [],
    ]
    ingestor._exchange = fake_exchange

    written = ingestor.backfill_trades("BTC/USDT", since_ms=1_700_000_000_000)

    assert written == 2
    assert fake_exchange.fetch_trades.call_count == 3

    store = ParquetStore(settings.parquet_dir)
    df = store.read_trades("binance", "BTC/USDT")
    assert len(df) == 2


# =========================================================================
# Funding + open interest
# =========================================================================


def test_fetch_funding_and_oi_combines_both_fields(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_funding_rate.return_value = {"fundingRate": 0.0001}
    fake_exchange.fetch_open_interest.return_value = {"openInterestAmount": 12345.6}
    ingestor._exchange = fake_exchange

    row = ingestor.fetch_funding_and_oi("BTC/USDT")

    assert row["funding_rate"] == 0.0001
    assert row["open_interest"] == 12345.6
    assert row["symbol"] == "BTC/USDT"


def test_fetch_funding_and_oi_degrades_gracefully_when_oi_unsupported(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_funding_rate.return_value = {"fundingRate": 0.0002}
    fake_exchange.fetch_open_interest.side_effect = RuntimeError("not supported for this market")
    ingestor._exchange = fake_exchange

    row = ingestor.fetch_funding_and_oi("BTC/USDT")

    assert row["funding_rate"] == 0.0002
    assert row["open_interest"] is None


def test_fetch_funding_and_oi_returns_none_when_neither_available(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_funding_rate.side_effect = RuntimeError("spot market has no funding")
    fake_exchange.fetch_open_interest.side_effect = RuntimeError("spot market has no OI")
    ingestor._exchange = fake_exchange

    assert ingestor.fetch_funding_and_oi("BTC/USDT") is None


def test_backfill_funding_history_paginates(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)
    fake_exchange = MagicMock()
    fake_exchange.fetch_funding_rate_history.side_effect = [
        [{"timestamp": 1_700_000_000_000, "fundingRate": 0.0001}],
        [],
    ]
    ingestor._exchange = fake_exchange

    written = ingestor.backfill_funding("BTC/USDT", since_ms=1_700_000_000_000)
    assert written == 1


@pytest.mark.asyncio
async def test_poll_funding_and_oi_forever_persists_and_backs_off(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings, max_backoff_seconds=5.0)
    fake_exchange = MagicMock()
    fake_exchange.fetch_funding_rate.side_effect = [
        RuntimeError("network blip"),
        {"fundingRate": 0.0003},
    ]
    fake_exchange.fetch_open_interest.return_value = {"openInterestAmount": 999.0}
    ingestor._exchange = fake_exchange

    # force fetch_funding_and_oi itself to raise on the first call by making
    # both underlying calls fail together, then succeed on the second pass
    with patch.object(
        ingestor,
        "fetch_funding_and_oi",
        side_effect=[RuntimeError("transient"), {"exchange": "binance", "symbol": "BTC/USDT", "ts": datetime.now(UTC), "funding_rate": 0.0003, "open_interest": 999.0}],
    ), patch("asyncio.sleep") as mock_sleep:
        await ingestor.poll_funding_and_oi_forever("BTC/USDT", interval_seconds=60.0, max_iterations=1)

    mock_sleep.assert_any_call(1.0)  # backoff after the transient failure

    store = ParquetStore(settings.parquet_dir)
    df = store.read_funding("binance", "BTC/USDT")
    assert len(df) == 1


# =========================================================================
# WS streaming (ccxt.pro) — reconnect + backoff
# =========================================================================


def _install_fake_ccxtpro(fake_exchange) -> types.SimpleNamespace:
    fake_exchange_class = MagicMock(return_value=fake_exchange)
    fake_module = types.SimpleNamespace(binance=fake_exchange_class)
    return fake_module


@pytest.mark.asyncio
async def test_stream_ohlcv_ws_reconnects_after_error(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings, max_backoff_seconds=5.0)

    fake_exchange = MagicMock()
    fake_exchange.watch_ohlcv = MagicMock(
        side_effect=[RuntimeError("ws dropped"), _future([_ohlcv_row(1_700_000_000_000)])]
    )
    fake_exchange.close = MagicMock(return_value=_future(None))
    fake_module = _install_fake_ccxtpro(fake_exchange)

    with patch.dict(sys.modules, {"ccxtpro": fake_module}), patch("asyncio.sleep", return_value=_future(None)) as mock_sleep:
        bars = [bar async for bar in ingestor.stream_ohlcv_ws("BTC/USDT", "1m", max_iterations=1)]

    assert len(bars) == 1
    assert bars[0]["close"] == 50_000.0
    mock_sleep.assert_called_once()


@pytest.mark.asyncio
async def test_stream_trades_ws_reconnects_after_error(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings, max_backoff_seconds=5.0)

    trade_batch = [{"timestamp": 1_700_000_000_000, "price": 50_000.0, "amount": 1.0, "side": "buy"}]
    fake_exchange = MagicMock()
    fake_exchange.watch_trades = MagicMock(side_effect=[RuntimeError("ws dropped"), _future(trade_batch)])
    fake_exchange.close = MagicMock(return_value=_future(None))
    fake_module = _install_fake_ccxtpro(fake_exchange)

    with patch.dict(sys.modules, {"ccxtpro": fake_module}), patch("asyncio.sleep", return_value=_future(None)) as mock_sleep:
        rows = [row async for row in ingestor.stream_trades_ws("BTC/USDT", max_iterations=1)]

    assert len(rows) == 1
    assert rows[0]["price"] == 50_000.0
    mock_sleep.assert_called_once()


@pytest.mark.asyncio
async def test_stream_ohlcv_ws_returns_nothing_when_ccxtpro_missing(tmp_path):
    settings = _settings(tmp_path)
    ingestor = CCXTIngestor(settings=settings)

    with patch.dict(sys.modules, {"ccxtpro": None}):
        bars = [bar async for bar in ingestor.stream_ohlcv_ws("BTC/USDT", "1m", max_iterations=1)]

    assert bars == []


def _future(result):
    fut = asyncio_future()
    fut.set_result(result)
    return fut


def asyncio_future():
    import asyncio

    loop = asyncio.get_event_loop()
    return loop.create_future()


# =========================================================================
# Orchestration
# =========================================================================


@pytest.mark.asyncio
async def test_run_universe_starts_a_task_per_symbol_per_stream(tmp_path):
    settings = _settings(tmp_path, symbols=["BTC/USDT", "ETH/USDT"])
    ingestor = CCXTIngestor(settings=settings)

    calls = []

    async def fake_drain(agen):
        calls.append("drain")

    async def fake_poll(symbol, interval_seconds, max_iterations=None):
        calls.append(f"poll:{symbol}")

    with patch.object(ingestor, "_drain", side_effect=fake_drain), patch.object(
        ingestor, "poll_funding_and_oi_forever", side_effect=fake_poll
    ):
        await ingestor.run_universe()

    assert calls.count("drain") == 4  # ohlcv + trades, per symbol, for 2 symbols
    assert "poll:BTC/USDT" in calls
    assert "poll:ETH/USDT" in calls


# =========================================================================
# ParquetStore round-trips (real polars, no mocking needed)
# =========================================================================


def test_parquet_store_trades_roundtrip(tmp_path):
    store = ParquetStore(tmp_path / "parquet")
    rows = [
        {"exchange": "binance", "symbol": "BTC/USDT", "ts": datetime(2024, 1, 1, tzinfo=UTC), "price": 1.0, "amount": 1.0, "side": "buy"},
        {"exchange": "binance", "symbol": "BTC/USDT", "ts": datetime(2024, 1, 1, 0, 1, tzinfo=UTC), "price": 2.0, "amount": 2.0, "side": "sell"},
    ]
    store.write_trades("binance", "BTC/USDT", rows)
    df = store.read_trades("binance", "BTC/USDT")
    assert len(df) == 2


def test_parquet_store_funding_roundtrip_dedupes_on_rewrite(tmp_path):
    store = ParquetStore(tmp_path / "parquet")
    row = {
        "exchange": "binance",
        "symbol": "BTC/USDT",
        "ts": datetime(2024, 1, 1, tzinfo=UTC),
        "funding_rate": 0.0001,
        "open_interest": 100.0,
    }
    store.write_funding("binance", "BTC/USDT", [row])
    store.write_funding("binance", "BTC/USDT", [row])  # duplicate write
    df = store.read_funding("binance", "BTC/USDT")
    assert len(df) == 1
