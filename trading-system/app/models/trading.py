"""Typed trading domain models. Orders/fills/positions are SQLModel tables so every
decision, order, rejection and LLM call is durably logged (see Decision below).
"""
from __future__ import annotations

import enum
from datetime import UTC, datetime

from pydantic import BaseModel
from pydantic import Field as PField
from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(UTC)


class OrderSide(str, enum.Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, enum.Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, enum.Enum):
    PENDING_RISK = "pending_risk"
    REJECTED = "rejected"
    ACCEPTED = "accepted"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"


class SignalDirection(str, enum.Enum):
    LONG = "long"
    SHORT = "short"
    FLAT = "flat"


class Signal(BaseModel):
    """Advisory output of app.signals — never executed directly."""

    symbol: str
    ts: datetime
    direction: SignalDirection
    confidence: float = PField(ge=0.0, le=1.0)
    predicted_return: float | None = None
    model_name: str
    model_version: str = "unversioned"


class Order(SQLModel, table=True):
    __tablename__ = "orders"

    id: int | None = Field(default=None, primary_key=True)
    client_order_id: str = Field(index=True, unique=True)
    symbol: str = Field(index=True)
    side: OrderSide
    order_type: OrderType
    quantity: float
    limit_price: float | None = None
    reason: str = Field(description="Why this order was proposed (signal / rebalance / manual)")
    status: OrderStatus = Field(default=OrderStatus.PENDING_RISK)
    risk_check_result: str | None = Field(default=None, description="JSON-encoded RiskCheckResult")
    is_paper: bool = Field(default=True)
    created_at: datetime = Field(default_factory=_utcnow)


class Fill(SQLModel, table=True):
    __tablename__ = "fills"

    id: int | None = Field(default=None, primary_key=True)
    order_id: int = Field(foreign_key="orders.id", index=True)
    symbol: str
    side: OrderSide
    quantity: float
    price: float
    fee: float
    slippage_bps: float
    ts: datetime = Field(default_factory=_utcnow)


class Position(SQLModel, table=True):
    __tablename__ = "positions"

    id: int | None = Field(default=None, primary_key=True)
    symbol: str = Field(index=True, unique=True)
    quantity: float = 0.0
    avg_entry_price: float = 0.0
    realized_pnl: float = 0.0
    updated_at: datetime = Field(default_factory=_utcnow)


class RiskCheckResult(BaseModel):
    approved: bool
    reasons: list[str] = PField(default_factory=list)
    checked_at: datetime = PField(default_factory=_utcnow)
    limits_evaluated: dict[str, float] = PField(default_factory=dict)


class Decision(SQLModel, table=True):
    """Append-only audit log: every decision, order, rejection and LLM call."""

    __tablename__ = "decisions_log"

    id: int | None = Field(default=None, primary_key=True)
    ts: datetime = Field(default_factory=_utcnow, index=True)
    kind: str = Field(index=True, description="signal | order | risk_check | llm_call | fill | agent_action")
    symbol: str | None = Field(default=None, index=True)
    payload: str = Field(description="JSON-encoded details")
    outcome: str | None = Field(default=None, description="approved | rejected | filled | error, etc.")
