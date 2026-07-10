"""L8 generation + strict empty-retrieval guardrails."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

import httpx

from knowledge_ai.generation.context import build_context
from knowledge_ai.prompts.defaults import GENERATION_PROMPT, GUARDRAIL_STRICT_EMPTY
from knowledge_ai.schemas import (
    HistoryMessage,
    PromptsConfig,
    ProviderConfig,
    RetrievalMode,
    SourceItem,
)

logger = logging.getLogger("knowledge_ai.generate")


class AnswerGenerator:
    def __init__(
        self,
        provider: ProviderConfig | None = None,
        prompts: PromptsConfig | None = None,
        *,
        timeout: float = 120.0,
    ):
        self.provider = provider or ProviderConfig()
        self.prompts = prompts or PromptsConfig()
        self.timeout = timeout

    def empty_answer(self, mode: RetrievalMode) -> str:
        if mode == RetrievalMode.strict:
            return self.prompts.guardrail or GUARDRAIL_STRICT_EMPTY
        # loose: still no fabricated KB claims in Phase 1 minimal implementation
        return self.prompts.guardrail or GUARDRAIL_STRICT_EMPTY

    async def generate(
        self,
        query: str,
        sources: list[SourceItem],
        *,
        history: list[HistoryMessage] | None = None,
        retrieval_empty: bool = False,
        retrieval_mode: RetrievalMode = RetrievalMode.strict,
    ) -> str:
        if retrieval_empty or not sources:
            return self.empty_answer(retrieval_mode)

        context = build_context(sources)
        system = self.prompts.generation or GENERATION_PROMPT
        if not self.provider.llm_api_key:
            return _offline_answer(query, sources)

        messages = _build_messages(system, query, context, history)
        return await self._chat(messages, stream=False)  # type: ignore[return-value]

    async def generate_stream(
        self,
        query: str,
        sources: list[SourceItem],
        *,
        history: list[HistoryMessage] | None = None,
        retrieval_empty: bool = False,
        retrieval_mode: RetrievalMode = RetrievalMode.strict,
    ) -> AsyncIterator[str]:
        if retrieval_empty or not sources:
            yield self.empty_answer(retrieval_mode)
            return

        context = build_context(sources)
        system = self.prompts.generation or GENERATION_PROMPT
        if not self.provider.llm_api_key:
            yield _offline_answer(query, sources)
            return

        messages = _build_messages(system, query, context, history)
        async for token in self._chat_stream(messages):
            yield token

    async def _chat(self, messages: list[dict], stream: bool = False) -> str:
        base = (self.provider.llm_base_url or "https://api.openai.com/v1").rstrip("/")
        url = f"{base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.provider.llm_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.provider.llm_model or "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.2,
            "stream": False,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            resp = await client.post(url, headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def _chat_stream(self, messages: list[dict]) -> AsyncIterator[str]:
        base = (self.provider.llm_base_url or "https://api.openai.com/v1").rstrip("/")
        url = f"{base}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.provider.llm_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.provider.llm_model or "gpt-4o-mini",
            "messages": messages,
            "temperature": 0.2,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream("POST", url, headers=headers, json=body) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        import json

                        data = json.loads(payload)
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content")
                        if content:
                            yield content
                    except Exception:
                        continue


def _build_messages(
    system: str,
    query: str,
    context: str,
    history: list[HistoryMessage] | None,
) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": system}]
    for h in (history or [])[-10:]:
        messages.append({"role": h.role, "content": h.content})
    messages.append(
        {
            "role": "user",
            "content": f"Sources:\n{context}\n\nQuestion: {query}",
        }
    )
    return messages


def _offline_answer(query: str, sources: list[SourceItem]) -> str:
    cites = ", ".join(f"[{i}]" for i in range(1, min(len(sources), 3) + 1))
    snippet = (sources[0].content or "")[:200]
    return f"基于检索资料{cites}：{snippet}"
