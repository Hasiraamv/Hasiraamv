"""Order execution. Two adapters, both paper:

- SimulatedBroker: pure in-memory fill simulator with a fee/slippage/latency
  model, used by the backtest engine and by paper trading when no testnet
  credentials are configured.
- TestnetBroker: routes to an exchange's SANDBOX/TESTNET endpoint via ccxt.
  It refuses to construct if the configured exchange is not in sandbox mode,
  and it never calls any withdrawal/transfer endpoint.

Neither class is reachable except via app.risk.engine having already
approved the order — see RiskEngine.check_order.
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass

from app.models.trading import Fill, Order, OrderSide
from app.monitoring.logging_config import log_decision
from app.monitoring.metrics import ORDERS_FILLED


@dataclass
class FillModel:
    """Simple, deterministic-given-seed fee/slippage/latency model."""

    taker_fee_bps: float = 10.0  # 0.10%
    slippage_bps: float = 5.0  # baseline slippage on market orders
    latency_ms_mean: float = 80.0
    latency_ms_jitter: float = 40.0
    rng: random.Random | None = None

    def __post_init__(self) -> None:
        if self.rng is None:
            self.rng = random.Random(42)

    def simulate_latency_ms(self) -> float:
        return max(0.0, self.rng.gauss(self.latency_ms_mean, self.latency_ms_jitter))

    def simulate_fill_price(self, side: OrderSide, reference_price: float) -> tuple[float, float]:
        """Returns (fill_price, realized_slippage_bps)."""
        direction = 1 if side == OrderSide.BUY else -1
        noise_bps = abs(self.rng.gauss(self.slippage_bps, self.slippage_bps / 3))
        fill_price = reference_price * (1 + direction * noise_bps / 10_000)
        return fill_price, noise_bps

    def fee(self, notional: float) -> float:
        return notional * self.taker_fee_bps / 10_000


class SimulatedBroker:
    """In-memory paper execution — never touches a real exchange."""

    def __init__(self, fill_model: FillModel | None = None):
        self.fill_model = fill_model or FillModel()
        self._next_order_id = 1

    def execute(self, order: Order, reference_price: float) -> Fill:
        latency_ms = self.fill_model.simulate_latency_ms()
        time.sleep(0.0)  # placeholder hook for real async latency simulation
        fill_price, slippage_bps = self.fill_model.simulate_fill_price(order.side, reference_price)
        notional = order.quantity * fill_price
        fee = self.fill_model.fee(notional)

        order_id = order.id if order.id is not None else self._next_order_id
        self._next_order_id += 1

        fill = Fill(
            order_id=order_id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            price=fill_price,
            fee=fee,
            slippage_bps=slippage_bps,
        )
        ORDERS_FILLED.labels(symbol=order.symbol, side=order.side.value).inc()
        log_decision(
            kind="fill",
            symbol=order.symbol,
            outcome="filled",
            payload={
                "client_order_id": order.client_order_id,
                "side": order.side.value,
                "quantity": order.quantity,
                "fill_price": fill_price,
                "fee": fee,
                "slippage_bps": slippage_bps,
                "latency_ms": latency_ms,
                "reason": order.reason,
            },
        )
        return fill


class TestnetBroker:
    """Routes orders to an exchange's sandbox/testnet via ccxt. Spot only.

    Refuses to initialize against a live (non-sandbox) endpoint, and never
    exposes or calls withdrawal/transfer methods.
    """

    _FORBIDDEN_METHODS = ("withdraw", "transfer", "fetch_deposit_address", "create_deposit_address")

    def __init__(self, exchange_id: str, api_key: str, api_secret: str, sandbox: bool = True):
        if not sandbox:
            raise RuntimeError(
                "TestnetBroker refuses to run against a live exchange endpoint. "
                "This system is PAPER TRADING ONLY."
            )
        import ccxt  # lazy import

        exchange_class = getattr(ccxt, exchange_id)
        self.exchange = exchange_class({"apiKey": api_key, "secret": api_secret, "enableRateLimit": True})
        if hasattr(self.exchange, "set_sandbox_mode"):
            self.exchange.set_sandbox_mode(True)
        for forbidden in self._FORBIDDEN_METHODS:
            if hasattr(self.exchange, forbidden):
                setattr(self.exchange, forbidden, self._blocked(forbidden))

    @staticmethod
    def _blocked(name: str):
        def _raise(*_a, **_k):
            raise PermissionError(f"{name} is disabled — this system never moves funds")

        return _raise

    def execute(self, order: Order, reference_price: float) -> Fill:
        ccxt_order = self.exchange.create_order(
            symbol=order.symbol,
            type=order.order_type.value,
            side=order.side.value,
            amount=order.quantity,
            price=order.limit_price,
        )
        fill_price = float(ccxt_order.get("average") or ccxt_order.get("price") or reference_price)
        filled_qty = float(ccxt_order.get("filled") or order.quantity)
        fee_info = ccxt_order.get("fee") or {}
        fee = float(fee_info.get("cost") or 0.0)

        fill = Fill(
            order_id=order.id or 0,
            symbol=order.symbol,
            side=order.side,
            quantity=filled_qty,
            price=fill_price,
            fee=fee,
            slippage_bps=abs(fill_price - reference_price) / reference_price * 10_000 if reference_price else 0.0,
        )
        ORDERS_FILLED.labels(symbol=order.symbol, side=order.side.value).inc()
        log_decision(
            kind="fill",
            symbol=order.symbol,
            outcome="filled_testnet",
            payload={"client_order_id": order.client_order_id, "ccxt_order_id": ccxt_order.get("id")},
        )
        return fill
