"""Qwen (or any OpenAI-compatible endpoint) client.

The LLM is advisory only: it is used by app.agent to research, propose
portfolio changes, comment on risk, and write reports. It is NEVER called
from the hot trading/paper loop and NEVER given a path to place an order —
see app.risk.engine for the only order-approval path in this codebase.

Provider selection is entirely env-driven (QWEN_BASE_URL / QWEN_API_KEY /
QWEN_MODEL, optionally LLM_PROVIDER to pick a default base_url preset for
OpenRouter/Together/Fireworks/DeepInfra/DashScope/Ollama/vLLM) so swapping
providers never requires a code change.
"""
from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any

from app.config import Settings, get_settings
from app.monitoring.logging_config import get_logger, log_decision
from app.monitoring.metrics import LLM_CALLS, LLM_LATENCY

logger = get_logger(__name__)

ToolSchema = dict[str, Any]


@dataclass
class LLMResponse:
    content: str | None
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    parsed_json: dict[str, Any] | None = None
    used_json_fallback: bool = False
    raw: Any = None


class LLMError(RuntimeError):
    pass


class LLMClient:
    """Thin, provider-agnostic wrapper. Import of `openai` is lazy so the
    rest of the system (risk engine, backtest, etc.) never needs it installed."""

    def __init__(self, settings: Settings | None = None, role: str = "research"):
        self.settings = settings or get_settings()
        self.role = role
        self._client = None

    def _get_client(self):
        if self._client is None:
            from openai import OpenAI

            base_url = self.settings.llm_base_url()
            if not base_url:
                raise LLMError(
                    "No LLM base_url configured — set QWEN_BASE_URL or LLM_PROVIDER to a known preset"
                )
            self._client = OpenAI(
                base_url=base_url,
                api_key=self.settings.qwen_api_key or "unset",
                timeout=self.settings.llm_timeout_seconds,
            )
        return self._client

    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[ToolSchema] | None = None,
        response_schema: dict[str, Any] | None = None,
        max_retries: int | None = None,
    ) -> LLMResponse:
        """Try tool calling first (if `tools` given). On failure, or when no
        tools are supplied but `response_schema` is, fall back to strict JSON
        mode by instructing the model and parsing its output defensively."""
        max_retries = max_retries if max_retries is not None else self.settings.llm_max_retries
        model = self.settings.qwen_model
        last_error: Exception | None = None

        for attempt in range(1, max_retries + 1):
            start = time.monotonic()
            try:
                client = self._get_client()
                kwargs: dict[str, Any] = {"model": model, "messages": messages}
                if tools:
                    kwargs["tools"] = tools
                    kwargs["tool_choice"] = "auto"
                completion = client.chat.completions.create(**kwargs)
                elapsed = time.monotonic() - start
                LLM_LATENCY.labels(provider=self.settings.llm_provider).observe(elapsed)

                choice = completion.choices[0]
                message = choice.message
                tool_calls = [
                    {
                        "id": tc.id,
                        "name": tc.function.name,
                        "arguments": _safe_json_loads(tc.function.arguments),
                    }
                    for tc in (getattr(message, "tool_calls", None) or [])
                ]
                content = getattr(message, "content", None)
                parsed = _safe_json_loads(content) if (response_schema and content) else None

                self._log_call(model, "ok", attempt)
                return LLMResponse(content=content, tool_calls=tool_calls, parsed_json=parsed, raw=completion)

            except Exception as exc:  # noqa: BLE001 - provider SDKs raise many types
                last_error = exc
                logger.warning("llm_call_failed", extra={"extra_fields": {"attempt": attempt, "error": str(exc)}})
                if tools and attempt == max_retries:
                    # last resort: drop tool-calling and force strict JSON mode
                    return self._json_fallback(messages, response_schema, model)
                time.sleep(min(2 ** attempt, 10))

        self._log_call(model, "error", max_retries)
        raise LLMError(f"LLM call failed after {max_retries} attempts: {last_error}")

    def _json_fallback(
        self, messages: list[dict[str, Any]], response_schema: dict[str, Any] | None, model: str
    ) -> LLMResponse:
        schema_hint = json.dumps(response_schema) if response_schema else "a JSON object"
        fallback_messages = messages + [
            {
                "role": "system",
                "content": (
                    "Tool calling is unavailable. Respond with ONLY a single JSON object "
                    f"matching this schema, no prose, no markdown fences: {schema_hint}"
                ),
            }
        ]
        try:
            client = self._get_client()
            completion = client.chat.completions.create(model=model, messages=fallback_messages)
            content = completion.choices[0].message.content
            parsed = _safe_json_loads(content)
            self._log_call(model, "ok_json_fallback", 1)
            return LLMResponse(content=content, parsed_json=parsed, used_json_fallback=True, raw=completion)
        except Exception as exc:
            self._log_call(model, "error", 1)
            raise LLMError(f"JSON-mode fallback also failed: {exc}") from exc

    def _log_call(self, model: str, status: str, attempts: int) -> None:
        LLM_CALLS.labels(provider=self.settings.llm_provider, role=self.role, status=status).inc()
        log_decision(
            kind="llm_call",
            outcome=status,
            payload={"model": model, "role": self.role, "attempts": attempts},
            log_dir=self.settings.log_dir,
        )


def _safe_json_loads(text: str | None) -> dict[str, Any] | None:
    if not text:
        return None
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.removeprefix("json")
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return None
