"""Must-Merged L1: single LLM call → structured understanding."""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field

import httpx

from knowledge_ai.prompts.defaults import UNDERSTANDING_PROMPT
from knowledge_ai.schemas import HistoryMessage, PromptsConfig, ProviderConfig

logger = logging.getLogger("knowledge_ai.understanding")


@dataclass
class UnderstandingResult:
    intent: str = "qa"
    rewritten_query: str = ""
    keywords: list[str] = field(default_factory=list)
    raw: dict | None = None


class MergedUnderstanding:
    """
    Phase 1 Must-Merged: at most one understanding LLM call per request.
    Module is unit-testable with a mock httpx / injected client.
    """

    def __init__(
        self,
        provider: ProviderConfig | None = None,
        prompts: PromptsConfig | None = None,
        *,
        http_client: httpx.AsyncClient | None = None,
        timeout: float = 30.0,
    ):
        self.provider = provider or ProviderConfig()
        self.prompts = prompts or PromptsConfig()
        self._client = http_client
        self.timeout = timeout

    async def understand(
        self,
        query: str,
        history: list[HistoryMessage] | None = None,
    ) -> UnderstandingResult:
        history = history or []
        if not self.provider.llm_api_key:
            # Offline / test fallback without multi-step LLM
            return UnderstandingResult(
                intent="qa",
                rewritten_query=query.strip(),
                keywords=_simple_keywords(query),
            )

        system = self.prompts.understanding or UNDERSTANDING_PROMPT
        user_payload = {
            "query": query,
            "history": [{"role": h.role, "content": h.content} for h in history[-10:]],
        }
        content = await self._single_llm_call(system, json.dumps(user_payload, ensure_ascii=False))
        return _parse_understanding(content, fallback_query=query)

    async def _single_llm_call(self, system: str, user: str) -> str:
        """Exactly one chat completions request (retries are transport-level only)."""
        base = (self.provider.llm_base_url or "https://api.openai.com/v1").rstrip("/")
        url = f"{base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.provider.llm_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.provider.llm_model or "gpt-4o-mini",
            "temperature": 0,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "response_format": {"type": "json_object"},
        }
        owns_client = self._client is None
        client = self._client or httpx.AsyncClient(timeout=self.timeout)
        try:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
        finally:
            if owns_client:
                await client.aclose()


def _parse_understanding(content: str, fallback_query: str) -> UnderstandingResult:
    try:
        # strip markdown fences if any
        text = content.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
        return UnderstandingResult(
            intent=str(data.get("intent") or "qa"),
            rewritten_query=str(data.get("rewritten_query") or fallback_query).strip()
            or fallback_query,
            keywords=list(data.get("keywords") or []) or _simple_keywords(fallback_query),
            raw=data,
        )
    except Exception:
        logger.warning("Failed to parse understanding JSON; using raw query")
        return UnderstandingResult(
            intent="qa",
            rewritten_query=fallback_query,
            keywords=_simple_keywords(fallback_query),
        )


def _simple_keywords(query: str) -> list[str]:
    parts = re.findall(r"[\w\u4e00-\u9fff]+", query)
    return [p for p in parts if len(p) > 1][:12]
