"""Prometheus metrics. Import is safe even if prometheus_client is absent —
metrics become no-ops so the rest of the system never depends on monitoring
being installed."""
from __future__ import annotations

try:
    from prometheus_client import Counter, Histogram, start_http_server

    ORDERS_SUBMITTED = Counter("orders_submitted_total", "Orders submitted to the risk engine", ["symbol", "side"])
    ORDERS_REJECTED = Counter("orders_rejected_total", "Orders vetoed by the risk engine", ["symbol", "reason"])
    ORDERS_FILLED = Counter("orders_filled_total", "Orders filled by the simulated/testnet broker", ["symbol", "side"])
    LLM_CALLS = Counter("llm_calls_total", "LLM calls made", ["provider", "role", "status"])
    LLM_LATENCY = Histogram("llm_call_latency_seconds", "LLM call latency", ["provider"])

    def start_metrics_server(port: int) -> None:
        start_http_server(port)

except ImportError:  # pragma: no cover - exercised only without the dependency

    class _NoOpMetric:
        def labels(self, *_a, **_k) -> _NoOpMetric:
            return self

        def inc(self, *_a, **_k) -> None:
            return None

        def observe(self, *_a, **_k) -> None:
            return None

    ORDERS_SUBMITTED = _NoOpMetric()
    ORDERS_REJECTED = _NoOpMetric()
    ORDERS_FILLED = _NoOpMetric()
    LLM_CALLS = _NoOpMetric()
    LLM_LATENCY = _NoOpMetric()

    def start_metrics_server(port: int) -> None:
        return None
