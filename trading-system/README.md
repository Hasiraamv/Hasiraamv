# Crypto Trading System — Research / Backtest / Paper Trading

**PAPER TRADING ONLY.** This system never places a live order and never
requests a withdrawal-capable API key. Every order — from a signal, the
portfolio optimizer, a human, or the LLM agent — must pass through
[`app/risk/engine.py`](app/risk/engine.py) (`RiskEngine.check_order`), the
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
# 1. Ingest OHLCV (CCXT REST, reconnect + backoff, writes Postgres + Parquet)
python -m app data ingest --symbol BTC/USDT --timeframe 1h --since 2024-01-01

# 2. Backtest — event-driven, every simulated order passes through RiskEngine
python -m app backtest --strategy baseline_rsi_macd --pair BTC/USDT --from 2024-01-01

# 3. Paper trading — data -> signal -> risk check -> simulated fill -> log
python -m app paper --config paper.yaml

# 4. Agent — Research -> Portfolio -> Risk-commentary -> Reporting, PROPOSE only
python -m app agent --task "daily report"

# API + minimal dashboard
uvicorn app.api.main:app --reload
# http://localhost:8000/  and  http://localhost:8000/docs
```

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

Covers: risk engine rejects an oversized/over-leveraged/kill-switched
order (`tests/test_risk.py`), backtest sanity on synthetic data
(`tests/test_backtest.py`), LLM client tool-calling and strict-JSON
fallback (`tests/test_llm_client.py`), and settings validation, including
that leverage above 1x is rejected at the config layer
(`tests/test_config.py`).

## Acceptance criteria mapping

| Criterion | How |
| --- | --- |
| Ingest 1 year BTC/USDT OHLCV | `python -m app data ingest --symbol BTC/USDT --timeframe 1h --since <1y ago>` |
| Run backtest end to end | `python -m app backtest --strategy baseline_rsi_macd --pair BTC/USDT --from <date>` |
| Start paper trading on testnet | `python -m app paper --config paper.yaml` with `EXCHANGE_TESTNET=true` and sandbox `EXCHANGE_API_KEY`/`EXCHANGE_API_SECRET` set |
| Risk engine blocks an oversized order | `tests/test_risk.py::test_oversized_order_rejected` |
| Agent produces a daily report using Qwen | `python -m app agent --task "daily report"` (requires `QWEN_*` env vars) |

## What is not implemented

- `POST /backtest/run` is a stub (501) pointing at the CLI — wire it to
  `app.backtest.engine.BacktestEngine` once a data source is chosen for
  the API path.
- `app/agent/tools.py:get_portfolio` returns an empty snapshot — wire to a
  real positions query once the paper-trading loop persists state to
  Postgres instead of in-memory.
- `summarize_news` is an inert placeholder pending a news/sentiment provider.
