## Account purpose

Account type: paper trading (simulated fills via `trading-system` RiskEngine + SimulatedBroker). Live/mainnet Bybit connection exists in config but is NOT enabled for order submission — see README.md.
Primary assets: BTC/USDT (discussed so far); expand as needed.
Trading horizon: [fill in — intraday, swing, or long term]

## Objectives

Primary objective: [fill in]
What I am testing: manual paper orders through the existing risk-gated execution path; no automated strategy live yet.
What success means: [fill in — e.g. "risk engine never lets a paper loss exceed X%", "N consecutive profitable paper trades under strategy.md rules"]

## Risk context

Maximum capital allocated to this experiment: $150 (mentioned during setup — confirm/replace)
Maximum acceptable loss per trade: [fill in — amount or %]
Maximum total exposure: [fill in — amount or %]
Assets or products that must never be traded: [fill in]

Current hard caps enforced by `trading-system/app/risk/engine.py` (from `.env` / `app/config.py` defaults — edit there, not here, to change them):
- max_order_notional: $10,000
- max_position_pct: 25% of equity
- max_leverage: 1.0x (spot only, no leverage, hard-capped in code)
- max_daily_loss_pct: 3%
- max_drawdown_pct: 15%
- price_sanity_band_pct: 10%

## Personal constraints

Times I can review trades: [fill in]
Situations in which the bot must not trade: [fill in]
Other relevant positions or constraints: [fill in]
