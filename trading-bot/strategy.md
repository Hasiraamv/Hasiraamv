## Strategy name

[Name — not yet defined]

## Status

Draft

## Instrument and timeframe

Instrument: [fill in — e.g. BTC/USDT]
Timeframe: [fill in]

## Entry conditions

All required conditions:
1. [condition]
2. [condition]
3. [condition]

## Invalidation

The trade thesis is invalid when:
[objective condition]

## Exit and profit management

Stop condition: [condition]
Profit condition: [condition]
Time based exit, if any: [condition]

## Position constraints

Maximum notional value: [amount — must be ≤ max_order_notional in trading-system config]
Maximum concurrent positions: [number]
Additional restrictions: [restrictions]

## Testing evidence

Back test period: not yet run — see `../trading-system` (`python -m app backtest --strategy baseline_rsi_macd --pair BTC/USDT --from <date>`) for the built-in baseline RSI/MACD strategy as a starting point.
Forward test period: none yet
Known limitations: no strategy has been backtested or forward-tested yet; all trades so far were manual, single-order paper tests, not a rule-based strategy.
