"""Deterministic paper-trading loop: data -> signal -> risk check -> simulated
fill -> log. Runs against the exchange testnet (via TestnetBroker) or, if no
testnet credentials are configured, against SimulatedBroker fed by the most
recent bars in Postgres/Parquet.

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
        if self.settings.exchange_api_key and self.settings.exchange_testnet:
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
        check = self.risk_engine.approve(order, state, reference_price=bar.close)
        if not check.approved:
            order.status = OrderStatus.REJECTED
            logger.info("order_rejected", extra={"extra_fields": {"symbol": symbol, "reasons": check.reasons}})
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
            payload={"client_order_id": order.client_order_id, "quantity": fill.quantity, "price": fill.price},
            log_dir=self.settings.log_dir,
        )

    async def run_forever(self) -> None:
        self._running = True
        while self._running:
            for symbol in self.symbols:
                try:
                    bar = await self.fetch_latest_bar(symbol)
                    self.process_bar(symbol, bar)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("paper_loop_error", extra={"extra_fields": {"symbol": symbol, "error": str(exc)}})
            await asyncio.sleep(self.poll_interval_seconds)

    def stop(self) -> None:
        self._running = False
