"""The risk engine. Every order — whether proposed by a signal, the portfolio
optimizer, a human, or the LLM agent — MUST call `RiskEngine.approve(order,
state, reference_price)` before it reaches app.execution, and is rejected
with a human-readable reason (or several) the moment it fails any limit.
There is no other path to a fill in this codebase.

The LLM must never call this module's approval path directly with an order
that skips these checks; app.agent only ever *proposes*.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.config import Settings, get_settings
from app.models.trading import Order, OrderSide, RiskCheckResult
from app.monitoring.logging_config import log_decision
from app.monitoring.metrics import ORDERS_REJECTED, ORDERS_SUBMITTED


@dataclass
class PortfolioState:
    """Snapshot of account state needed to evaluate risk. Immutable per check —
    callers build a fresh snapshot each time rather than mutating a shared one."""

    equity: float
    peak_equity: float
    positions: dict[str, float] = field(default_factory=dict)
    last_mark_prices: dict[str, float] = field(default_factory=dict)
    daily_start_equity: float = 0.0

    @property
    def drawdown_pct(self) -> float:
        if self.peak_equity <= 0:
            return 0.0
        return max(0.0, (self.peak_equity - self.equity) / self.peak_equity)

    @property
    def daily_pnl_pct(self) -> float:
        if self.daily_start_equity <= 0:
            return 0.0
        return (self.equity - self.daily_start_equity) / self.daily_start_equity

    def position_notional(self, symbol: str) -> float:
        qty = self.positions.get(symbol, 0.0)
        price = self.last_mark_prices.get(symbol, 0.0)
        return abs(qty) * price

    def gross_notional(self) -> float:
        return sum(abs(q) * self.last_mark_prices.get(s, 0.0) for s, q in self.positions.items())


class RiskEngine:
    """Deterministic, synchronous, side-effect-free (besides logging) veto gate.

    Design intent: this must be trivially auditable. No LLM call, no network
    call, no async — just arithmetic against hard limits from Settings.
    """

    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()

    def approve(
        self,
        order: Order,
        state: PortfolioState,
        reference_price: float,
    ) -> RiskCheckResult:
        """The single entry point every order must pass through. Evaluates
        every limit configured via .env (see app.config.Settings) and
        returns a RiskCheckResult with `approved=False` and one reason per
        limit breached — never raises, never partially applies an order."""
        s = self.settings
        reasons: list[str] = []
        limits: dict[str, float] = {}

        ORDERS_SUBMITTED.labels(symbol=order.symbol, side=order.side.value).inc()

        if s.kill_switch:
            reasons.append("kill_switch_engaged")

        order_price = order.limit_price if order.limit_price is not None else reference_price
        order_notional = abs(order.quantity) * order_price

        # 1. max order notional
        limits["max_order_notional"] = s.max_order_notional
        if order_notional > s.max_order_notional:
            reasons.append(
                f"order_notional {order_notional:.2f} exceeds max_order_notional {s.max_order_notional:.2f}"
            )

        # 2. price sanity — reject orders priced far from the last observed mark
        if reference_price > 0:
            deviation = abs(order_price - reference_price) / reference_price
            limits["price_sanity_band_pct"] = s.price_sanity_band_pct
            if deviation > s.price_sanity_band_pct:
                reasons.append(
                    f"price {order_price:.8f} deviates {deviation:.2%} from reference "
                    f"{reference_price:.8f}, exceeds band {s.price_sanity_band_pct:.2%}"
                )

        # 3. max position % of equity, post-trade
        signed_qty = order.quantity if order.side == OrderSide.BUY else -order.quantity
        projected_qty = state.positions.get(order.symbol, 0.0) + signed_qty
        projected_notional = abs(projected_qty) * (reference_price or order_price)
        equity = max(state.equity, 1e-9)
        projected_position_pct = projected_notional / equity
        limits["max_position_pct"] = s.max_position_pct
        if projected_position_pct > s.max_position_pct:
            reasons.append(
                f"projected position {projected_position_pct:.2%} of equity exceeds "
                f"max_position_pct {s.max_position_pct:.2%}"
            )

        # 4. max leverage (gross notional / equity), spot-only so this also
        #    catches any attempt to size beyond 1x equity in aggregate
        projected_gross = state.gross_notional() - state.position_notional(order.symbol) + projected_notional
        projected_leverage = projected_gross / equity
        limits["max_leverage"] = s.max_leverage
        if projected_leverage > s.max_leverage:
            reasons.append(
                f"projected leverage {projected_leverage:.2f}x exceeds max_leverage {s.max_leverage:.2f}x"
            )

        # 5. max daily loss
        limits["max_daily_loss_pct"] = s.max_daily_loss_pct
        if state.daily_pnl_pct <= -s.max_daily_loss_pct:
            reasons.append(
                f"daily loss {state.daily_pnl_pct:.2%} breaches max_daily_loss_pct "
                f"{-s.max_daily_loss_pct:.2%}"
            )

        # 6. max drawdown
        limits["max_drawdown_pct"] = s.max_drawdown_pct
        if state.drawdown_pct >= s.max_drawdown_pct:
            reasons.append(
                f"drawdown {state.drawdown_pct:.2%} breaches max_drawdown_pct {s.max_drawdown_pct:.2%}"
            )

        result = RiskCheckResult(
            approved=len(reasons) == 0,
            reasons=reasons,
            checked_at=datetime.now(UTC),
            limits_evaluated=limits,
        )

        if not result.approved:
            ORDERS_REJECTED.labels(symbol=order.symbol, reason=reasons[0]).inc()

        log_decision(
            kind="risk_check",
            symbol=order.symbol,
            outcome="approved" if result.approved else "rejected",
            payload={
                "client_order_id": order.client_order_id,
                "side": order.side.value,
                "quantity": order.quantity,
                "reference_price": reference_price,
                "reasons": reasons,
                "limits_evaluated": limits,
            },
            log_dir=s.log_dir,
        )

        return result

    # Backward-compatible alias — `approve` is the name every new caller
    # should use; kept so any external/older code calling check_order still works.
    check_order = approve

    def trip_kill_switch(self, reason: str) -> None:
        """Irreversible-until-restart safety valve. Once tripped, every
        subsequent order is rejected regardless of size."""
        self.settings.kill_switch = True
        log_decision(kind="risk_check", outcome="kill_switch_tripped", payload={"reason": reason})
