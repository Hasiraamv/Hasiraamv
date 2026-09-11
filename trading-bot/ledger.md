## Trade ledger

| Trade ID | Opened | Closed | Account | Instrument | Side | Order type | Size | Entry | Exit | Thesis | Invalidation | Status | Result | Exchange reference |
|---|---|---|---|---|---|---|---:|---:|---:|---|---|---|---:|---|
| manual-btc-buy-3 | 2026-09-11T00:47:10Z | open | paper (SimulatedBroker) | BTC/USDT | buy | market | 0.00833333 | 60028.27 (assumed reference price — no live feed available; see note) | — | Manual request: buy ~$500 of BTC to test the paper-execution path end to end | none defined — this was a mechanics test, not a strategy trade | filled | unrealized | order_id=1 (local SimulatedBroker, not an exchange order) |
| manual-btc-buy-1 | 2026-09-11T00:47:10Z | 2026-09-11T00:47:10Z | paper (SimulatedBroker) | BTC/USDT | buy | market | 0.5 | — | — | Manual request: buy 0.5 BTC paper | n/a | rejected — order_notional $30,000 > max_order_notional $10,000; projected position 30% > max_position_pct 25% | rejected, no fill | n/a |
| manual-btc-buy-2 | 2026-09-11T00:47:10Z | 2026-09-11T00:47:10Z | paper (SimulatedBroker) | BTC/USDT | buy | market | 0.2 | — | — | Manual request: buy 0.2 BTC paper | n/a | rejected — order_notional $12,000 > max_order_notional $10,000 | rejected, no fill | n/a |

**Note on reference price:** all fills above used an assumed $60,000/BTC reference price, not a live quote — this session's network cannot reach Bybit (geo-blocked, confirmed on both authenticated and public endpoints). Treat fill prices/quantities as illustrative of the execution mechanics only, not real market data. Re-run once live market data is reachable before trusting any P&L number here.
