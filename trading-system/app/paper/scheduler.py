"""Deterministic paper-trading loop: live data -> signal -> risk check ->
simulated fill (fees + slippage) -> log. TESTNET ONLY: it either routes
through TestnetBroker against the exchange's sandbox endpoint, or — with no
exchange keys configured — through the pure in-memory SimulatedBroker. It
refuses outright to build a broker against a live (non-sandbox) endpoint;
see `_build_broker`.

Every signal, risk decision (approved or rejected), and fill is written to
the append-only decision log via `app.monitoring.logging_config.log_decision`
— see app.risk.engine.RiskEngine.approve for the risk-check half of that
trail, which fires on every single order regardless of outcome.

The LLM is NEVER called from this loop — it is scheduled/on-demand only, via
app.agent, and only ever proposes changes that a human or the risk engine
then gates.
"""
from __future__ import annotations

import asyncio
from datetime import UTC, datetime

from app.backtest.engine import Bar
from app.config import Settings, get_settings
from app.execution.broker import FillModel, SimulatedBroker, TestnetBroker
from app.models.trading import Order, OrderSide, OrderStatus, OrderType, SignalDirection
from app.monitoring.logging_config import get_logger, log_decision
from app.risk.engine import PortfolioState, RiskEngine

logger = get_logger(__name__)

StrategyFn = "Callable[[str, list[Bar]], Signal | None]"


