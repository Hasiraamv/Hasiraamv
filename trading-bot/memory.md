## Session memory index

Load order for any new session working on this bot:

1. `context.md` — who this is for, risk limits, constraints (fill in blanks before trading further)
2. `instructions.md` — operating rules, always in force
3. `strategy.md` — current strategy under test (currently: none defined, status Draft)
4. `ledger.md` — full trade history, append-only
5. `learnings.md` — reviewed lessons, pending manual approval before becoming rules
6. `reflections.md` — personal pre/post-trade notes

## State as of 2026-09-11

- Execution path: paper only, via `../trading-system` (`RiskEngine.approve` → `SimulatedBroker.execute`). No live orders have been placed.
- Exchange MCP: `bybit` server configured at `../.mcp.json` (official `bybit-official-trading-server`), but this session's network is geo-blocked by Bybit's CloudFront (confirmed on both authenticated and public endpoints) — cannot fetch live prices or place live orders from here right now.
- **A real Bybit mainnet API key + secret (trading-enabled) was typed directly into the chat transcript during setup.** It was stored in `../trading-system/.env` (gitignored, not committed) rather than repeated back, but it must be treated as compromised — rotate it on Bybit before ever using it for anything live.
- No strategy has been defined or backtested yet — all trades in `ledger.md` are manual mechanics tests (0.5 BTC and 0.2 BTC rejected by risk caps, $500 BTC filled at an assumed, non-live reference price).
- Next reasonable steps, not yet done: (1) rotate the exposed key, (2) fill in `context.md` and `strategy.md`, (3) run a real backtest in `trading-system` against historical data before any live consideration, (4) only then revisit going live, from a non-geo-blocked environment, with explicit per-order confirmation as required by `instructions.md`.
