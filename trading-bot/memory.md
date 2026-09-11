## Session memory index

Load order for any new session working on this bot:

1. `context.md` — who this is for, risk limits, constraints (fill in blanks before trading further)
2. `instructions.md` — operating rules, always in force
3. `strategy.md` — current strategy under test (baseline RSI/MACD + stop-loss wrapper, status Draft, 1-trade real backtest so far)
4. `ledger.md` — full trade history, append-only
5. `learnings.md` — reviewed lessons, pending manual approval before becoming rules
6. `reflections.md` — personal pre/post-trade notes

## State as of 2026-09-11

- Execution path: paper only, via `../trading-system` (`RiskEngine.approve` → `SimulatedBroker.execute`). No live orders have been placed.
- Exchange MCP: `bybit` server configured at `../.mcp.json` (official `bybit-official-trading-server`), but this session's network is geo-blocked by Bybit's CloudFront (confirmed on both authenticated and public endpoints) — cannot fetch live prices or place live orders from here right now.
- **A real Bybit mainnet API key + secret (trading-enabled) was typed directly into the chat transcript during setup.** It was stored in `../trading-system/.env` (gitignored, not committed) rather than repeated back, but it must be treated as compromised — rotate it on Bybit before ever using it for anything live.
- Strategy defined and backtested against REAL data: baseline RSI/MACD (`app/signals/baseline.py`) wrapped with a new stop-loss/take-profit module (`app/signals/risk_managed.py`, 4 passing unit tests). Backtested against 50 real daily BTC/USDT candles (2026-07-24 to 2026-09-11, sourced live via `mcp__Crypto_com__get_candlestick` since Bybit/Binance are geo-blocked here) — 1 trade closed, -$0.59 pnl. Sample size is far too small to call this validated; see strategy.md.
- **Found and fixed a real bug in `app/backtest/engine.py`** while building the stop-loss wrapper: closing a position to exactly flat was silently not realizing P&L (only a full flip through zero to the opposite side triggered it). This is fixed now — all 25 repo tests still pass — but means any backtest run before 2026-09-11 in this repo may have understated realized losses on any fully-closed position. Worth knowing if `trading-system`'s own historical test/acceptance runs are ever cited as evidence.
- Next reasonable steps, not yet done: (1) rotate the exposed key — still not done, still needed regardless of anything else, (2) get real historical data beyond 50 bars (this session's only reachable source caps there) for an actual statistically meaningful backtest, (3) fill in the remaining personal blanks in `context.md` (excluded assets, review times), (4) paper-forward-test for real days/weeks once the backtest sample is large enough to mean something, (5) only then revisit going live, from a non-geo-blocked environment, with explicit per-order confirmation as required by `instructions.md`.
