"""Event-driven backtest engine.

Every simulated order passes through the exact same RiskEngine used in paper
trading and (would be used in) live routing — so a strategy that gets vetoed
in backtest will also get vetoed in paper trading, and vice versa.
"""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime

from app.backtest.metrics import Metrics, compute_metrics
from app.config import Settings, get_settings
from app.execution.broker import FillModel, SimulatedBroker
from app.models.trading import Order, OrderSide, OrderStatus, OrderType, Signal, SignalDirection
from app.risk.engine import PortfolioState, RiskEngine


@dataclass
class Bar:
    symbol: str
    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float
    funding_rate: float = 0.0


StrategyFn = Callable[[str, list[Bar]], Signal | None]


@dataclass
class BacktestResult:
    equity_curve: list[float]
    timestamps: list[datetime]
    metrics: Metrics
    rejected_orders: int
    accepted_orders: int
    trade_pnls: list[float] = field(default_factory=list)


class BacktestEngine:
    def __init__(
        self,
        settings: Settings | None = None,
        starting_equity: float = 100_000.0,
        fee_bps: float = 10.0,
        slippage_bps: float = 5.0,
        seed: int = 42,
    ):
        self.settings = settings or get_settings()
        self.risk_engine = RiskEngine(self.settings)
        self.broker = SimulatedBroker(FillModel(taker_fee_bps=fee_bps, slippage_bps=slippage_bps))
        self.starting_equity = starting_equity
        self._seed = seed

    def run(
        self,
        bars_by_symbol: dict[str, list[Bar]],
        strategy: StrategyFn,
        lookback: int = 50,
    ) -> BacktestResult:
        symbols = list(bars_by_symbol.keys())
        n_bars = min(len(b) for b in bars_by_symbol.values())

        equity = self.starting_equity
        peak_equity = equity
        daily_start_equity = equity
        positions: dict[str, float] = {s: 0.0 for s in symbols}
        avg_entry: dict[str, float] = {s: 0.0 for s in symbols}
        last_prices: dict[str, float] = {}

        equity_curve: list[float] = []
        timestamps: list[datetime] = []
        trade_pnls: list[float] = []
        rejected = 0
        accepted = 0
        turnover_notional = 0.0
        current_day: int | None = None

        for i in range(n_bars):
            for symbol in symbols:
                bar = bars_by_symbol[symbol][i]
                last_prices[symbol] = bar.close

                if current_day is None or bar.ts.date().toordinal() != current_day:
                    current_day = bar.ts.date().toordinal()
                    daily_start_equity = equity

                # Funding accrues on the position held INTO this bar, every bar,
                # independent of whether a trade happens on it — not just on
                # bars where a fill occurs.
                if bar.funding_rate and positions[symbol]:
                    equity -= positions[symbol] * bar.close * bar.funding_rate

                window = bars_by_symbol[symbol][max(0, i - lookback + 1) : i + 1]
                if len(window) < min(lookback, 2):
                    continue

                signal = strategy(symbol, window)
                if signal is None or signal.direction == SignalDirection.FLAT:
                    continue

                state = PortfolioState(
                    equity=equity,
                    peak_equity=peak_equity,
                    positions=dict(positions),
                    last_mark_prices=dict(last_prices),
                    daily_start_equity=daily_start_equity,
                )

                target_notional = equity * self.settings.max_position_pct * signal.confidence
                target_qty = target_notional / bar.close if bar.close else 0.0
                if signal.direction == SignalDirection.SHORT:
                    target_qty = -target_qty

                delta_qty = target_qty - positions[symbol]
                if abs(delta_qty * bar.close) < 1.0:  # ignore dust orders
                    continue

                side = OrderSide.BUY if delta_qty > 0 else OrderSide.SELL
                order = Order(
                    client_order_id=f"bt-{symbol}-{i}",
                    symbol=symbol,
                    side=side,
                    order_type=OrderType.MARKET,
                    quantity=abs(delta_qty),
                    reason=f"signal:{signal.model_name}:{signal.direction.value}",
                )

                check = self.risk_engine.check_order(order, state, reference_price=bar.close)
                if not check.approved:
                    order.status = OrderStatus.REJECTED
                    rejected += 1
                    continue

                order.status = OrderStatus.ACCEPTED
                accepted += 1
                fill = self.broker.execute(order, reference_price=bar.close)
                turnover_notional += fill.quantity * fill.price

                prev_qty = positions[symbol]
                new_qty = prev_qty + (fill.quantity if side == OrderSide.BUY else -fill.quantity)

                if prev_qty != 0 and (prev_qty > 0) != (new_qty >= 0) and new_qty != prev_qty:
                    closed_qty = min(abs(prev_qty), abs(fill.quantity))
                    pnl = closed_qty * (fill.price - avg_entry[symbol]) * (1 if prev_qty > 0 else -1)
                    trade_pnls.append(pnl)
                    equity += pnl

                if new_qty != 0 and (prev_qty == 0 or (prev_qty > 0) == (new_qty > 0)):
                    total_cost = avg_entry[symbol] * abs(prev_qty) + fill.price * abs(fill.quantity)
                    avg_entry[symbol] = total_cost / abs(new_qty) if new_qty != 0 else 0.0
                elif new_qty == 0:
                    avg_entry[symbol] = 0.0

                positions[symbol] = new_qty
                equity -= fill.fee

            peak_equity = max(peak_equity, equity)
            equity_curve.append(equity)
            timestamps.append(bars_by_symbol[symbols[0]][i].ts)

        metrics = compute_metrics(equity_curve, trade_pnls, turnover_notional)
        return BacktestResult(
            equity_curve=equity_curve,
            timestamps=timestamps,
            metrics=metrics,
            rejected_orders=rejected,
            accepted_orders=accepted,
            trade_pnls=trade_pnls,
        )
