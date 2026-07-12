"""Fail-closed: no default OpenAI (or other vendor) base URL / model."""

import pytest

from knowledge_ai.indexing.embedder import Embedder
from knowledge_ai.provider_require import require_http_base_url, require_model_name
from knowledge_ai.schemas import ProviderConfig


def test_require_http_base_url_rejects_blank():
    with pytest.raises(ValueError, match="embedding_base_url"):
        require_http_base_url(None, "embedding_base_url")
    with pytest.raises(ValueError, match="llm_base_url"):
        require_http_base_url("   ", "llm_base_url")
    with pytest.raises(ValueError, match="no default vendor"):
        require_http_base_url("", "llm_base_url")


def test_require_http_base_url_strips_slash():
    assert require_http_base_url("http://llm.local/v1/", "llm_base_url") == "http://llm.local/v1"


def test_require_model_name_rejects_blank():
    with pytest.raises(ValueError, match="llm_model"):
        require_model_name(None, "llm_model")
    with pytest.raises(ValueError, match="embedding_model"):
        require_model_name("  ", "embedding_model")


@pytest.mark.asyncio
async def test_embedder_raises_without_base_url():
    emb = Embedder(
        ProviderConfig(
            embedding_api_key="sk-test",
            embedding_model="my-embed",
            embedding_base_url=None,
        )
    )
    with pytest.raises(ValueError, match="embedding_base_url"):
        await emb.embed_texts(["hello"])


@pytest.mark.asyncio
async def test_embedder_raises_without_model():
    emb = Embedder(
        ProviderConfig(
            embedding_api_key="sk-test",
            embedding_model=None,
            embedding_base_url="http://embed.local/v1",
        )
    )
    with pytest.raises(ValueError, match="embedding_model"):
        await emb.embed_texts(["hello"])


def test_no_openai_default_strings_in_call_sites():
    """Guard against re-introducing hardcoded OpenAI defaults in LLM call sites."""
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "src" / "knowledge_ai"
    offenders: list[str] = []
    for path in root.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        if "api.openai.com" in text:
            offenders.append(str(path.relative_to(root.parent.parent)))
    assert offenders == [], f"unexpected OpenAI default URL in: {offenders}"
