"""Central settings. All secrets come from env vars / .env — never hardcoded."""
from __future__ import annotations

from pathlib import Path

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Presets for OpenAI-compatible LLM providers. QWEN_BASE_URL/QWEN_API_KEY always
# win when set explicitly; this only fills in a sane default base_url per provider.
LLM_PROVIDER_BASE_URLS = {
    "openrouter": "https://openrouter.ai/api/v1",
    "together": "https://api.together.xyz/v1",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "deepinfra": "https://api.deepinfra.com/v1/openai",
    "dashscope": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "ollama": "http://localhost:11434/v1",
    "vllm": "http://localhost:8000/v1",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- environment / mode -------------------------------------------------
    env: str = Field(default="development")
    trading_mode: str = Field(default="paper", description="Informational only — paper_trading_only is what's enforced.")
    paper_trading_only: bool = Field(default=True, description="Must always be True. Enforced in code, not just config.")

    # --- LLM (Qwen via OpenAI-compatible API) --------------------------------
    llm_provider: str = Field(default="dashscope", description="One of LLM_PROVIDER_BASE_URLS keys, informational only")
    qwen_base_url: str = Field(default="", alias="QWEN_BASE_URL")
    qwen_api_key: str = Field(default="", alias="QWEN_API_KEY")
    qwen_model: str = Field(default="qwen2.5-72b-instruct", alias="QWEN_MODEL")
    llm_timeout_seconds: float = Field(default=60.0)
    llm_max_retries: int = Field(default=3)

    # --- storage --------------------------------------------------------------
    database_url: str = Field(default="postgresql+psycopg://trader:trader@localhost:5432/trading")
    redis_url: str = Field(default="redis://localhost:6379/0")
    parquet_dir: Path = Field(default=Path("./data/parquet"))
    mlflow_tracking_uri: str = Field(default="./mlruns")

    # --- exchange (testnet / sandbox only — never live withdrawal keys) -------
    exchange_id: str = Field(default="binance", validation_alias=AliasChoices("EXCHANGE_ID", "EXCHANGE"))
    exchange_testnet: bool = Field(default=True)
    exchange_api_key: str = Field(default="")
    exchange_api_secret: str = Field(default="")

    # --- universe ---------------------------------------------------------------
    symbols: list[str] = Field(default_factory=lambda: ["BTC/USDT", "ETH/USDT"])

    # --- risk limits (hard caps enforced by app.risk.engine.RiskEngine) --------
    max_position_pct: float = Field(default=0.25, description="Max notional per symbol as fraction of equity")
    max_leverage: float = Field(default=1.0, description="Hard cap. Spot only, no leverage above 1x")
    max_daily_loss_pct: float = Field(default=0.03)
    max_drawdown_pct: float = Field(default=0.15)
    max_order_notional: float = Field(
        default=10_000.0, validation_alias=AliasChoices("MAX_ORDER_NOTIONAL", "MAX_ORDER_USD")
    )
    price_sanity_band_pct: float = Field(default=0.10, description="Reject orders priced this far from last mark")
    kill_switch: bool = Field(default=False, description="When True, RiskEngine vetoes every order")

    # --- monitoring -------------------------------------------------------------
    prometheus_port: int = Field(default=9100)
    log_level: str = Field(default="INFO")
    log_dir: Path = Field(default=Path("./logs"))

    @field_validator("max_leverage")
    @classmethod
    def _cap_leverage(cls, v: float) -> float:
        if v > 1.0:
            raise ValueError("max_leverage must be <= 1.0 — this system is spot-only, no leverage")
        return v

    @field_validator("paper_trading_only")
    @classmethod
    def _must_be_paper(cls, v: bool) -> bool:
        if not v:
            raise ValueError("paper_trading_only cannot be disabled")
        return v

    @field_validator("trading_mode")
    @classmethod
    def _trading_mode_must_be_paper(cls, v: str) -> str:
        if v.lower() != "paper":
            raise ValueError(f"trading_mode must be 'paper', got {v!r} — this system never places live orders")
        return v

    def llm_base_url(self) -> str:
        return self.qwen_base_url or LLM_PROVIDER_BASE_URLS.get(self.llm_provider, "")


_settings: Settings | None = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
    return _settings
