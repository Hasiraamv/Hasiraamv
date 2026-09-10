"""CCXT-based market data ingestion: OHLCV, trades, and funding/open-interest
for the configured symbol universe (BTC/USDT, ETH/USDT by default).

REST polling is rate-limit aware via ccxt's built-in throttling
(`enableRateLimit: True`); WS streaming is used via ccxt.pro when installed.
Every network path — REST pagination and WS streaming alike — reconnects
with exponential backoff on failure rather than raising and dying.

Writes go to Postgres (system of record, queryable) and mirror to Parquet
(cheap archive for backtests/ML). Both writers are best-effort per batch —
a Parquet write failure never blocks the DB write and vice versa.
"""
from __future__ import annotations

import asyncio
import time
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

from app.config import Settings, get_settings
from app.data.storage import ParquetStore
from app.monitoring.logging_config import get_logger

logger = get_logger(__name__)


class CCXTIngestor:
    def __init__(self, settings: Settings | None = None, max_backoff_seconds: float = 60.0):
        self.settings = settings or get_settings()
        self.parquet = ParquetStore(self.settings.parquet_dir)
        self.max_backoff_seconds = max_backoff_seconds
        self._exchange = None

    def _get_exchange(self):
        if self._exchange is None:
            import ccxt

            exchange_class = getattr(ccxt, self.settings.exchange_id)
            self._exchange = exchange_class(
                {
                    "apiKey": self.settings.exchange_api_key,
                    "secret": self.settings.exchange_api_secret,
                    "enableRateLimit": True,
                }
            )
            if self.settings.exchange_testnet and hasattr(self._exchange, "set_sandbox_mode"):
                self._exchange.set_sandbox_mode(True)
        return self._exchange

    # =========================================================================
    # OHLCV
    # =========================================================================

    def fetch_ohlcv_batch(
        self, symbol: str, timeframe: str = "1h", since_ms: int | None = None, limit: int = 1000
    ) -> list[dict[str, Any]]:
        exchange = self._get_exchange()
        raw = exchange.fetch_ohlcv(symbol, timeframe=timeframe, since=since_ms, limit=limit)
        return [
            {
                "exchange": self.settings.exchange_id,
                "symbol": symbol,
                "timeframe": timeframe,
                "ts": datetime.fromtimestamp(row[0] / 1000, tz=UTC),
                "open": row[1],
                "high": row[2],
                "low": row[3],
                "close": row[4],
                "volume": row[5],
            }
            for row in raw
        ]

    def backfill_ohlcv(self, symbol: str, timeframe: str, since_ms: int, until_ms: int | None = None) -> int:
        """Paginated REST backfill with reconnect + exponential backoff.
        Returns the number of bars written."""
        return self._backfill_paginated(
            fetch_batch=lambda cursor: self.fetch_ohlcv_batch(symbol, timeframe, since_ms=cursor),
            persist=lambda rows: self._persist_ohlcv(symbol, timeframe, rows),
            since_ms=since_ms,
            until_ms=until_ms,
            log_context={"symbol": symbol, "timeframe": timeframe, "kind": "ohlcv"},
        )

    async def stream_ohlcv_ws(
        self, symbol: str, timeframe: str = "1m", max_iterations: int | None = None
    ) -> AsyncIterator[dict[str, Any]]:
        """WS streaming via ccxt.pro, with reconnect + exponential backoff.
        Yields normalized bar dicts as they arrive. Falls back silently to
        nothing (caller should use REST polling instead) if ccxt.pro is
        unavailable. `max_iterations` bounds the loop for tests; production
        callers leave it as None (runs forever)."""

        def _normalize(ohlcv: list[list[float]]) -> dict[str, Any]:
            row = ohlcv[-1]
            return {
                "exchange": self.settings.exchange_id,
                "symbol": symbol,
                "timeframe": timeframe,
                "ts": datetime.fromtimestamp(row[0] / 1000, tz=UTC),
                "open": row[1],
                "high": row[2],
                "low": row[3],
                "close": row[4],
                "volume": row[5],
            }

        async for bar in self._stream_ws(
            watch_method="watch_ohlcv",
            watch_args=(symbol, timeframe),
            normalize=_normalize,
            persist=lambda row: self._persist_ohlcv(symbol, timeframe, [row]),
            max_iterations=max_iterations,
            log_context={"symbol": symbol, "timeframe": timeframe, "kind": "ohlcv_ws"},
        ):
            yield bar

    # =========================================================================
    # Trades
    # =========================================================================

    def fetch_trades_batch(self, symbol: str, since_ms: int | None = None, limit: int = 1000) -> list[dict[str, Any]]:
        exchange = self._get_exchange()
        raw = exchange.fetch_trades(symbol, since=since_ms, limit=limit)
        return [
            {
                "exchange": self.settings.exchange_id,
                "symbol": symbol,
                "ts": datetime.fromtimestamp(t["timestamp"] / 1000, tz=UTC),
                "price": float(t["price"]),
                "amount": float(t["amount"]),
                "side": t.get("side") or "unknown",
            }
            for t in raw
        ]

    def backfill_trades(self, symbol: str, since_ms: int, until_ms: int | None = None) -> int:
        """Paginated REST backfill of raw trades, with reconnect + backoff."""
        return self._backfill_paginated(
            fetch_batch=lambda cursor: self.fetch_trades_batch(symbol, since_ms=cursor),
            persist=lambda rows: self._persist_trades(symbol, rows),
            since_ms=since_ms,
            until_ms=until_ms,
            log_context={"symbol": symbol, "kind": "trades"},
        )

    async def stream_trades_ws(self, symbol: str, max_iterations: int | None = None) -> AsyncIterator[dict[str, Any]]:
        """WS trade tape via ccxt.pro, reconnect + exponential backoff."""

        def _normalize(trades: list[dict[str, Any]]) -> list[dict[str, Any]]:
            return [
                {
                    "exchange": self.settings.exchange_id,
                    "symbol": symbol,
                    "ts": datetime.fromtimestamp(t["timestamp"] / 1000, tz=UTC),
                    "price": float(t["price"]),
                    "amount": float(t["amount"]),
                    "side": t.get("side") or "unknown",
                }
                for t in trades
            ]

        async for row in self._stream_ws_batch(
            watch_method="watch_trades",
            watch_args=(symbol,),
            normalize=_normalize,
            persist=lambda rows: self._persist_trades(symbol, rows),
            max_iterations=max_iterations,
            log_context={"symbol": symbol, "kind": "trades_ws"},
        ):
            yield row

    # =========================================================================
    # Funding rate + open interest
    # =========================================================================

    def fetch_funding_and_oi(self, symbol: str) -> dict[str, Any] | None:
        """Current-snapshot funding rate + open interest. Each field is fetched
        independently and gracefully degrades (e.g. a spot symbol with no
        funding market, or an exchange lacking one of the two endpoints) —
        returns None only if neither field is available."""
        exchange = self._get_exchange()
        funding_rate: float | None = None
        open_interest: float | None = None

        try:
            fr = exchange.fetch_funding_rate(symbol)
            funding_rate = float(fr["fundingRate"]) if fr.get("fundingRate") is not None else None
        except Exception as exc:  # noqa: BLE001 - unsupported market/method varies by exchange
            logger.info("funding_rate_unavailable", extra={"extra_fields": {"symbol": symbol, "error": str(exc)}})

        try:
            oi = exchange.fetch_open_interest(symbol)
            open_interest = float(
                oi.get("openInterestAmount") or oi.get("openInterestValue") or oi.get("openInterest") or 0.0
            ) or None
        except Exception as exc:  # noqa: BLE001
            logger.info("open_interest_unavailable", extra={"extra_fields": {"symbol": symbol, "error": str(exc)}})

        if funding_rate is None and open_interest is None:
            return None

        return {
            "exchange": self.settings.exchange_id,
            "symbol": symbol,
            "ts": datetime.now(UTC),
            "funding_rate": funding_rate or 0.0,
            "open_interest": open_interest,
        }

    def fetch_funding_history_batch(
        self, symbol: str, since_ms: int | None = None, limit: int = 1000
    ) -> list[dict[str, Any]]:
        exchange = self._get_exchange()
        raw = exchange.fetch_funding_rate_history(symbol, since=since_ms, limit=limit)
        return [
            {
                "exchange": self.settings.exchange_id,
                "symbol": symbol,
                "ts": datetime.fromtimestamp(f["timestamp"] / 1000, tz=UTC),
                "funding_rate": float(f.get("fundingRate") or 0.0),
                "open_interest": None,
            }
            for f in raw
        ]

    def backfill_funding(self, symbol: str, since_ms: int, until_ms: int | None = None) -> int:
        """Paginated REST backfill of historical funding rates. Open interest
        has no portably unified history endpoint across exchanges in ccxt, so
        OI is only captured going forward via `poll_funding_and_oi_forever`."""
        return self._backfill_paginated(
            fetch_batch=lambda cursor: self.fetch_funding_history_batch(symbol, since_ms=cursor),
            persist=lambda rows: self._persist_funding(symbol, rows),
            since_ms=since_ms,
            until_ms=until_ms,
            log_context={"symbol": symbol, "kind": "funding_history"},
        )

    async def poll_funding_and_oi_forever(
        self, symbol: str, interval_seconds: float = 300.0, max_iterations: int | None = None
    ) -> None:
        """Periodic REST poll for funding/OI (no portable WS stream for these
        across exchanges), with reconnect + exponential backoff on failure."""
        backoff = 1.0
        count = 0
        while max_iterations is None or count < max_iterations:
            try:
                row = self.fetch_funding_and_oi(symbol)
                backoff = 1.0
                if row:
                    self._persist_funding(symbol, [row])
                count += 1
            except Exception as exc:  # noqa: BLE001
                logger.warning(
                    "funding_poll_error",
                    extra={"extra_fields": {"symbol": symbol, "error": str(exc), "backoff_s": backoff}},
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, self.max_backoff_seconds)
                continue
            await asyncio.sleep(interval_seconds)

    # =========================================================================
    # Orchestration
    # =========================================================================

    async def run_universe(
        self, symbols: list[str] | None = None, timeframe: str = "1h", funding_interval_seconds: float = 300.0
    ) -> None:
        """Runs OHLCV + trades WS streams and funding/OI polling concurrently
        for every symbol in the universe (defaults to `settings.symbols`,
        i.e. BTC/USDT and ETH/USDT). Each task reconnects independently, so
        one symbol's WS drop never affects another."""
        symbols = symbols or self.settings.symbols
        tasks = []
        for symbol in symbols:
            tasks.append(self._drain(self.stream_ohlcv_ws(symbol, timeframe)))
            tasks.append(self._drain(self.stream_trades_ws(symbol)))
            tasks.append(self.poll_funding_and_oi_forever(symbol, funding_interval_seconds))
        await asyncio.gather(*tasks)

    @staticmethod
    async def _drain(agen: AsyncIterator[Any]) -> None:
        async for _ in agen:
            pass

    # =========================================================================
    # Shared REST/WS plumbing
    # =========================================================================

    def _backfill_paginated(
        self,
        fetch_batch,
        persist,
        since_ms: int,
        until_ms: int | None,
        log_context: dict[str, Any],
    ) -> int:
        until_ms = until_ms or int(time.time() * 1000)
        cursor = since_ms
        total_written = 0
        backoff = 1.0

        while cursor < until_ms:
            try:
                rows = fetch_batch(cursor)
                backoff = 1.0
            except Exception as exc:  # noqa: BLE001 - ccxt raises many exchange-specific errors
                logger.warning(
                    "rest_fetch_failed",
                    extra={"extra_fields": {**log_context, "error": str(exc), "backoff_s": backoff}},
                )
                time.sleep(backoff)
                backoff = min(backoff * 2, self.max_backoff_seconds)
                continue

            if not rows:
                break

            persist(rows)
            total_written += len(rows)

            last_ts_ms = int(rows[-1]["ts"].timestamp() * 1000)
            if last_ts_ms <= cursor:
                break
            cursor = last_ts_ms + 1

        return total_written

    def _get_ws_exchange(self):
        import ccxtpro

        exchange_class = getattr(ccxtpro, self.settings.exchange_id)
        exchange = exchange_class(
            {
                "apiKey": self.settings.exchange_api_key,
                "secret": self.settings.exchange_api_secret,
                "enableRateLimit": True,
            }
        )
        if self.settings.exchange_testnet and hasattr(exchange, "set_sandbox_mode"):
            exchange.set_sandbox_mode(True)
        return exchange

    async def _stream_ws(
        self,
        watch_method: str,
        watch_args: tuple[Any, ...],
        normalize,
        persist,
        max_iterations: int | None,
        log_context: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """Reconnect-with-backoff wrapper around a single-object ccxt.pro
        `watch_*` call (e.g. watch_ohlcv, which returns one series per call)."""
        try:
            import ccxtpro  # noqa: F401
        except ImportError:
            logger.warning("ccxtpro_unavailable", extra={"extra_fields": log_context})
            return

        exchange = self._get_ws_exchange()
        backoff = 1.0
        count = 0
        try:
            while max_iterations is None or count < max_iterations:
                try:
                    raw = await getattr(exchange, watch_method)(*watch_args)
                    backoff = 1.0
                    row = normalize(raw)
                    persist(row)
                    count += 1
                    yield row
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "ws_stream_error",
                        extra={"extra_fields": {**log_context, "error": str(exc), "backoff_s": backoff}},
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, self.max_backoff_seconds)
        finally:
            await exchange.close()

    async def _stream_ws_batch(
        self,
        watch_method: str,
        watch_args: tuple[Any, ...],
        normalize,
        persist,
        max_iterations: int | None,
        log_context: dict[str, Any],
    ) -> AsyncIterator[dict[str, Any]]:
        """Reconnect-with-backoff wrapper around a ccxt.pro `watch_*` call that
        returns a batch per call (e.g. watch_trades) — yields one row at a time."""
        try:
            import ccxtpro  # noqa: F401
        except ImportError:
            logger.warning("ccxtpro_unavailable", extra={"extra_fields": log_context})
            return

        exchange = self._get_ws_exchange()
        backoff = 1.0
        count = 0
        try:
            while max_iterations is None or count < max_iterations:
                try:
                    raw = await getattr(exchange, watch_method)(*watch_args)
                    backoff = 1.0
                    rows = normalize(raw)
                    if rows:
                        persist(rows)
                    count += 1
                    for row in rows:
                        yield row
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "ws_stream_error",
                        extra={"extra_fields": {**log_context, "error": str(exc), "backoff_s": backoff}},
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, self.max_backoff_seconds)
        finally:
            await exchange.close()

    # --- persistence (Postgres + Parquet, best-effort each) -----------------------

    def _persist_ohlcv(self, symbol: str, timeframe: str, rows: list[dict[str, Any]]) -> None:
        from app.models.market import OHLCVBar

        self._persist("ohlcv", symbol, rows, model_cls=OHLCVBar, parquet_write=lambda: self.parquet.write_ohlcv(
            self.settings.exchange_id, symbol, timeframe, rows
        ))

    def _persist_trades(self, symbol: str, rows: list[dict[str, Any]]) -> None:
        from app.models.market import Trade

        self._persist("trades", symbol, rows, model_cls=Trade, parquet_write=lambda: self.parquet.write_trades(
            self.settings.exchange_id, symbol, rows
        ))

    def _persist_funding(self, symbol: str, rows: list[dict[str, Any]]) -> None:
        from app.models.market import FundingRate

        self._persist("funding", symbol, rows, model_cls=FundingRate, parquet_write=lambda: self.parquet.write_funding(
            self.settings.exchange_id, symbol, rows
        ))

    def _persist(self, kind: str, symbol: str, rows: list[dict[str, Any]], model_cls, parquet_write) -> None:
        try:
            parquet_write()
        except Exception as exc:  # noqa: BLE001
            logger.warning("parquet_write_failed", extra={"extra_fields": {"kind": kind, "symbol": symbol, "error": str(exc)}})

        try:
            self._write_postgres(model_cls, rows)
        except Exception as exc:  # noqa: BLE001
            logger.warning("postgres_write_failed", extra={"extra_fields": {"kind": kind, "symbol": symbol, "error": str(exc)}})

    def _write_postgres(self, model_cls, rows: list[dict[str, Any]]) -> None:
        from sqlmodel import Session, SQLModel, create_engine

        engine = create_engine(self.settings.database_url)
        SQLModel.metadata.create_all(engine, tables=[model_cls.__table__])
        with Session(engine) as session:
            for row in rows:
                session.add(model_cls(**row))
            session.commit()
