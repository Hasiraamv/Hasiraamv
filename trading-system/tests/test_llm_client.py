import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.config import Settings
from app.llm.client import LLMClient, LLMError


def _completion(content=None, tool_calls=None):
    message = SimpleNamespace(content=content, tool_calls=tool_calls or [])
    choice = SimpleNamespace(message=message)
    return SimpleNamespace(choices=[choice])


def _tool_call(name: str, arguments: dict, call_id: str = "call_1"):
    return SimpleNamespace(id=call_id, function=SimpleNamespace(name=name, arguments=json.dumps(arguments)))


def test_chat_returns_plain_content_when_no_tools_used():
    settings = Settings(qwen_base_url="https://fake.invalid/v1", qwen_api_key="k", qwen_model="qwen2.5-72b-instruct")
    client = LLMClient(settings=settings)

    fake_openai_client = MagicMock()
    fake_openai_client.chat.completions.create.return_value = _completion(content="hello world")

    with patch("app.llm.client.LLMClient._get_client", return_value=fake_openai_client):
        response = client.chat([{"role": "user", "content": "hi"}])

    assert response.content == "hello world"
    assert response.tool_calls == []
    assert not response.used_json_fallback


def test_chat_parses_tool_calls():
    settings = Settings(qwen_base_url="https://fake.invalid/v1", qwen_api_key="k")
    client = LLMClient(settings=settings)

    fake_openai_client = MagicMock()
    fake_openai_client.chat.completions.create.return_value = _completion(
        content=None, tool_calls=[_tool_call("get_risk", {})]
    )

    with patch("app.llm.client.LLMClient._get_client", return_value=fake_openai_client):
        response = client.chat([{"role": "user", "content": "check risk"}], tools=[{"type": "function"}])

    assert len(response.tool_calls) == 1
    assert response.tool_calls[0]["name"] == "get_risk"
    assert response.tool_calls[0]["arguments"] == {}


def test_tool_calling_failure_falls_back_to_strict_json():
    settings = Settings(qwen_base_url="https://fake.invalid/v1", qwen_api_key="k", llm_max_retries=1)
    client = LLMClient(settings=settings)

    fake_openai_client = MagicMock()
    # First call (with tools) raises — simulates a provider that rejects the tools param.
    # Second call (json fallback, no tools) succeeds with a JSON string.
    fake_openai_client.chat.completions.create.side_effect = [
        RuntimeError("this provider does not support tool calling"),
        _completion(content='{"direction": "long", "confidence": 0.7}'),
    ]

    with patch("app.llm.client.LLMClient._get_client", return_value=fake_openai_client):
        response = client.chat(
            [{"role": "user", "content": "propose a trade"}],
            tools=[{"type": "function"}],
            response_schema={"direction": "string", "confidence": "number"},
        )

    assert response.used_json_fallback
    assert response.parsed_json == {"direction": "long", "confidence": 0.7}


def test_json_fallback_handles_markdown_fenced_output():
    settings = Settings(qwen_base_url="https://fake.invalid/v1", qwen_api_key="k", llm_max_retries=1)
    client = LLMClient(settings=settings)

    fake_openai_client = MagicMock()
    fenced = "```json\n{\"ok\": true}\n```"
    fake_openai_client.chat.completions.create.side_effect = [
        RuntimeError("no tool support"),
        _completion(content=fenced),
    ]

    with patch("app.llm.client.LLMClient._get_client", return_value=fake_openai_client):
        response = client.chat(
            [{"role": "user", "content": "x"}], tools=[{"type": "function"}], response_schema={"ok": "boolean"}
        )

    assert response.parsed_json == {"ok": True}


def test_chat_raises_llm_error_after_exhausting_retries_without_tools():
    settings = Settings(qwen_base_url="https://fake.invalid/v1", qwen_api_key="k", llm_max_retries=2)
    client = LLMClient(settings=settings)

    fake_openai_client = MagicMock()
    fake_openai_client.chat.completions.create.side_effect = RuntimeError("down")

    with patch("app.llm.client.LLMClient._get_client", return_value=fake_openai_client), patch("time.sleep"):
        try:
            client.chat([{"role": "user", "content": "hi"}])
            assert False, "expected LLMError"
        except LLMError:
            pass
