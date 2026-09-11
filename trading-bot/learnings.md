## Reviewed learnings

### Trade manual-btc-buy-1 / manual-btc-buy-2

Date closed: 2026-09-11
Outcome: rejected (no fill) — not a profit/loss outcome
Original thesis: none — these were sizing/mechanics tests, not strategy trades
What happened: 0.5 BTC and 0.2 BTC paper orders were both rejected by `RiskEngine.approve` for exceeding `max_order_notional` ($10,000) at the assumed $60,000/BTC reference price; the 0.5 BTC order also exceeded `max_position_pct`.
What execution handled well: the risk engine correctly vetoed oversized orders before any fill, exactly as designed — no partial application, clear machine-readable reasons returned.
What execution handled poorly: n/a — behaved as designed.
Possible observation: default risk caps in `trading-system/app/config.py` (`max_order_notional=$10,000`, `max_position_pct=25%`) are tuned for a much larger assumed equity ($100,000) than the $150 experiment size mentioned in `context.md`. If real trading uses a $150 account, these caps are irrelevant (any real order will be far under $10k) — the caps that actually matter at this account size haven't been defined yet.
Evidence from similar trades: none yet — only two data points.
Proposed rule change: none — pending manual review. Candidate for discussion: add account-size-relative caps once `context.md`'s real capital figure is confirmed.
Manual review status: pending

### Trade manual-btc-buy-3

Date closed: still open (paper position, not closed)
Outcome: n/a — no exit yet
Original thesis: mechanics test only, not a strategy call
What happened: $500 BTC buy filled at an assumed (non-live) reference price via `SimulatedBroker`.
What execution handled well: full pipeline (order → risk check → fill → fee/slippage model) worked end to end with no code changes needed.
What execution handled poorly: no live price feed was available to validate against — this needs fixing before any result here is meaningful.
Possible observation: n/a until a live price feed is available and a real exit is recorded.
Evidence from similar trades: none.
Proposed rule change: none.
Manual review status: pending
