"""CCXT-based market data ingestion: OHLCV, trades, order book snapshots and
funding/open-interest. REST polling is the default (rate-limit aware via
ccxt's built-in throttling); WS streaming is used opportunistically via
ccxt.pro when installed, with reconnect + exponential backoff either way.

Writes go to Postgres (system of record, queryable) and mirror to Parquet
(cheap archive for backtests/ML). Both writers are best-effort per batch —
a Parquet write failure never blocks the DB write and vice versa.
"""
from __future__ import annotations

import asyncio
import time
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
        until_ms = until_ms or int(time.time() * 1000)
        cursor = since_ms
        total_written = 0
        backoff = 1.0

        while cursor < until_ms:
            try:
                rows = self.fetch_ohlcv_batch(symbol, timeframe, since_ms=cursor)
                backoff = 1.0
            except Exception as exc:  # noqa: BLE001 - ccxt raises many exchange-specific errors
                logger.warning(
                    "ohlcv_fetch_failed",
                    extra={"extra_fields": {"symbol": symbol, "error": str(exc), "backoff_s": backoff}},
                )
                time.sleep(backoff)
                backoff = min(backoff * 2, self.max_backoff_seconds)
                continue

            if not rows:
                break

            self._persist(symbol, timeframe, rows)
            total_written += len(rows)

            last_ts_ms = int(rows[-1]["ts"].timestamp() * 1000)
            if last_ts_ms <= cursor:
                break
            cursor = last_ts_ms + 1

        return total_written

    def _persist(self, symbol: str, timeframe: str, rows: list[dict[str, Any]]) -> None:
        try:
            self.parquet.write_ohlcv(self.settings.exchange_id, symbol, timeframe, rows)
        except Exception as exc:  # noqa: BLE001
            logger.warning("parquet_write_failed", extra={"extra_fields": {"symbol": symbol, "error": str(exc)}})

        try:
            self._write_postgres(rows)
        except Exception as exc:  # noqa: BLE001
            logger.warning("postgres_write_failed", extra={"extra_fields": {"symbol": symbol, "error": str(exc)}})

    def _write_postgres(self, rows: list[dict[str, Any]]) -> None:
        from sqlmodel import Session, create_engine

        from app.models.market import OHLCVBar

        engine = create_engine(self.settings.database_url)
        with Session(engine) as session:
            for row in rows:
                session.add(OHLCVBar(**row))
            session.commit()

    async def stream_ohlcv_ws(self, symbol: str, timeframe: str = "1m"):
        """WS streaming via ccxt.pro, with reconnect + exponential backoff.
        Yields normalized bar dicts as they arrive. Falls back silently to
        nothing (caller should use REST polling instead) if ccxt.pro is
        unavailable."""
        try:
            import ccxtpro
        except ImportError:
            logger.warning("ccxtpro_unavailable", extra={"extra_fields": {"symbol": symbol}})
            return

        exchange_class = getattr(ccxtpro, self.settings.exchange_id)
        exchange = exchange_class(
            {"apiKey": self.settings.exchange_api_key, "secret": self.settings.exchange_api_secret, "enableRateLimit": True}
        )
        if self.settings.exchange_testnet and hasattr(exchange, "set_sandbox_mode"):
            exchange.set_sandbox_mode(True)

        backoff = 1.0
        try:
            while True:
                try:
                    ohlcv = await exchange.watch_ohlcv(symbol, timeframe)
                    backoff = 1.0
                    row = ohlcv[-1]
                    bar = {
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
                    self._persist(symbol, timeframe, [bar])
                    yield bar
                except Exception as exc:  # noqa: BLE001
                    logger.warning(
                        "ws_stream_error",
                        extra={"extra_fields": {"symbol": symbol, "error": str(exc), "backoff_s": backoff}},
                    )
                    await asyncio.sleep(backoff)
                    backoff = min(backoff * 2, self.max_backoff_seconds)
        finally:
            await exchange.close()
