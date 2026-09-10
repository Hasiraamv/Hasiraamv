from app.config import Settings
from app.models.trading import Order, OrderSide, OrderType
from app.risk.engine import PortfolioState, RiskEngine


def _order(**overrides) -> Order:
    defaults = {
        "client_order_id": "test-1",
        "symbol": "BTC/USDT",
        "side": OrderSide.BUY,
        "order_type": OrderType.MARKET,
        "quantity": 1.0,
        "reason": "test",
    }
    defaults.update(overrides)
    return Order(**defaults)


def _state(**overrides) -> PortfolioState:
    defaults = {"equity": 100_000.0, "peak_equity": 100_000.0, "daily_start_equity": 100_000.0}
    defaults.update(overrides)
    return PortfolioState(**defaults)


def test_normal_order_within_limits_is_approved():
    settings = Settings(max_position_pct=0.5, max_order_notional=50_000)
    engine = RiskEngine(settings)
    order = _order(quantity=0.1)  # 0.1 BTC @ 50,000 = $5,000, well within limits
    result = engine.check_order(order, _state(), reference_price=50_000.0)
    assert result.approved
    assert result.reasons == []


def test_oversized_order_rejected():
    settings = Settings(max_order_notional=1_000.0)
    engine = RiskEngine(settings)
    order = _order(quantity=1.0)  # 1 BTC @ 50,000 = $50,000 notional
    result = engine.check_order(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert any("max_order_notional" in r for r in result.reasons)


def test_order_exceeding_max_position_pct_rejected():
    settings = Settings(max_position_pct=0.05, max_order_notional=1_000_000)
    engine = RiskEngine(settings)
    order = _order(quantity=1.0)  # $50,000 on $100,000 equity = 50% > 5% cap
    result = engine.check_order(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert any("max_position_pct" in r for r in result.reasons)


def test_kill_switch_rejects_every_order():
    settings = Settings(kill_switch=True)
    engine = RiskEngine(settings)
    order = _order(quantity=0.001)  # tiny, would otherwise be fine
    result = engine.check_order(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert "kill_switch_engaged" in result.reasons


def test_price_far_from_reference_rejected():
    settings = Settings(price_sanity_band_pct=0.05)
    engine = RiskEngine(settings)
    order = _order(order_type=OrderType.LIMIT, limit_price=60_000.0, quantity=0.01)
    result = engine.check_order(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert any("deviates" in r for r in result.reasons)


def test_daily_loss_breach_rejects_new_orders():
    settings = Settings(max_daily_loss_pct=0.02)
    engine = RiskEngine(settings)
    order = _order(quantity=0.001)
    state = _state(equity=97_000.0, daily_start_equity=100_000.0)  # -3% today
    result = engine.check_order(order, state, reference_price=50_000.0)
    assert not result.approved
    assert any("daily loss" in r for r in result.reasons)


def test_drawdown_breach_rejects_new_orders():
    settings = Settings(max_drawdown_pct=0.10)
    engine = RiskEngine(settings)
    order = _order(quantity=0.001)
    state = _state(equity=85_000.0, peak_equity=100_000.0, daily_start_equity=85_000.0)
    result = engine.check_order(order, state, reference_price=50_000.0)
    assert not result.approved
    assert any("drawdown" in r for r in result.reasons)


def test_leverage_cap_rejects_order_pushing_gross_notional_over_equity():
    settings = Settings(max_leverage=1.0, max_position_pct=1.0, max_order_notional=1_000_000)
    engine = RiskEngine(settings)
    order = _order(symbol="ETH/USDT", quantity=10.0)  # $30,000 on top of existing exposure
    state = _state(
        positions={"BTC/USDT": 1.5},  # 1.5 * 50,000 = $75,000 already
        last_mark_prices={"BTC/USDT": 50_000.0, "ETH/USDT": 3_000.0},
    )
    result = engine.check_order(order, state, reference_price=3_000.0)
    assert not result.approved
    assert any("leverage" in r for r in result.reasons)
