"""Parquet mirror of ingested market data, partitioned by symbol/(timeframe)/date.
Postgres/TimescaleDB is the queryable system of record; Parquet is the cheap,
portable archive used by backtests and ML training (via polars/duckdb)."""
from __future__ import annotations

from pathlib import Path
from typing import Any


class ParquetStore:
    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _path(self, kind: str, exchange: str, symbol: str, timeframe: str | None = None) -> Path:
        safe_symbol = symbol.replace("/", "-")
        parts = [kind, exchange, safe_symbol]
        if timeframe:
            parts.append(timeframe)
        path = self.root.joinpath(*parts)
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _write(
        self,
        kind: str,
        exchange: str,
        symbol: str,
        rows: list[dict[str, Any]],
        timeframe: str | None = None,
        dedup_subset: tuple[str, ...] = ("ts",),
    ) -> Path:
        import polars as pl

        if not rows:
            raise ValueError("no rows to write")
        df = pl.DataFrame(rows)
        out_dir = self._path(kind, exchange, symbol, timeframe)
        first_ts = rows[0]["ts"]
        date_str = first_ts.date().isoformat() if hasattr(first_ts, "date") else str(first_ts)[:10]
        out_file = out_dir / f"{date_str}.parquet"
        if out_file.exists():
            existing = pl.read_parquet(out_file)
            df = pl.concat([existing, df]).unique(subset=list(dedup_subset))
        df = df.sort("ts")
        df.write_parquet(out_file)
        return out_file

    def _read(self, kind: str, exchange: str, symbol: str, timeframe: str | None = None):
        import polars as pl

        out_dir = self._path(kind, exchange, symbol, timeframe)
        files = sorted(out_dir.glob("*.parquet"))
        if not files:
            return pl.DataFrame()
        return pl.concat([pl.read_parquet(f) for f in files]).sort("ts")

    # --- OHLCV ------------------------------------------------------------------
    def write_ohlcv(self, exchange: str, symbol: str, timeframe: str, rows: list[dict[str, Any]]) -> Path:
        return self._write("ohlcv", exchange, symbol, rows, timeframe=timeframe)

    def read_ohlcv(self, exchange: str, symbol: str, timeframe: str):
        return self._read("ohlcv", exchange, symbol, timeframe=timeframe)

    # --- trades -------------------------------------------------------------------
    def write_trades(self, exchange: str, symbol: str, rows: list[dict[str, Any]]) -> Path:
        return self._write("trades", exchange, symbol, rows, dedup_subset=("ts", "price", "amount", "side"))

    def read_trades(self, exchange: str, symbol: str):
        return self._read("trades", exchange, symbol)

    # --- funding / open interest ---------------------------------------------------
    def write_funding(self, exchange: str, symbol: str, rows: list[dict[str, Any]]) -> Path:
        return self._write("funding", exchange, symbol, rows)

    def read_funding(self, exchange: str, symbol: str):
        return self._read("funding", exchange, symbol)
