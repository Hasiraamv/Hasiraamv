"""Tests for the LangGraph agent layer. The LLM is fully mocked (routed by
system-prompt content, since each role's `_run_role` call gets a distinct
one) so these run with no network access and no real Qwen/OpenAI-compatible
endpoint — the point is proving the graph wiring, tool dispatch, and the
propose-only / human-approval invariants, not the model's output quality.
"""
from __future__ import annotations

import inspect
from unittest.mock import patch

import pytest

import app.agent.tools as agent_tools
from app.agent.graph import AgentState, build_agent_graph, run_daily_report
from app.agent.tools import AGENT_TOOLS, TOOL_REGISTRY, approve_proposal, list_pending_proposals
from app.llm.client import LLMResponse


@pytest.fixture(autouse=True)
def _reset_pending_proposals():
    agent_tools._PENDING_PROPOSALS.clear()
    yield
    agent_tools._PENDING_PROPOSALS.clear()


class _FakeLLMClient:
    """Stands in for app.llm.client.LLMClient. Routes canned responses by
    the role-specific system prompt each node passes, and can be told to
    emit a tool call on a node's first turn."""

    def __init__(self, role: str | None = None, settings=None):
        self.role = role

    def chat(self, messages, tools=None, response_schema=None, max_retries=None):
        system = messages[0]["content"]
        # a tool result message means we're on a later turn of this node's loop
        already_used_tool = any(m.get("role") == "tool" for m in messages)

        if "Research agent" in system:
            return LLMResponse(content="BTC/USDT looks oversold on the daily.")
        if "Portfolio agent" in system:
            if not already_used_tool:
                return LLMResponse(
                    content=None,
                    tool_calls=[
                        {
                            "id": "call_1",
                            "name": "propose_strategy",
                            "arguments": {
                                "symbol": "BTC/USDT",
                                "description": "Buy the dip",
                                "rationale": "RSI oversold per research notes",
                                "suggested_params": {"rsi_window": 14},
                            },
                        }
                    ],
                )
            return LLMResponse(content="Proposed a strategy; awaiting human approval.")
        if "Risk-commentary agent" in system:
            return LLMResponse(content="Proposal is within max_position_pct; no concerns.")
        return LLMResponse(content="Daily report: research + portfolio + risk summarized above.")


def _patched_graph():
    return patch("app.agent.graph.LLMClient", _FakeLLMClient)


# =========================================================================
# Tool registry / schema — propose-only, no execution access
# =========================================================================


def test_tool_registry_matches_the_spec_exactly():
    assert set(TOOL_REGISTRY) == {
        "get_data",
        "run_backtest",
        "propose_strategy",
        "get_portfolio",
        "get_risk",
        "summarize_news",
    }


def test_agent_tools_schema_names_match_registry():
    schema_names = {t["function"]["name"] for t in AGENT_TOOLS}
    assert schema_names == set(TOOL_REGISTRY)


def test_no_tool_can_place_an_order_or_mutate_risk_limits():
    """Every tool the LLM can call is read-only or writes a PENDING proposal
    — none of them import or reach app.execution or app.risk.engine."""
    import app.agent.tools as tools_module

    source = inspect.getsource(tools_module)
    assert "app.execution" not in source
    assert "RiskEngine" not in source
    assert "approve_proposal" not in {t["function"]["name"] for t in AGENT_TOOLS}


def test_propose_strategy_only_records_a_pending_proposal():
    proposal = TOOL_REGISTRY["propose_strategy"](
        symbol="BTC/USDT", description="test", rationale="test", suggested_params={}
    )
    assert proposal["status"] == "pending_human_approval"
    assert list_pending_proposals() == [proposal]


def test_proposal_requires_explicit_human_approval_call():
    TOOL_REGISTRY["propose_strategy"](symbol="BTC/USDT", description="d", rationale="r", suggested_params={})
    assert list_pending_proposals()[0]["status"] == "pending_human_approval"

    approved = approve_proposal(0)
    assert approved["status"] == "approved"
    # nothing in the agent graph itself can reach approve_proposal — verified above


# =========================================================================
# Graph wiring
# =========================================================================


def test_graph_runs_research_portfolio_risk_reporting_in_order():
    with _patched_graph():
        result = run_daily_report("Produce the daily trading report.")

    assert "oversold" in result["research_notes"]
    assert "awaiting human approval" in result["portfolio_notes"]
    assert "max_position_pct" in result["risk_notes"]
    assert "Daily report" in result["report"]


def test_graph_surfaces_pending_proposals_without_auto_approving():
    with _patched_graph():
        result = run_daily_report("Produce the daily trading report.")

    assert len(result["pending_approvals"]) == 1
    proposal = result["pending_approvals"][0]
    assert proposal["kind"] == "strategy_proposal"
    assert proposal["status"] == "pending_human_approval"  # graph never approves it itself


def test_graph_produces_no_pending_proposals_when_none_are_made():
    class NoProposalLLMClient(_FakeLLMClient):
        def chat(self, messages, tools=None, response_schema=None, max_retries=None):
            system = messages[0]["content"]
            if "Portfolio agent" in system:
                return LLMResponse(content="No action warranted today.")
            return super().chat(messages, tools=tools, response_schema=response_schema, max_retries=max_retries)

    with patch("app.agent.graph.LLMClient", NoProposalLLMClient):
        result = run_daily_report("Produce the daily trading report.")

    assert result["pending_approvals"] == []


def test_build_agent_graph_compiles_with_real_langgraph():
    pytest.importorskip("langgraph")
    compiled = build_agent_graph()
    assert compiled is not None


def test_each_node_uses_its_own_named_role():
    seen_roles = []

    class RoleSpyLLMClient(_FakeLLMClient):
        def __init__(self, role=None, settings=None):
            super().__init__(role=role, settings=settings)
            seen_roles.append(role)

    with patch("app.agent.graph.LLMClient", RoleSpyLLMClient):
        run_daily_report("task")

    # one LLMClient constructed per node (the client instance is reused across
    # that node's own tool-calling turns, e.g. portfolio's propose_strategy call)
    assert seen_roles == ["research", "portfolio", "risk-commentary", "reporting"]


# =========================================================================
# CLI wiring: python -m app agent
# =========================================================================


def test_cli_agent_command_prints_report_and_pending_proposals(capsys):
    from app.__main__ import cmd_agent

    fake_state: AgentState = {
        "report": "Daily report text",
        "pending_approvals": [{"kind": "strategy_proposal", "status": "pending_human_approval"}],
    }

    class Args:
        task = "daily report"

    with patch("app.agent.graph.run_daily_report", return_value=fake_state):
        cmd_agent(Args())

    captured = capsys.readouterr()
    assert "Daily report text" in captured.out
    assert "1 proposal(s) awaiting human approval" in captured.err
