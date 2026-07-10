"""Optional Langfuse adapter — no-op when env not configured."""

from __future__ import annotations

import logging
from typing import Any

from knowledge_ai.config import Settings, get_settings
from knowledge_ai.observability.trace import TraceContext, redact_provider_secrets

logger = logging.getLogger("knowledge_ai.langfuse")


class LangfuseAdapter:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._enabled = bool(
            self.settings.langfuse_public_key and self.settings.langfuse_secret_key
        )
        if self._enabled:
            logger.info("Langfuse adapter enabled (host=%s)", self.settings.langfuse_host)
        else:
            logger.debug("Langfuse not configured; skipping export")

    @property
    def enabled(self) -> bool:
        return self._enabled

    def export_trace(self, trace: TraceContext, name: str = "knowledge:query") -> None:
        if not self._enabled:
            return
        # Phase 1: log intent only; full SDK wiring is optional enhancement.
        # Avoid importing langfuse package as hard dependency when keys absent.
        payload = {
            "name": name,
            "trace_id": trace.trace_id,
            "degraded": trace.degraded,
            "attributes": redact_provider_secrets(trace.attributes),
            "spans": [
                {
                    "name": s.name,
                    "duration_ms": s.duration_ms,
                    "status": s.status,
                    "attributes": redact_provider_secrets(s.attributes),
                }
                for s in trace.spans
            ],
        }
        logger.info("langfuse_export %s", payload)

    def try_export(self, trace: TraceContext, name: str = "knowledge:query") -> None:
        try:
            self.export_trace(trace, name=name)
        except Exception:
            logger.exception("Langfuse export failed (non-fatal)")
