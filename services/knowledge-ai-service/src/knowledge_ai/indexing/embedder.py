"""Embedding clients via vendor adapters (not hardcoded paths in call sites)."""

from __future__ import annotations

import logging
from typing import Protocol, Sequence

import httpx

from knowledge_ai.provider_require import require_http_base_url, require_model_name
from knowledge_ai.schemas import ProviderConfig

logger = logging.getLogger("knowledge_ai.embedder")


def service_root(url: str) -> str:
    """Strip known API path suffixes; adapters re-append vendor paths."""
    u = url.strip().rstrip("/")
    suffixes = (
        "/chat/completions",
        "/embeddings",
        "/models",
        "/api/embed",
        "/api/embeddings",
        "/api/tags",
        "/v1",
        "/api",
    )
    changed = True
    while changed:
        changed = False
        lower = u.lower()
        for s in suffixes:
            if lower.endswith(s):
                u = u[: -len(s)].rstrip("/")
                lower = u.lower()
                changed = True
    return u


class EmbedderProtocol(Protocol):
    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]: ...


class OpenAICompatEmbedder:
    """OpenAI-compatible POST {root}/v1/embeddings → data[].embedding."""

    def __init__(self, provider: ProviderConfig, timeout: float = 60.0):
        self.provider = provider
        self.timeout = timeout

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self.provider.embedding_api_key:
            raise ValueError(
                "embedding_api_key is required for indexing/retrieval; "
                "pseudo-embeddings are disabled outside explicit test helpers"
            )
        base = require_http_base_url(self.provider.embedding_base_url, "embedding_base_url")
        model = require_model_name(self.provider.embedding_model, "embedding_model")
        root = service_root(base)
        url = f"{root}/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {self.provider.embedding_api_key}",
            "Content-Type": "application/json",
        }
        out: list[list[float]] = []
        batch_size = 32
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for i in range(0, len(texts), batch_size):
                batch = list(texts[i : i + batch_size])
                resp = await client.post(
                    url,
                    headers=headers,
                    json={"model": model, "input": batch},
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                data_sorted = sorted(data, key=lambda x: x["index"])
                out.extend([d["embedding"] for d in data_sorted])
        return out


class OllamaEmbedder:
    """Ollama native POST {root}/api/embed → embeddings[][] (official docs)."""

    def __init__(self, provider: ProviderConfig, timeout: float = 60.0):
        self.provider = provider
        self.timeout = timeout

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        # Ollama may accept empty key; Nest still requires a placeholder.
        base = require_http_base_url(self.provider.embedding_base_url, "embedding_base_url")
        model = require_model_name(self.provider.embedding_model, "embedding_model")
        root = service_root(base)
        url = f"{root}/api/embed"
        headers = {"Content-Type": "application/json"}
        if self.provider.embedding_api_key:
            headers["Authorization"] = f"Bearer {self.provider.embedding_api_key}"
        out: list[list[float]] = []
        batch_size = 32
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for i in range(0, len(texts), batch_size):
                batch = list(texts[i : i + batch_size])
                resp = await client.post(
                    url,
                    headers=headers,
                    json={"model": model, "input": batch},
                )
                resp.raise_for_status()
                body = resp.json()
                # Official: { "embeddings": [[...], ...] }
                embeddings = body.get("embeddings")
                if embeddings is None and "embedding" in body:
                    # Legacy single-vector shape
                    embeddings = [body["embedding"]]
                if not embeddings:
                    raise ValueError("Ollama /api/embed returned empty embeddings")
                out.extend(embeddings)
        return out


class Embedder:
    """
    Facade used by Indexer / HybridRetriever.
    Selects vendor adapter from embedding_provider_kind (default openai_compat).
    """

    def __init__(self, provider: ProviderConfig | None, timeout: float = 60.0):
        self.provider = provider or ProviderConfig()
        self.timeout = timeout
        self._impl = self._select()

    def _select(self) -> EmbedderProtocol:
        kind = (self.provider.embedding_provider_kind or "openai_compat").strip().lower()
        if kind in ("ollama",):
            return OllamaEmbedder(self.provider, self.timeout)
        if kind in ("openai", "openai_compat", "deepseek", "custom", ""):
            return OpenAICompatEmbedder(self.provider, self.timeout)
        logger.warning("unknown embedding_provider_kind=%s; using openai_compat", kind)
        return OpenAICompatEmbedder(self.provider, self.timeout)

    @property
    def base_url(self) -> str:
        return require_http_base_url(self.provider.embedding_base_url, "embedding_base_url")

    @property
    def model(self) -> str:
        return require_model_name(self.provider.embedding_model, "embedding_model")

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        return await self._impl.embed_texts(texts)
