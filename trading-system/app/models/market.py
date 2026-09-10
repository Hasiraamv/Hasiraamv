"""Market data models, persisted to Postgres/TimescaleDB and mirrored to Parquet."""
from __future__ import annotations

from datetime import datetime

from sqlmodel import Field, SQLModel


class OHLCVBar(SQLModel, table=True):
    __tablename__ = "ohlcv_bars"

    id: int | None = Field(default=None, primary_key=True)
    exchange: str = Field(index=True)
    symbol: str = Field(index=True)
    timeframe: str = Field(index=True)
    ts: datetime = Field(index=True, description="Bar open time, UTC")
    open: float
    high: float
    low: float
    close: float
    volume: float


class Trade(SQLModel, table=True):
    __tablename__ = "trades"

    id: int | None = Field(default=None, primary_key=True)
    exchange: str = Field(index=True)
    symbol: str = Field(index=True)
    ts: datetime = Field(index=True)
    price: float
    amount: float
    side: str


class OrderBookSnapshot(SQLModel, table=True):
    __tablename__ = "orderbook_snapshots"

    id: int | None = Field(default=None, primary_key=True)
    exchange: str = Field(index=True)
    symbol: str = Field(index=True)
    ts: datetime = Field(index=True)
    best_bid: float
    best_ask: float
    bid_volume: float
    ask_volume: float
    imbalance: float = Field(description="(bid_volume - ask_volume) / (bid_volume + ask_volume)")


class FundingRate(SQLModel, table=True):
    __tablename__ = "funding_rates"

    id: int | None = Field(default=None, primary_key=True)
    exchange: str = Field(index=True)
    symbol: str = Field(index=True)
    ts: datetime = Field(index=True)
    funding_rate: float
    open_interest: float | None = None
