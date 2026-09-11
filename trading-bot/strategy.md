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

Back test period: not yet run. To actually validate this before trusting it with real
money:
```
cd trading-system
python -m app data ingest --pair BTC/USDT --kind ohlcv --timeframe 1h --from 2024-01-01 --to 2025-01-01
python -m app backtest --strategy baseline_rsi_macd --pair BTC/USDT --from 2024-01-01
```
Forward test period: none yet — would be `python -m app paper --config paper.yaml`
against Bybit/Binance testnet once a backtest looks reasonable.
Known limitations: unit tests only prove the code runs correctly against synthetic
oscillating data (`tests/test_backtest.py`), not that the strategy is profitable
against real market history. No backtest, no forward test, no live/paper track
record exists yet for this specific strategy. Treat "Draft" as accurate — nothing here
is evidence of future returns.
