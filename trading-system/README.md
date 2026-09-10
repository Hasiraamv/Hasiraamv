# Crypto Trading System — Research / Backtest / Paper Trading

**PAPER TRADING ONLY.** This system never places a live order and never
requests a withdrawal-capable API key. Every order — from a signal, the
portfolio optimizer, a human, or the LLM agent — must pass through
[`app/risk/engine.py`](app/risk/engine.py) (`RiskEngine.approve`), the
single approval gate in the codebase. There is no other path to a fill.
The LLM (`app/llm`, `app/agent`) is advisory only: it proposes, a human
approves, and it is never called from the hot trading loop.

## Stack

Python 3.11, uv, FastAPI, SQLModel, PostgreSQL/TimescaleDB, Redis, CCXT,
polars/pandas/DuckDB/Parquet, LightGBM/XGBoost/scikit-learn (optional),
Riskfolio-Lib/PyPortfolioOpt/cvxpy (optional), vectorbt/Backtrader
(optional, event-driven engine included natively), LangGraph (optional),
Docker Compose, pytest, ruff, mypy.

Heavy ML/portfolio/agent dependencies are optional extras so the core
(config, models, risk engine, execution, backtest) runs with a light
install. See `pyproject.toml`.

## Setup

```bash
cd trading-system
python3.11 -m venv .venv && source .venv/bin/activate
pip install uv

# Core (risk engine, backtest, execution, data, API, LLM client)
uv pip install -e .

# Optional extras, as needed:
uv pip install -e ".[ml]"        # LightGBM, XGBoost, scikit-learn, MLflow
uv pip install -e ".[portfolio]" # Riskfolio-Lib, PyPortfolioOpt, cvxpy
uv pip install -e ".[backtest]"  # vectorbt, Backtrader (in addition to the built-in engine)
uv pip install -e ".[agent]"     # LangGraph, langchain-openai
uv pip install -e ".[dev]"       # pytest, ruff, mypy

cp .env.example .env  # fill in QWEN_* and, if using testnet, EXCHANGE_* (sandbox keys only)

docker compose up -d postgres redis
```

## Commands

```bash
# 0. Infra (Postgres/Timescale + Redis)
docker compose up -d postgres redis

# 1. Ingest OHLCV/trades/funding history (CCXT REST, reconnect + backoff, writes
#    Postgres + Parquet). --pair/--from/--to are accepted as aliases for
#    --symbol/--since/--to (an explicit end date, defaults to now).
python -m app data ingest --pair BTC/USDT --kind ohlcv --timeframe 1h --from 2024-01-01 --to 2025-01-01
python -m app data ingest --pair BTC/USDT --kind trades --from 2024-01-01
python -m app data ingest --pair BTC/USDT --kind funding --from 2024-01-01

# 1b. Stream OHLCV + trades over WS (ccxt.pro) and poll funding/open-interest over
#     REST for the whole symbol universe (BTC/USDT, ETH/USDT by default), each with
#     independent reconnect + backoff
python -m app data stream --symbols BTC/USDT ETH/USDT --timeframe 1m

# 2. Backtest — event-driven (fees, slippage, funding), every simulated order
#    passes through RiskEngine. --strategy is baseline_rsi_macd (no deps) or
#    lightgbm_walkforward / lgbm_baseline (same strategy, either name — retrains
#    on a schedule using only past data, via
#    app.signals.lgbm_strategy.LGBMWalkForwardSignalGenerator; needs the [ml]
#    extra). Funding rates previously ingested via `data ingest --kind funding`
#    are merged onto the bars automatically if present.
python -m app backtest --strategy baseline_rsi_macd --pair BTC/USDT --from 2024-01-01
python -m app backtest --strategy lgbm_baseline --pair BTC/USDT --from 2024-01-01

# 3. Paper trading — TESTNET ONLY. live data -> signal -> RiskEngine.approve
#    -> simulated fill (fees + slippage) -> log. Uses TestnetBroker (exchange
#    sandbox) if EXCHANGE_API_KEY + EXCHANGE_TESTNET=true are set, otherwise
#    the pure in-memory SimulatedBroker; refuses to start if a key is set
#    without EXCHANGE_TESTNET=true rather than silently falling back.
#    paper.yaml's symbols/strategy/poll_interval_seconds are all honored.
python -m app paper --config paper.yaml

# 4. Agent — Research -> Portfolio -> Risk-commentary -> Reporting, PROPOSE only
python -m app agent --task "daily report"

# 5. API + minimal dashboard (app.api:app and app.api.main:app both resolve)
uvicorn app.api:app --reload --port 8000
# http://localhost:8000/  and  http://localhost:8000/docs
```

## Daily Qwen report (scheduled)

`scripts/daily_report.sh` runs `python -m app agent --task "daily report"` and
writes the output to `logs/reports/<YYYY-MM-DD>.md`, always printing the
report path (even on failure, so cron/systemd logs point straight at the
detail) and exiting non-zero if the agent call failed — same propose-only
agent as above, nothing here places an order or changes config.

```bash
chmod +x scripts/daily_report.sh
./scripts/daily_report.sh   # run once by hand first to confirm QWEN_* env vars are set
```

**cron** (runs at 07:00 UTC daily; add via `crontab -e`):
```
0 7 * * * /absolute/path/to/trading-system/scripts/daily_report.sh >> /absolute/path/to/trading-system/logs/cron.log 2>&1
```

