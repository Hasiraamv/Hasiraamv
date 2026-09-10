"""Parquet mirror of ingested market data, partitioned by symbol/timeframe/date.
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

    def write_ohlcv(self, exchange: str, symbol: str, timeframe: str, rows: list[dict[str, Any]]) -> Path:
        import polars as pl

        if not rows:
            raise ValueError("no rows to write")
        df = pl.DataFrame(rows)
        out_dir = self._path("ohlcv", exchange, symbol, timeframe)
        first_ts = rows[0]["ts"]
        date_str = first_ts.date().isoformat() if hasattr(first_ts, "date") else str(first_ts)[:10]
        out_file = out_dir / f"{date_str}.parquet"
        if out_file.exists():
            existing = pl.read_parquet(out_file)
            df = pl.concat([existing, df]).unique(subset=["ts"]).sort("ts")
        df.write_parquet(out_file)
        return out_file

    def read_ohlcv(self, exchange: str, symbol: str, timeframe: str):
        import polars as pl

        out_dir = self._path("ohlcv", exchange, symbol, timeframe)
        files = sorted(out_dir.glob("*.parquet"))
        if not files:
            return pl.DataFrame()
        return pl.concat([pl.read_parquet(f) for f in files]).sort("ts")
