"""Structured (JSON) logging + an append-only decision audit trail.

Every order, rejection, LLM call and agent action must go through
`log_decision` so there is a durable record independent of the DB (falls
back to a local JSONL file when no DB session is available, e.g. in tests).
"""
from __future__ import annotations

import json
import logging
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)
        extra = getattr(record, "extra_fields", None)
        if extra:
            payload.update(extra)
        return json.dumps(payload, default=str)


def configure_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    if root.handlers:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(level)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


_decision_logger = logging.getLogger("app.decisions")


def log_decision(
    kind: str,
    payload: dict[str, Any],
    *,
    symbol: str | None = None,
    outcome: str | None = None,
    log_dir: Path | None = None,
) -> None:
    """Append-only audit log for every decision/order/rejection/LLM call.

    Writes to the JSONL audit file (always) and to the structured logger
    (always). A DB-backed Decision row can additionally be written by
    callers that hold a session — this function never requires one, so it
    works from anywhere, including the hot paper-trading loop.
    """
    record = {
        "ts": datetime.now(UTC).isoformat(),
        "kind": kind,
        "symbol": symbol,
        "outcome": outcome,
        "payload": payload,
    }
    _decision_logger.info("decision", extra={"extra_fields": record})

    log_dir = log_dir or Path("./logs")
    log_dir.mkdir(parents=True, exist_ok=True)
    with (log_dir / "decisions.jsonl").open("a") as fh:
        fh.write(json.dumps(record, default=str) + "\n")
