## Strategy name

Baseline RSI/MACD Mean-Reversion — this is `trading-system/app/signals/baseline.py`'s
`BaselineSignalGenerator`, the repo's existing dependency-free strategy. Using it here
instead of inventing a new one because it's the only strategy in this codebase that's
actually implemented and unit-tested (`tests/test_backtest.py`, `tests/test_paper.py`).

## Status

Draft — implemented and unit-tested in isolation, but **not yet backtested against
real historical data** in this session (would need `python -m app data ingest` against
real OHLCV first; not run here — see Testing evidence below for the exact command).
Do not treat this as validated until that's done.

## Instrument and timeframe

Instrument: BTC/USDT
Timeframe: 1h (matches the repo's README example command; can be changed)

## Entry conditions

All required conditions (exact logic, from `BaselineSignalGenerator.__call__`):
1. RSI(14) < 30 (oversold)
2. MACD histogram (12/26/9 EMA, default `macd()` params) > 0 (bullish momentum turn)
3. At least 15 bars of history available (rsi_window + 1), so the indicator isn't computed on too little data

When both 1 and 2 hold → LONG signal, confidence scaled by how far below 30 the RSI is
(capped at 1.0). Symmetric SHORT signal exists (RSI > 70 and MACD histogram < 0) but
see the caveat below — this system is spot-only.

## Invalidation

The trade thesis is invalid when:
RSI crosses back above 30 without the position having reached profit target, or MACD
histogram turns negative before RSI recovers — i.e., the "bounce from oversold" thesis
didn't play out. (This is inferred from the entry logic, not an explicit rule the code
enforces — the strategy re-evaluates every bar rather than tracking per-trade
invalidation state.)

## Exit and profit management

Stop condition: none coded — the strategy has no explicit stop-loss; the only backstop
is `RiskEngine`'s account-level `max_daily_loss_pct` (3%) and `max_drawdown_pct` (15%)
circuit breakers, which halt *all* new orders, not this specific position.
Profit condition: position is closed/reduced only when a new SHORT signal fires
(RSI > 70, MACD hist < 0) — there's no fixed take-profit level.
Time based exit, if any: none.

**Caveat — this strategy has no per-trade risk management.** If you want stop-loss/
take-profit behavior, that needs to be added to `app/paper/scheduler.py` or a new
signal generator; right now it's pure signal-flip exit.

## Position constraints

Maximum notional value: sized as `equity * max_position_pct * signal.confidence`
in `app/paper/scheduler.py` — with the $150 capital noted in `context.md` and default
`max_position_pct` 25%, that's at most ~$37.50 per position at full confidence. (Note:
the repo's default `max_order_notional` cap of $10,000 is irrelevant at this account
size — it was tuned for a $100,000 test equity. See the observation already logged in
`learnings.md`.)
Maximum concurrent positions: 1 per symbol (scheduler tracks one position per symbol;
running BTC/USDT and ETH/USDT simultaneously would be 2 total)
Additional restrictions: spot only, no leverage (hard-capped at 1x in
`app/config.py`); SHORT signals reduce/flip a position rather than opening a real
margin short — do not enable actual short-selling for mainnet without separately
verifying the exchange/account supports it, since this simulation doesn't model that
constraint.

## Testing evidence

**Back test run 2026-09-11** — real BTC/USDT daily candles (not synthetic), source:
Crypto.com public market data via MCP (`mcp__Crypto_com__get_candlestick`, the only
reachable live data source this session had — Bybit and Binance both geo-block this
container; see README.md/memory.md). Data saved at
`trading-bot/data/btcusdt_1d_20260724_20260911.json` (50 daily bars, 2026-07-24 to
2026-09-11).

Run via `BacktestEngine` directly (`app.backtest.engine`), `starting_equity=150.0`
matching context.md, `max_position_pct=0.25`, `max_order_notional=1000` (lowered from
the repo's $10,000 default, which is irrelevant at $150 equity):

| Metric | Value |
|---|---|
| Bars used | 50 |
| Orders accepted | 1 |
| Orders rejected | 0 |
| Trades closed | 0 |
| Equity start → end | $150.00 → $149.99 |
| Total return | -0.01% |
| Sharpe / Sortino | -2.73 / 0.00 |
| Max drawdown | 0.01% |
| Hit rate | 0% (0 closed trades) |

**This is not a meaningful result, and I'm not presenting it as one.** Only one
signal fired in the entire 50-bar window (RSI(14) + MACD need ~35 bars of warmup
before either indicator is even valid, leaving ~15 usable bars), and that one
position never closed before the data ran out — so there are zero completed trades
to compute a real hit rate, Sharpe, or return from. The numbers above are what the
engine outputs, not evidence the strategy works or doesn't.

**What this run actually proved:** the pipeline itself works end to end against real
market data (fetch → signal → risk check → simulated fill → metrics), which is real
progress. It did not validate the strategy — that needs materially more history.

Forward test period: none yet — would be `python -m app paper --config paper.yaml`
once a real backtest looks reasonable.
Known limitations: (1) no data source reachable from this session provides more than
~50 bars/candles of history (Crypto.com MCP caps at 50; Bybit/Binance direct APIs are
geo-blocked here) — a real validation needs months of history from elsewhere (a paid
data vendor, or running `app data ingest` from a non-blocked location/exchange).
(2) The strategy has no per-trade stop-loss (see Exit section above), so even a
longer backtest would only be evaluating entries, not real risk-adjusted performance.
(3) Unit tests only prove the code runs correctly against synthetic oscillating data
(`tests/test_backtest.py`), not that the strategy is profitable. Treat "Draft" as
accurate — nothing here is evidence of future returns.