**systemd timer** (alternative to cron — put these in `/etc/systemd/system/`):
```ini
# daily-qwen-report.service
[Unit]
Description=Qwen daily trading report

[Service]
Type=oneshot
WorkingDirectory=/absolute/path/to/trading-system
ExecStart=/absolute/path/to/trading-system/scripts/daily_report.sh
```
```ini
# daily-qwen-report.timer
[Unit]
Description=Run the Qwen daily report every day at 07:00 UTC

[Timer]
OnCalendar=*-*-* 07:00:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
```
```bash
sudo systemctl enable --now daily-qwen-report.timer
systemctl list-timers daily-qwen-report.timer   # confirm it's scheduled
journalctl -u daily-qwen-report.service          # check a run's output
```

Either way, make sure `QWEN_BASE_URL`/`QWEN_API_KEY`/`QWEN_MODEL` are set in
the environment the scheduler runs under (cron and systemd don't source your
shell's `.bashrc` — put them in `.env` in this directory, which
`app.config.Settings` loads automatically, or in the systemd unit's
`Environment=`/`EnvironmentFile=`).

## LLM provider (Qwen, OpenAI-compatible)

Set `QWEN_BASE_URL`, `QWEN_API_KEY`, `QWEN_MODEL` directly, or set
`LLM_PROVIDER` to one of `openrouter | together | fireworks | deepinfra |
dashscope | ollama | vllm` to use its default base URL (`QWEN_BASE_URL`
still wins if set). Default model: `qwen2.5-72b-instruct` (or use
`qwen3-32b`). Tool calling is attempted first; on failure the client falls
back to strict JSON mode (see `app/llm/client.py`).

## Risk limits

Configured in `.env` / `app/config.py`, enforced in `app/risk/engine.py`:
max position % of equity, max leverage (hard-capped at 1x — spot only, no
leverage), max daily loss %, max drawdown %, max order notional, price
sanity band, and a kill switch that vetoes every order once tripped
(`POST /risk/kill-switch` or `RiskEngine.trip_kill_switch`).

## Audit trail

Every decision, order, rejection, fill and LLM call is logged as structured
JSON to stdout and appended to `logs/decisions.jsonl` via
`app.monitoring.logging_config.log_decision` — see `app/models/trading.py`
`Decision` for the durable DB-backed equivalent.

## Tests

```bash
uv pip install -e ".[dev]"
pytest
```

Covers: risk engine rejects an oversized/over-leveraged/over-drawdown/
kill-switched order, with every limit loaded the way `.env` actually loads
it (env vars, not code) and each one proven independently
(`tests/test_risk.py`), backtest sanity on synthetic data including
that funding accrues on every bar a position is held — not just bars
with a fill — and that a tight order-notional cap actually vetoes fills
end to end (`tests/test_backtest.py`), the LightGBM walk-forward strategy
— never trains on future data, retrains on schedule, and runs end to end
through the backtest engine (`tests/test_signals_lgbm.py`, needs the
`[ml]` extra — skipped otherwise), LLM client tool-calling and strict-JSON
fallback (`tests/test_llm_client.py`), settings validation, including
that leverage above 1x is rejected at the config layer
(`tests/test_config.py`), and the data layer — OHLCV/trades/funding
REST fetch + normalization, paginated backfill with reconnect/backoff,
WS streaming reconnect/backoff, and Postgres + Parquet persistence, all
against mocked CCXT/ccxt.pro with no network access
(`tests/test_data_ingest.py`), and the paper-trading loop — refuses to
build a broker against a live endpoint, routes every order through
RiskEngine.approve before it can reach the broker (verified a rejected
order never calls `broker.execute`), fills go through fees + slippage,
every signal/order decision is logged, and the polling loop keeps going
after a fetch error (`tests/test_paper.py`), and the agent layer — the
tool registry matches the spec exactly and none of it can reach
app.execution or app.risk.engine, propose_strategy only ever records a
PENDING proposal that stays pending until a human explicitly calls
approve_proposal (never the graph itself), the graph runs
Research → Portfolio → Risk-commentary → Reporting in order with each
node's own named role, and the compiled graph runs against the real
LangGraph library end to end (`tests/test_agent.py`, LLM fully mocked —
no network).

## Acceptance criteria mapping

| Criterion | How |
| --- | --- |
| Ingest 1 year BTC/USDT OHLCV | `python -m app data ingest --symbol BTC/USDT --kind ohlcv --timeframe 1h --since <1y ago>` |
| Run backtest end to end | `python -m app backtest --strategy lightgbm_walkforward --pair BTC/USDT --from <date>` (or `baseline_rsi_macd`) |
| Start paper trading on testnet | `python -m app paper --config paper.yaml` with `EXCHANGE_TESTNET=true` and sandbox `EXCHANGE_API_KEY`/`EXCHANGE_API_SECRET` set |
| Risk engine blocks an oversized order | `tests/test_risk.py::test_oversized_order_rejected` |
| Risk engine blocks an over-leveraged order | `tests/test_risk.py::test_leverage_cap_rejects_order_pushing_gross_notional_over_equity` |
| Risk engine blocks orders during a drawdown breach | `tests/test_risk.py::test_drawdown_breach_rejects_new_orders` |
| Every risk limit in `.env` is actually enforced | `tests/test_risk.py::test_every_limit_configured_via_env_is_enforced` |
| Agent produces a daily report using Qwen | `python -m app agent --task "daily report"` (requires `QWEN_*` env vars) |

## What is not implemented

- `POST /backtest/run` is a stub (501) pointing at the CLI — wire it to
  `app.backtest.engine.BacktestEngine` once a data source is chosen for
  the API path.
- `app/agent/tools.py:get_portfolio` returns an empty snapshot — wire to a
  real positions query once the paper-trading loop persists state to
  Postgres instead of in-memory.
- `summarize_news` is an inert placeholder pending a news/sentiment provider.
