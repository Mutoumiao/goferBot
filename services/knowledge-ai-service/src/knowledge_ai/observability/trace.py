"""Lightweight trace context + secret redaction."""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger("knowledge_ai.trace")

_SECRET_KEYS = frozenset(
    {
        "embedding_api_key",
        "rerank_api_key",
        "llm_api_key",
        "api_key",
        "authorization",
    }
)


def redact_provider_secrets(payload: Any) -> Any:
    """Strip *_api_key and common secret fields from dict-like payloads."""
    if isinstance(payload, dict):
        out: dict[str, Any] = {}
        for k, v in payload.items():
            key_l = str(k).lower()
            if key_l in _SECRET_KEYS or key_l.endswith("_api_key"):
                out[k] = "***REDACTED***"
            else:
                out[k] = redact_provider_secrets(v)
        return out
    if isinstance(payload, list):
        return [redact_provider_secrets(x) for x in payload]
    return payload


@dataclass
class Span:
    name: str
    start_ms: float
    end_ms: float | None = None
    attributes: dict[str, Any] = field(default_factory=dict)
    status: str = "ok"

    def finish(self, status: str = "ok", **attrs: Any) -> None:
        self.end_ms = time.perf_counter() * 1000
        self.status = status
        self.attributes.update(attrs)

    @property
    def duration_ms(self) -> float | None:
        if self.end_ms is None:
            return None
        return self.end_ms - self.start_ms


@dataclass
class TraceContext:
    trace_id: str
    spans: list[Span] = field(default_factory=list)
    degraded: bool = False
    attributes: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(cls, trace_id: str | None = None) -> TraceContext:
        return cls(trace_id=trace_id or str(uuid.uuid4()))

    @contextmanager
    def span(self, name: str, **attrs: Any):
        s = Span(name=name, start_ms=time.perf_counter() * 1000, attributes=dict(attrs))
        self.spans.append(s)
        try:
            yield s
            if s.end_ms is None:
                s.finish("ok")
        except Exception as e:
            s.finish("error", error=type(e).__name__)
            raise

    def mark_degraded(self, reason: str) -> None:
        self.degraded = True
        self.attributes["degraded_reason"] = reason
        logger.warning("trace_id=%s degraded: %s", self.trace_id, reason)

    def log_summary(self) -> None:
        safe = redact_provider_secrets(self.attributes)
        span_summary = [
            {
                "name": s.name,
                "ms": round(s.duration_ms or 0, 2),
                "status": s.status,
                "attrs": redact_provider_secrets(s.attributes),
            }
            for s in self.spans
        ]
        logger.info(
            "trace_id=%s degraded=%s attrs=%s spans=%s",
            self.trace_id,
            self.degraded,
            safe,
            span_summary,
        )
