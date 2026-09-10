import pytest
from pydantic import ValidationError

from app.config import Settings


def test_default_settings_load(settings):
    assert settings.paper_trading_only is True
    assert settings.max_leverage <= 1.0
    assert settings.symbols  # non-empty universe


def test_leverage_above_1x_is_rejected():
    with pytest.raises(ValidationError):
        Settings(max_leverage=2.0)


def test_paper_trading_only_cannot_be_disabled():
    with pytest.raises(ValidationError):
        Settings(paper_trading_only=False)


def test_llm_base_url_prefers_explicit_qwen_base_url():
    s = Settings(qwen_base_url="https://explicit.example/v1", llm_provider="dashscope")
    assert s.llm_base_url() == "https://explicit.example/v1"


def test_llm_base_url_falls_back_to_provider_preset():
    s = Settings(qwen_base_url="", llm_provider="ollama")
    assert "11434" in s.llm_base_url()
