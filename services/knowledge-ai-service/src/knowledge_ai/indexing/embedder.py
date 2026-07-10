"""HTTP embedding client via OpenAI-compatible API from `_provider`."""

from __future__ import annotations

import logging
from typing import Sequence

import httpx

from knowledge_ai.schemas import ProviderConfig

logger = logging.getLogger("knowledge_ai.embedder")


class Embedder:
    def __init__(self, provider: ProviderConfig | None, timeout: float = 60.0):
        self.provider = provider or ProviderConfig()
        self.timeout = timeout

    @property
    def base_url(self) -> str:
        return (self.provider.embedding_base_url or "https://api.openai.com/v1").rstrip("/")

    @property
    def model(self) -> str:
        return self.provider.embedding_model or "text-embedding-3-small"

    async def embed_texts(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        # Fail closed: never write pseudo-vectors into PG/ES (would poison hybrid retrieval).
        # Unit tests must inject a provider with a key or mock Embedder entirely.
        if not self.provider.embedding_api_key:
            raise ValueError(
                "embedding_api_key is required for indexing/retrieval; "
                "pseudo-embeddings are disabled outside explicit test helpers"
            )

        url = f"{self.base_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {self.provider.embedding_api_key}",
            "Content-Type": "application/json",
        }
        # batch in chunks of 32
        out: list[list[float]] = []
        batch_size = 32
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for i in range(0, len(texts), batch_size):
                batch = list(texts[i : i + batch_size])
                resp = await client.post(
                    url,
                    headers=headers,
                    json={"model": self.model, "input": batch},
                )
                resp.raise_for_status()
                data = resp.json()["data"]
                data_sorted = sorted(data, key=lambda x: x["index"])
                out.extend([d["embedding"] for d in data_sorted])
        return out
