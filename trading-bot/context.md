## Account purpose

Account type: paper trading (simulated fills via `trading-system` RiskEngine + SimulatedBroker). Live/mainnet Bybit connection exists in config but is NOT enabled for order submission — see README.md.
Primary assets: BTC/USDT (discussed so far); expand as needed.
Trading horizon: swing (default, matches strategy.md's 1h-bar RSI/MACD strategy — replace if you want intraday or long-term instead)

## Objectives

Primary objective: (default) determine whether the baseline RSI/MACD strategy in strategy.md is net profitable in paper trading before ever risking real money — replace with your actual goal if different.
What I am testing: manual paper orders through the risk-gated execution path (done — see ledger.md); next, the automated baseline_rsi_macd strategy once backtested (not started).
What success means: (default) a completed backtest over ≥6 months of BTC/USDT history with a positive Sharpe ratio and max drawdown under the 15% account cap, followed by ≥30 days of paper forward-testing with no risk-engine violations and net-positive simulated P&L. Replace with your own bar if this one's wrong.

## Risk context

Maximum capital allocated to this experiment: $150 (mentioned during setup — confirm/replace)
Maximum acceptable loss per trade: (default, unset by strategy) not currently enforced — strategy.md notes the baseline strategy has no coded stop-loss. Suggest capping at 2% of capital (~$3) per trade if you want this enforced; would need adding to app/paper/scheduler.py or a new signal generator, not just this doc.
Maximum total exposure: ~$37.50 (25% of $150, per the account-level max_position_pct cap the scheduler already applies) — replace if $150 or the 25% default isn't right.
Assets or products that must never be traded: [fill in — genuinely need your input here, not guessing]

Current hard caps enforced by `trading-system/app/risk/engine.py` (from `.env` / `app/config.py` defaults — edit there, not here, to change them):
- max_order_notional: $10,000
- max_position_pct: 25% of equity
- max_leverage: 1.0x (spot only, no leverage, hard-capped in code)
- max_daily_loss_pct: 3%
- max_drawdown_pct: 15%
- price_sanity_band_pct: 10%

## Personal constraints

Times I can review trades: [fill in — genuinely need your input here]
Situations in which the bot must not trade: (default) kill switch engaged, daily loss cap hit, or drawdown cap hit — all three already enforced by RiskEngine regardless of this doc. Add any personal conditions (e.g. "not during major scheduled news events") here.
Other relevant positions or constraints: [fill in — genuinely need your input here]
