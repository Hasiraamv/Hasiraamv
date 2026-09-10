"""LangGraph multi-agent layer: Research -> Portfolio -> Risk-commentary ->
Reporting -> human approval gate. Every node is PROPOSE-only: none of them
holds a reference to app.execution or app.risk.engine's order-approval path,
so there is no code path from this graph to a real fill. Config/strategy
changes proposed here sit in app.agent.tools' pending-proposal list until a
human calls `approve_proposal` explicitly.

LangGraph is imported lazily — install with `pip install -e .[agent]`.
"""
from __future__ import annotations

from typing import Any, TypedDict

from app.agent.tools import AGENT_TOOLS, TOOL_REGISTRY, list_pending_proposals
from app.llm.client import LLMClient
from app.monitoring.logging_config import get_logger, log_decision

logger = get_logger(__name__)

MAX_TOOL_ITERATIONS = 4


class AgentState(TypedDict, total=False):
    task: str
    research_notes: str
    portfolio_notes: str
    risk_notes: str
    report: str
    pending_approvals: list[dict[str, Any]]


def _run_role(role: str, system_prompt: str, user_message: str, tools: list[dict[str, Any]] | None) -> str:
    client = LLMClient(role=role)
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_message},
    ]

    for _ in range(MAX_TOOL_ITERATIONS):
        response = client.chat(messages, tools=tools)
        if not response.tool_calls:
            return response.content or ""

        messages.append({"role": "assistant", "content": response.content or "", "tool_calls": [
            {"id": tc["id"], "type": "function", "function": {"name": tc["name"], "arguments": tc["arguments"]}}
            for tc in response.tool_calls
        ]})
        for tc in response.tool_calls:
            fn = TOOL_REGISTRY.get(tc["name"])
            try:
                result = fn(**(tc["arguments"] or {})) if fn else {"error": f"unknown tool {tc['name']}"}
            except Exception as exc:  # noqa: BLE001
                result = {"error": str(exc)}
            messages.append({"role": "tool", "tool_call_id": tc["id"], "content": str(result)})

    return "max tool iterations reached without a final answer"


def research_node(state: AgentState) -> AgentState:
    notes = _run_role(
        "research",
        "You are the Research agent for a paper-trading system. Use get_data and summarize_news "
        "to gather context. You may only read data — you cannot place orders or change config.",
        state["task"],
        [t for t in AGENT_TOOLS if t["function"]["name"] in ("get_data", "summarize_news")],
    )
    return {**state, "research_notes": notes}


def portfolio_node(state: AgentState) -> AgentState:
    notes = _run_role(
        "portfolio",
        "You are the Portfolio agent. Review the research notes and, if warranted, call "
        "propose_strategy — this only records a PENDING proposal for human review, it changes "
        "nothing live. You cannot place orders.",
        f"Research notes:\n{state.get('research_notes', '')}\n\nTask: {state['task']}",
        [t for t in AGENT_TOOLS if t["function"]["name"] in ("get_portfolio", "propose_strategy")],
    )
    return {**state, "portfolio_notes": notes}


def risk_commentary_node(state: AgentState) -> AgentState:
    notes = _run_role(
        "risk-commentary",
        "You are the Risk-commentary agent. Call get_risk to read current limits and comment on "
        "whether the portfolio agent's proposal (if any) looks consistent with those limits. You "
        "have no ability to change limits or approve/reject orders — the deterministic RiskEngine "
        "does that independently of you.",
        f"Portfolio notes:\n{state.get('portfolio_notes', '')}",
        [t for t in AGENT_TOOLS if t["function"]["name"] == "get_risk"],
    )
    return {**state, "risk_notes": notes}


def reporting_node(state: AgentState) -> AgentState:
    report = _run_role(
        "reporting",
        "You are the Reporting agent. Combine the research, portfolio and risk-commentary notes "
        "into a concise daily report for a human operator. Clearly flag any pending proposals that "
        "need approval.",
        (
            f"Research:\n{state.get('research_notes', '')}\n\n"
            f"Portfolio:\n{state.get('portfolio_notes', '')}\n\n"
            f"Risk commentary:\n{state.get('risk_notes', '')}"
        ),
        None,
    )
    return {**state, "report": report}


def human_approval_gate(state: AgentState) -> AgentState:
    """Terminal node. Surfaces pending proposals for a human to act on via
    app.agent.tools.approve_proposal — never auto-approves anything."""
    pending = list_pending_proposals()
    log_decision(kind="agent_action", outcome="awaiting_human_approval", payload={"count": len(pending)})
    return {**state, "pending_approvals": pending}


def build_agent_graph():
    from langgraph.graph import END, StateGraph

    graph = StateGraph(AgentState)
    graph.add_node("research", research_node)
    graph.add_node("portfolio", portfolio_node)
    graph.add_node("risk_commentary", risk_commentary_node)
    graph.add_node("reporting", reporting_node)
    graph.add_node("human_approval_gate", human_approval_gate)

    graph.set_entry_point("research")
    graph.add_edge("research", "portfolio")
    graph.add_edge("portfolio", "risk_commentary")
    graph.add_edge("risk_commentary", "reporting")
    graph.add_edge("reporting", "human_approval_gate")
    graph.add_edge("human_approval_gate", END)

    return graph.compile()


def run_daily_report(task: str = "Produce the daily trading report.") -> AgentState:
    app_graph = build_agent_graph()
    result = app_graph.invoke({"task": task})
    return result
