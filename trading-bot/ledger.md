## Trade ledger

| Trade ID | Opened | Closed | Account | Instrument | Side | Order type | Size | Entry | Exit | Thesis | Invalidation | Status | Result | Exchange reference |
|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|---:|---|
| manual-btc-buy-3 | 2026-09-11T00:47:10Z | open | paper (SimulatedBroker) | BTC/USDT | buy | market | 0.00833333 | 60028.27 (assumed reference price — no live feed available; see note) | — | Manual request: buy ~$500 of BTC to test the paper-execution path end to end | none defined — this was a mechanics test, not a strategy trade | filled | unrealized | order_id=1 (local SimulatedBroker, not an exchange order) |
| manual-btc-buy-1 | 2026-09-11T00:47:10Z | 2026-09-11T00:47:10Z | paper (SimulatedBroker) | BTC/USDT | buy | market | 0.5 | — | — | Manual request: buy 0.5 BTC paper | n/a | rejected — order_notional $30,000 > max_order_notional $10,000; projected position 30% > max_position_pct 25% | rejected, no fill | n/a |
| manual-btc-buy-2 | 2026-09-11T00:47:10Z | 2026-09-11T00:47:10Z | paper (SimulatedBroker) | BTC/USDT | buy | market | 0.2 | — | — | Manual request: buy 0.2 BTC paper | n/a | rejected — order_notional $12,000 > max_order_notional $10,000 | rejected, no fill | n/a |

**Note on reference price (corrected 2026-09-11):** all three fills above used an
assumed $60,000/BTC reference price at the time. That assumption was wrong — real
BTC/USDT data (fetched afterward via `mcp__Crypto_com__get_candlestick`, since Bybit
and Binance both geo-block this session's network) shows actual BTC/USDT was ~$76,800
on 2026-09-11. So `manual-btc-buy-3`'s "$500 buy" was actually undersized relative to
real price (~0.00833 BTC × $76,800 ≈ $640, not $500), and the two rejected orders
would have been rejected even harder against the real, higher price. This doesn't
change the mechanics conclusions (risk engine behaved correctly either way), but
don't use these three rows for anything P&L-related — they were never priced
against a real market.
