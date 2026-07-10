"""HTTP API Rerank client with R1 degrade-on-failure."""

from __future__ import annotations

import logging
from typing import Any

import httpx

from knowledge_ai.infrastructure.pg import ChunkRow
from knowledge_ai.observability.trace import TraceContext
from knowledge_ai.schemas import ProviderConfig

logger = logging.getLogger("knowledge_ai.rerank")


async def api_rerank(
    query: str,
    candidates: list[ChunkRow],
    provider: ProviderConfig | None,
    *,
    top_k: int = 5,
    trace: TraceContext | None = None,
) -> tuple[list[ChunkRow], bool]:
    """
    Returns (reranked_or_truncated, degraded).
    On failure: R1 degrade — keep input order, truncate top_k, mark degraded.
    """
    if not candidates:
        return [], False

    provider = provider or ProviderConfig()
    if not provider.rerank_base_url or not provider.rerank_model:
        # No rerank configured: pass-through truncate (not degraded failure)
        return candidates[:top_k], False

    try:
        ranked = await _call_rerank_api(query, candidates, provider)
        return ranked[:top_k], False
    except Exception as e:
        logger.warning("Rerank API failed, R1 degrade: %s", e)
        if trace:
            trace.mark_degraded(f"rerank_failed:{type(e).__name__}")
        return candidates[:top_k], True


async def _call_rerank_api(
    query: str,
    candidates: list[ChunkRow],
    provider: ProviderConfig,
) -> list[ChunkRow]:
    """
    Try a few common HTTP shapes:
    1) POST {base}/rerank  body: {model, query, documents: [str]}
    2) OpenAI-ish chat score (fallback not implemented — raise if shape unknown)
    """
    base = provider.rerank_base_url.rstrip("/")
    url = base if base.endswith("/rerank") else f"{base}/rerank"
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if provider.rerank_api_key:
        headers["Authorization"] = f"Bearer {provider.rerank_api_key}"

    documents = [c.content for c in candidates]
    body: dict[str, Any] = {
        "model": provider.rerank_model,
        "query": query,
        "documents": documents,
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=body)
        resp.raise_for_status()
        data = resp.json()

    # Expected: {results: [{index, relevance_score}, ...]} or {data: [...]}
    results = data.get("results") or data.get("data") or []
    if not results:
        raise ValueError("empty rerank results")

    scored: list[tuple[float, ChunkRow]] = []
    for item in results:
        idx = int(item.get("index", item.get("document_index", -1)))
        score = float(item.get("relevance_score", item.get("score", 0.0)))
        if 0 <= idx < len(candidates):
            row = candidates[idx]
            row.score = score
            scored.append((score, row))

    if not scored:
        raise ValueError("could not map rerank results")

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored]
