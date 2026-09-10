import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

os.environ.setdefault("QWEN_BASE_URL", "https://example-llm.invalid/v1")
os.environ.setdefault("QWEN_API_KEY", "test-key")
os.environ.setdefault("LOG_DIR", "/tmp/trading-system-test-logs")
os.environ.setdefault("PARQUET_DIR", "/tmp/trading-system-test-parquet")

import pytest

from app.config import get_settings


@pytest.fixture(autouse=True)
def _reset_settings_between_tests():
    import app.config as config_module

    config_module._settings = None
    yield
    config_module._settings = None


@pytest.fixture
def settings():
    return get_settings()
