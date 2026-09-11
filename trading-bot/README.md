# Trading Bot — Execution Layer + Trade Memory

A local memory and operating-rules layer for AI-assisted crypto trading,
following the "AI trading execution bot" architecture: Claude Code as the
reasoning/instruction interface, an exchange MCP server as the connection
layer, and Markdown files as durable context/ledger/memory.

## Current status: PAPER TRADING ONLY

This bot is configured for paper trading right now. Do not wire it to
live order submission until:

1. The Bybit API key that was previously typed into chat has been
   **rotated** on Bybit's side (it must be treated as compromised —
   anything pasted into a chat transcript is no longer a secret).
2. This machine/session can actually reach Bybit's API (the current
   remote container is geo-blocked by Bybit's CloudFront distribution,
   confirmed on both authenticated and public endpoints).
3. You've explicitly asked to go live, understanding every order
   executes with real funds.

Until then, execution defaults to `../trading-system`'s existing,
already-tested paper-trading path: `RiskEngine.approve` →
`SimulatedBroker.execute` — deterministic risk checks, no network call,
no real money, full audit log at `../trading-system/logs/decisions.jsonl`.

## Files

| File | Purpose |
|---|---|
| `context.md` | Account type, objectives, risk limits, personal constraints |
| `instructions.md` | Operating rules the agent must follow every session |
| `strategy.md` | The specific strategy being tested (fill in before trading) |
| `ledger.md` | Every order submitted and its outcome |
| `learnings.md` | Reviewed, human-approved lessons from closed trades |
| `reflections.md` | Personal pre/post-trade reflection prompts |
| `memory.md` | Index/summary tying the above together for the agent to load each session |

## Exchange connection

MCP config lives at the repo root: `../.mcp.json` (server name `bybit`,
package `bybit-official-trading-server`). Credentials are read from
environment variables, not committed. See `context.md` and
`instructions.md` before enabling live trading through it.