class PaperTradingLoop:
    def __init__(
        self,
        symbols: list[str],
        strategy,
        settings: Settings | None = None,
        poll_interval_seconds: float = 60.0,
    ):
        self.settings = settings or get_settings()
        self.symbols = symbols
        self.strategy = strategy
        self.poll_interval_seconds = poll_interval_seconds
        self.risk_engine = RiskEngine(self.settings)
        self.broker = self._build_broker()
        self.positions: dict[str, float] = {s: 0.0 for s in symbols}
        self.equity = 100_000.0
        self.peak_equity = self.equity
        self.daily_start_equity = self.equity
        self._current_day: int | None = None
        self._history: dict[str, list[Bar]] = {s: [] for s in symbols}
        self._running = False

    def _build_broker(self):
        """TESTNET ONLY. Exchange credentials with EXCHANGE_TESTNET not set to
        true are refused outright rather than silently downgraded to pure
        simulation — a misconfigured .env should fail loudly, not quietly
        run somewhere the operator didn't intend."""
        if self.settings.exchange_api_key:
            if not self.settings.exchange_testnet:
                raise RuntimeError(
                    "EXCHANGE_API_KEY is set but EXCHANGE_TESTNET is not true. Paper trading is "
                    "testnet-only and refuses to build a broker against a live exchange endpoint."
                )
            return TestnetBroker(
                self.settings.exchange_id,
                self.settings.exchange_api_key,
                self.settings.exchange_api_secret,
                sandbox=True,
            )
        return SimulatedBroker(FillModel())

    async def fetch_latest_bar(self, symbol: str) -> Bar:
        """Fetches the most recent bar. Uses ccxt REST directly to keep the
        loop simple; swap for a Redis-cached feed from app.data in production."""
        import ccxt

        exchange_class = getattr(ccxt, self.settings.exchange_id)
        exchange = exchange_class({"enableRateLimit": True})
        if self.settings.exchange_testnet and hasattr(exchange, "set_sandbox_mode"):
            exchange.set_sandbox_mode(True)
        ohlcv = exchange.fetch_ohlcv(symbol, timeframe="1m", limit=1)
        row = ohlcv[-1]
        return Bar(
            symbol=symbol,
            ts=datetime.fromtimestamp(row[0] / 1000, tz=UTC),
            open=row[1],
            high=row[2],
            low=row[3],
            close=row[4],
            volume=row[5],
        )

    def _portfolio_state(self, last_prices: dict[str, float]) -> PortfolioState:
        return PortfolioState(
            equity=self.equity,
            peak_equity=self.peak_equity,
            positions=dict(self.positions),
            last_mark_prices=last_prices,
            daily_start_equity=self.daily_start_equity,
        )

    def process_bar(self, symbol: str, bar: Bar, lookback: int = 50) -> None:
        today = bar.ts.date().toordinal()
        if self._current_day is None or today != self._current_day:
            self._current_day = today
            self.daily_start_equity = self.equity

        history = self._history[symbol]
        history.append(bar)
        if len(history) > lookback:
            history.pop(0)

        signal = self.strategy(symbol, history)
        if signal is None or signal.direction == SignalDirection.FLAT:
            return

        log_decision(
            kind="signal",
            symbol=symbol,
            outcome=signal.direction.value,
            payload={
                "model_name": signal.model_name,
                "confidence": signal.confidence,
                "predicted_return": signal.predicted_return,
            },
            log_dir=self.settings.log_dir,
        )

        target_notional = self.equity * self.settings.max_position_pct * signal.confidence
        target_qty = target_notional / bar.close if bar.close else 0.0
        if signal.direction == SignalDirection.SHORT:
            target_qty = -target_qty

        delta_qty = target_qty - self.positions[symbol]
        if abs(delta_qty * bar.close) < 1.0:
            return

        side = OrderSide.BUY if delta_qty > 0 else OrderSide.SELL
        order = Order(
            client_order_id=f"paper-{symbol}-{bar.ts.isoformat()}",
            symbol=symbol,
            side=side,
            order_type=OrderType.MARKET,
            quantity=abs(delta_qty),
            reason=f"signal:{signal.model_name}:{signal.direction.value}",
            is_paper=True,
        )

        state = self._portfolio_state({symbol: bar.close})
        # The only order-approval path in the codebase — see RiskEngine.approve,
        # which itself logs a "risk_check" decision (approved or rejected)
        # for every single order regardless of outcome.
        check = self.risk_engine.approve(order, state, reference_price=bar.close)
        if not check.approved:
            order.status = OrderStatus.REJECTED
            logger.info("order_rejected", extra={"extra_fields": {"symbol": symbol, "reasons": check.reasons}})
            log_decision(
                kind="order",
                symbol=symbol,
                outcome="rejected",
                payload={"client_order_id": order.client_order_id, "reasons": check.reasons},
                log_dir=self.settings.log_dir,
            )
            return

        order.status = OrderStatus.ACCEPTED
        fill = self.broker.execute(order, reference_price=bar.close)
        self.positions[symbol] += fill.quantity if side == OrderSide.BUY else -fill.quantity
        self.equity -= fill.fee
        self.peak_equity = max(self.peak_equity, self.equity)

        log_decision(
            kind="order",
            symbol=symbol,
            outcome="filled",
            payload={
                "client_order_id": order.client_order_id,
                "side": side.value,
                "quantity": fill.quantity,
                "price": fill.price,
                "fee": fill.fee,
                "slippage_bps": fill.slippage_bps,
            },
            log_dir=self.settings.log_dir,
        )

    async def run_forever(self, max_iterations: int | None = None) -> None:
        """Polls every symbol once per `poll_interval_seconds`, forever by
        default. `max_iterations` (total polling rounds, all symbols) bounds
        the loop for tests; production callers leave it as None."""
        self._running = True
        count = 0
        while self._running and (max_iterations is None or count < max_iterations):
            for symbol in self.symbols:
                try:
                    bar = await self.fetch_latest_bar(symbol)
                    self.process_bar(symbol, bar)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("paper_loop_error", extra={"extra_fields": {"symbol": symbol, "error": str(exc)}})
            count += 1
            if self._running and (max_iterations is None or count < max_iterations):
                await asyncio.sleep(self.poll_interval_seconds)
        self._running = False

    def stop(self) -> None:
        self._running = False
