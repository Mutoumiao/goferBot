from knowledge_ai.observability.trace import redact_provider_secrets


def test_redact_api_keys():
    payload = {
        "embedding_api_key": "sk-secret",
        "llm_model": "gpt",
        "nested": {"rerank_api_key": "rk"},
    }
    out = redact_provider_secrets(payload)
    assert out["embedding_api_key"] == "***REDACTED***"
    assert out["nested"]["rerank_api_key"] == "***REDACTED***"
    assert out["llm_model"] == "gpt"
