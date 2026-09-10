"""Tools exposed to the LLM agent. Every one of these is read-only or
proposal-only — none of them can place an order, change a live position, or
touch risk limits directly. `propose_strategy` and `propose_config_change`
only ever write a *pending* proposal that a human must approve
(see app.agent.graph human_approval_gate) before anything downstream acts on it.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from app.config import get_settings
from app.monitoring.logging_config import log_decision

_PENDING_PROPOSALS: list[dict[str, Any]] = []


def get_data(symbol: str, timeframe: str = "1h", limit: int = 100) -> dict[str, Any]:
    """Read recent OHLCV bars for a symbol from the Parquet archive."""
    from app.data.storage import ParquetStore

    settings = get_settings()
    store = ParquetStore(settings.parquet_dir)
    df = store.read_ohlcv(settings.exchange_id, symbol, timeframe)
    tail = df.tail(limit).to_dicts() if hasattr(df, "tail") else []
    return {"symbol": symbol, "timeframe": timeframe, "bars": tail}


def run_backtest(strategy_name: str, symbol: str, since: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    """Kick off a backtest and return summary metrics. Purely informational —
    does not touch paper or live trading state."""
    return {
        "status": "not_implemented_in_tool_stub",
        "note": "Use `python -m app backtest --strategy ... --pair ... --from ...` for a full run; "
        "this tool exists so the agent can request one and summarize results in a report.",
        "strategy_name": strategy_name,
        "symbol": symbol,
        "since": since,
        "params": params or {},
    }


def propose_strategy(symbol: str, description: str, rationale: str, suggested_params: dict[str, Any]) -> dict[str, Any]:
    """Propose a new/changed strategy. Recorded as PENDING — requires human
    approval via app.agent.graph.human_approval_gate before it can be used."""
    proposal = {
        "kind": "strategy_proposal",
        "symbol": symbol,
        "description": description,
        "rationale": rationale,
        "suggested_params": suggested_params,
        "status": "pending_human_approval",
    }
    _PENDING_PROPOSALS.append(proposal)
    log_decision(kind="agent_action", symbol=symbol, outcome="proposed", payload=proposal)
    return proposal


def propose_config_change(field: str, current_value: Any, proposed_value: Any, rationale: str) -> dict[str, Any]:
    """Propose a change to a Settings field (e.g. a risk limit). Never applied
    automatically — always requires explicit human approval."""
    proposal = {
        "kind": "config_change_proposal",
        "field": field,
        "current_value": current_value,
        "proposed_value": proposed_value,
        "rationale": rationale,
        "status": "pending_human_approval",
    }
    _PENDING_PROPOSALS.append(proposal)
    log_decision(kind="agent_action", outcome="proposed", payload=proposal)
    return proposal


def get_portfolio() -> dict[str, Any]:
    """Read-only snapshot of current paper positions. No mutation possible here."""
    return {
        "note": "Wire to a live PortfolioState/DB snapshot in production; this is a read path only.",
        "positions": {},
    }


def get_risk() -> dict[str, Any]:
    """Read-only snapshot of current risk configuration and kill-switch state."""
    s = get_settings()
    return {
        "max_position_pct": s.max_position_pct,
        "max_leverage": s.max_leverage,
        "max_daily_loss_pct": s.max_daily_loss_pct,
        "max_drawdown_pct": s.max_drawdown_pct,
        "max_order_notional": s.max_order_notional,
        "kill_switch": s.kill_switch,
    }


def summarize_news(topic: str) -> dict[str, Any]:
    """Placeholder news/sentiment tool — wire to a real news API. Deliberately
    inert (no network call) until a provider + API key are configured."""
    return {"topic": topic, "summary": "News integration not configured.", "sentiment": 0.0}


def list_pending_proposals() -> list[dict[str, Any]]:
    return list(_PENDING_PROPOSALS)


def approve_proposal(index: int) -> dict[str, Any]:
    """Human-only entry point. Never called by the agent graph itself."""
    proposal = _PENDING_PROPOSALS[index]
    proposal["status"] = "approved"
    log_decision(kind="agent_action", outcome="human_approved", payload=proposal)
    return proposal


TOOL_REGISTRY: dict[str, Callable[..., Any]] = {
    "get_data": get_data,
    "run_backtest": run_backtest,
    "propose_strategy": propose_strategy,
    "get_portfolio": get_portfolio,
    "get_risk": get_risk,
    "summarize_news": summarize_news,
}


def _schema(name: str, description: str, properties: dict[str, Any], required: list[str]) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": properties, "required": required},
        },
    }


AGENT_TOOLS: list[dict[str, Any]] = [
    _schema(
        "get_data",
        "Fetch recent OHLCV bars for a symbol.",
        {
            "symbol": {"type": "string"},
            "timeframe": {"type": "string", "default": "1h"},
            "limit": {"type": "integer", "default": 100},
        },
        ["symbol"],
    ),
    _schema(
        "run_backtest",
        "Request a backtest summary for a strategy over a symbol and date range.",
        {
            "strategy_name": {"type": "string"},
            "symbol": {"type": "string"},
            "since": {"type": "string", "description": "ISO date"},
            "params": {"type": "object"},
        },
        ["strategy_name", "symbol", "since"],
    ),
    _schema(
        "propose_strategy",
        "Propose a new or changed trading strategy. Requires human approval before use.",
        {
            "symbol": {"type": "string"},
            "description": {"type": "string"},
            "rationale": {"type": "string"},
            "suggested_params": {"type": "object"},
        },
        ["symbol", "description", "rationale", "suggested_params"],
    ),
    _schema("get_portfolio", "Read the current paper-trading portfolio snapshot.", {}, []),
    _schema("get_risk", "Read the current risk engine configuration and kill-switch state.", {}, []),
    _schema(
        "summarize_news",
        "Summarize recent news/sentiment for a topic (placeholder until a provider is wired up).",
        {"topic": {"type": "string"}},
        ["topic"],
    ),
]
