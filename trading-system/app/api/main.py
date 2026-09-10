"""FastAPI app: health, read-only portfolio/risk endpoints, a backtest
trigger, an agent-report trigger, and a minimal HTML dashboard. No endpoint
here can place a live order — /backtest/run only runs the simulated
backtest engine, and /agent/report only produces advisory text plus
pending proposals a human still has to approve.
"""
from __future__ import annotations

from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.agent.tools import list_pending_proposals
from app.config import get_settings
from app.risk.engine import RiskEngine

app = FastAPI(title="Trading System API", description="Paper trading only. No live order endpoint exists.")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "mode": "paper"}


@app.get("/risk")
def get_risk() -> dict[str, float | bool]:
    s = get_settings()
    return {
        "max_position_pct": s.max_position_pct,
        "max_leverage": s.max_leverage,
        "max_daily_loss_pct": s.max_daily_loss_pct,
        "max_drawdown_pct": s.max_drawdown_pct,
        "max_order_notional": s.max_order_notional,
        "kill_switch": s.kill_switch,
    }


class KillSwitchRequest(BaseModel):
    reason: str


@app.post("/risk/kill-switch")
def trip_kill_switch(req: KillSwitchRequest) -> dict[str, str]:
    RiskEngine().trip_kill_switch(req.reason)
    return {"status": "kill_switch_engaged", "reason": req.reason}


@app.get("/portfolio")
def get_portfolio() -> dict[str, str]:
    return {"note": "Wire to a live positions table for a real snapshot."}


class BacktestRequest(BaseModel):
    symbol: str
    since: date
    strategy: str = "baseline_rsi_macd"


@app.post("/backtest/run")
def run_backtest_endpoint(req: BacktestRequest) -> dict[str, str]:
    raise HTTPException(
        status_code=501,
        detail="Use `python -m app backtest --strategy ... --pair ... --from ...` for a full run "
        "with real OHLCV data; wire this endpoint to app.backtest.engine.BacktestEngine once a "
        "data source is configured.",
    )


@app.get("/agent/proposals")
def get_agent_proposals() -> list[dict]:
    return list_pending_proposals()


@app.get("/", response_class=HTMLResponse)
def dashboard() -> str:
    s = get_settings()
    return f"""
    <html>
      <head><title>Trading System — Paper Mode</title></head>
      <body style="font-family: sans-serif; max-width: 720px; margin: 2rem auto;">
        <h1>Trading System</h1>
        <p><strong>Mode:</strong> PAPER TRADING ONLY</p>
        <ul>
          <li>Kill switch: {"ENGAGED" if s.kill_switch else "off"}</li>
          <li>Max position %: {s.max_position_pct:.0%}</li>
          <li>Max leverage: {s.max_leverage}x</li>
          <li>Symbols: {", ".join(s.symbols)}</li>
        </ul>
        <p>API docs at <a href="/docs">/docs</a>.</p>
      </body>
    </html>
    """
