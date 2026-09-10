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
    result = engine.approve(order, _state(), reference_price=50_000.0)
    assert result.approved
    assert result.reasons == []


def test_oversized_order_rejected():
    settings = Settings(max_order_notional=1_000.0)
    engine = RiskEngine(settings)
    order = _order(quantity=1.0)  # 1 BTC @ 50,000 = $50,000 notional
    result = engine.approve(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert any("max_order_notional" in r for r in result.reasons)


def test_order_exceeding_max_position_pct_rejected():
    settings = Settings(max_position_pct=0.05, max_order_notional=1_000_000)
    engine = RiskEngine(settings)
    order = _order(quantity=1.0)  # $50,000 on $100,000 equity = 50% > 5% cap
    result = engine.approve(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert any("max_position_pct" in r for r in result.reasons)


def test_kill_switch_rejects_every_order():
    settings = Settings(kill_switch=True)
    engine = RiskEngine(settings)
    order = _order(quantity=0.001)  # tiny, would otherwise be fine
    result = engine.approve(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert "kill_switch_engaged" in result.reasons


def test_price_far_from_reference_rejected():
    settings = Settings(price_sanity_band_pct=0.05)
    engine = RiskEngine(settings)
    order = _order(order_type=OrderType.LIMIT, limit_price=60_000.0, quantity=0.01)
    result = engine.approve(order, _state(), reference_price=50_000.0)
    assert not result.approved
    assert any("deviates" in r for r in result.reasons)


def test_daily_loss_breach_rejects_new_orders():
    settings = Settings(max_daily_loss_pct=0.02)
    engine = RiskEngine(settings)
    order = _order(quantity=0.001)
    state = _state(equity=97_000.0, daily_start_equity=100_000.0)  # -3% today
    result = engine.approve(order, state, reference_price=50_000.0)
    assert not result.approved
    assert any("daily loss" in r for r in result.reasons)


def test_drawdown_breach_rejects_new_orders():
    settings = Settings(max_drawdown_pct=0.10)
    engine = RiskEngine(settings)
    order = _order(quantity=0.001)
    state = _state(equity=85_000.0, peak_equity=100_000.0, daily_start_equity=85_000.0)
    result = engine.approve(order, state, reference_price=50_000.0)
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
    result = engine.approve(order, state, reference_price=3_000.0)
    assert not result.approved
    assert any("leverage" in r for r in result.reasons)


def test_approve_is_the_canonical_entry_point_and_check_order_aliases_it():
    """Every order must call risk.approve(order, ...) — check_order is kept
    only as a backward-compatible alias to the exact same method."""
    assert RiskEngine.approve is RiskEngine.check_order


def test_every_limit_configured_via_env_is_enforced(monkeypatch):
    """Loads risk limits the way .env actually does (env vars, not Settings
    kwargs) and proves each one independently blocks an order that would
    otherwise be approved, with a reason naming the breached limit."""
    monkeypatch.setenv("MAX_POSITION_PCT", "0.02")
    monkeypatch.setenv("MAX_LEVERAGE", "1")
    monkeypatch.setenv("MAX_DAILY_LOSS_PCT", "0.02")
    monkeypatch.setenv("MAX_DRAWDOWN_PCT", "0.15")
    monkeypatch.setenv("MAX_ORDER_USD", "500")  # alias for MAX_ORDER_NOTIONAL
    monkeypatch.setenv("KILL_SWITCH", "false")
    settings = Settings(_env_file=None)
    engine = RiskEngine(settings)

    healthy_state = _state(equity=100_000.0, peak_equity=100_000.0, daily_start_equity=100_000.0)

    # MAX_ORDER_USD=500 -> a $5,000 order is rejected
    result = engine.approve(_order(quantity=0.1), healthy_state, reference_price=50_000.0)
    assert not result.approved
    assert any("max_order_notional" in r for r in result.reasons)

    # MAX_POSITION_PCT=0.02 -> on smaller equity, an order well under the
    # $500 MAX_ORDER_USD cap can still breach the 2% position cap
    small_equity_state = _state(equity=10_000.0, peak_equity=10_000.0, daily_start_equity=10_000.0)
    result = engine.approve(_order(quantity=0.002), small_equity_state, reference_price=50_000.0)  # $100 = 1% of $10k
    assert result.approved  # sanity: clears every env-configured limit
    result = engine.approve(_order(quantity=0.006), small_equity_state, reference_price=50_000.0)  # $300 < $500 but 3% > 2%
    assert not result.approved
    assert any("max_position_pct" in r for r in result.reasons)

    # MAX_DAILY_LOSS_PCT=0.02 -> a 3% down day blocks new orders regardless of size
    daily_loss_state = _state(equity=97_000.0, peak_equity=100_000.0, daily_start_equity=100_000.0)
    result = engine.approve(_order(quantity=0.001), daily_loss_state, reference_price=50_000.0)
    assert not result.approved
    assert any("daily loss" in r for r in result.reasons)

    # MAX_DRAWDOWN_PCT=0.15 -> a 20% drawdown from peak blocks new orders
    drawdown_state = _state(equity=80_000.0, peak_equity=100_000.0, daily_start_equity=80_000.0)
    result = engine.approve(_order(quantity=0.001), drawdown_state, reference_price=50_000.0)
    assert not result.approved
    assert any("drawdown" in r for r in result.reasons)

    # MAX_LEVERAGE=1 -> gross exposure above 1x equity blocks new orders, even
    # when the new order itself is small enough to clear MAX_ORDER_USD alone
    leverage_state = _state(
        positions={"BTC/USDT": 1.998},  # 1.998 * 50,000 = $99,900 = 99.9% of equity already
        last_mark_prices={"BTC/USDT": 50_000.0, "ETH/USDT": 3_000.0},
        equity=100_000.0,
        peak_equity=100_000.0,
        daily_start_equity=100_000.0,
    )
    result = engine.approve(_order(symbol="ETH/USDT", quantity=0.1), leverage_state, reference_price=3_000.0)  # +$300
    assert not result.approved
    assert any("leverage" in r for r in result.reasons)

    # KILL_SWITCH=true -> blocks absolutely everything, no matter how small
    monkeypatch.setenv("KILL_SWITCH", "true")
    killed_settings = Settings(_env_file=None)
    killed_engine = RiskEngine(killed_settings)
    result = killed_engine.approve(_order(quantity=0.0001), healthy_state, reference_price=50_000.0)
    assert not result.approved
    assert "kill_switch_engaged" in result.reasons
