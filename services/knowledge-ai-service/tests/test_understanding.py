import pytest

from knowledge_ai.understanding.merged import MergedUnderstanding, _parse_understanding


@pytest.mark.asyncio
async def test_offline_understanding_no_llm_key():
    u = MergedUnderstanding(provider=None)
    result = await u.understand("什么是向量检索")
    assert result.rewritten_query
    assert result.intent == "qa"
    assert isinstance(result.keywords, list)


def test_parse_understanding_json():
    raw = '{"intent":"search","rewritten_query":"向量检索","keywords":["向量","检索"]}'
    r = _parse_understanding(raw, fallback_query="fallback")
    assert r.rewritten_query == "向量检索"
    assert "向量" in r.keywords
