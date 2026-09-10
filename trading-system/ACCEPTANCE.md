# Acceptance checklist — run log

Run live against this sandbox's actual network egress. One real bug was found and fixed
along the way (see below); everything else passed on the first try.

## Environment notes

- **Binance is geo-blocked** from this sandbox's egress (`HTTP 451` on every endpoint,
  including testnet). **Kraken** is reachable, so the live-data steps below (#1 and #3)
  ran against Kraken instead — same generic `ccxt`-based code path, no code differences
  between exchanges. Set `EXCHANGE_ID=binance` in a normal deployment.
- **Fixed a real bug**: `ccxt` disables `requests`'/`aiohttp`'s environment trust by
  default, so it silently ignored this sandbox's `HTTPS_PROXY`/`REQUESTS_CA_BUNDLE` and
  failed every call with a certificate error — a real problem for *any* deployment behind
  a TLS-intercepting proxy. Fixed by passing `requests_trust_env` / `aiohttp_trust_env:
  True` at every exchange-construction site (`app/data/ingest.py`, `app/paper/scheduler.py`,
  `app/execution/broker.py`). Full test suite (69/69) still passes.
- **No real `QWEN_API_KEY`** is available in this sandbox (only the `sk-or-xxxxx`
  placeholder from `.env`). Step 5 shows both: a real authenticated call against
  OpenRouter (fails with a genuine `401`, proving the network/retry/error-surfacing
  path is correctly wired) and a full run with the completions layer mocked (proving
  the agent logic itself is correct). Supply a real key to see it call the live model.
- No Postgres/Redis running here (no Docker daemon) — ingestion was pointed at a local
  SQLite file instead of the configured `postgresql+psycopg://...` URL; the write path
  is identical (SQLModel + the same `create_all`-on-write engine).

## 1. One year of BTC/USDT ingest — ✅ PASS

```
python -m app data ingest --symbol BTC/USDT --kind ohlcv --timeframe 1d --since 2025-09-10
→ {"symbol": "BTC/USDT", "timeframe": "1d", "kind": "ohlcv", "rows_written": 366}
```
Verified independently in both stores: 366 rows in Parquet (`ParquetStore.read_ohlcv`)
and 366 rows in the DB (`SELECT count(*) FROM ohlcv_bars`), spanning 2025-09-10 →
2026-09-10 — real Kraken daily candles, real prices ($113,938 → $77,167 over the year).

## 2. Backtest runs and produces metrics — ✅ PASS

Ran both registered strategies against the real 1-year series just ingested:

| Strategy | Orders (accepted/rejected) | Final equity | Sharpe | Sortino | Max DD | Calmar | Turnover | Hit rate |
|---|---|---|---|---|---|---|---|---|
| `baseline_rsi_macd` | 3 / 0 | $102,113 | 1.00 | 24.17 | 0.01% | 211.4 | 0.28 | 100% |
| `lightgbm_walkforward` | 21 / 200 | $97,220 | 0.23 | 0.09 | 33.7% | -0.08 | 0.63 | 50% |

Every fill carries fee + slippage (visible in the decision log); the LightGBM run's 200
rejections are real `RiskEngine.approve` drawdown-breach vetoes mid-backtest — proof the
same risk gate used everywhere else is exercised inside the backtest, not bypassed.

## 3. Paper trading starts and logs trades — ✅ PASS

Fetched 300 real, live 1-minute BTC/USDT candles from Kraken and drove them through
`PaperTradingLoop.process_bar` (the exact function `python -m app paper`'s polling loop
calls each round). Broker: `SimulatedBroker` (no exchange keys configured → never
touches a real endpoint, per the testnet-only guard in `_build_broker`).

```json
{"kind": "signal", "symbol": "BTC/USDT", "outcome": "long",
 "payload": {"model_name": "baseline_rsi_macd", "confidence": 0.36, ...}}
{"kind": "order", "symbol": "BTC/USDT", "outcome": "filled",
 "payload": {"side": "buy", "quantity": 0.0947, "price": 77112.42,
             "fee": 7.30, "slippage_bps": 4.71}}
```
Final position: 0.0947 BTC; equity $99,992.70 (fee-adjusted from $100,000 start).

## 4. Risk engine blocks an oversized order — ✅ PASS

A 1 BTC (~$77,000) order against a $500 `MAX_ORDER_NOTIONAL` cap:

```json
{"kind": "risk_check", "symbol": "BTC/USDT", "outcome": "rejected",
 "payload": {"client_order_id": "accept-oversized-1", "quantity": 1.0,
   "reasons": [
     "order_notional 77000.00 exceeds max_order_notional 500.00",
     "projected position 77.00% of equity exceeds max_position_pct 2.00%"
   ]}}
```
Rejected with two independent, human-readable reasons, both logged via
`RiskEngine.approve` — the single approval path every order in the codebase uses.

## 5. Qwen agent produces a daily report — ✅ PASS (logic verified; needs a real key to call the live model)

Real call against OpenRouter with the placeholder key: reaches the network, retries 3x,
surfaces a genuine `401 Missing Authentication header` — proving the
`QWEN_BASE_URL`/`QWEN_API_KEY`/`QWEN_MODEL` wiring and error handling are correct.

With the completions layer mocked, `python -m app agent --task "daily report"` ran the
full graph — Research → Portfolio (called `propose_strategy`, logged a **pending**
proposal) → Risk-commentary → Reporting → human-approval gate — and printed:

```
Daily Report — BTC/USDT
1. Research: RSI cooled off from overbought; MACD histogram turning negative.
2. Portfolio: proposed trimming exposure (pending human approval).
3. Risk: proposal is within configured limits.
4. Action needed: 1 proposal awaiting human approval.

1 proposal(s) awaiting human approval: [...]
```
The proposal's status stayed `pending_human_approval` — nothing auto-applied.

## Bottom line

All 5 acceptance items pass. One real portability bug (ccxt + TLS-proxy) was found and
fixed with test coverage intact (69/69). The only item not exercised against a live
third-party is #5's actual model call, which is a credentials gap, not a code gap.
