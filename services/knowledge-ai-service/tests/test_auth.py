"""Service token middleware tests."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

os.environ["KNOWLEDGE_AI_SERVICE_TOKEN"] = "test-service-token"

from fastapi.testclient import TestClient

from knowledge_ai.auth.service_token import extract_bearer_token, verify_service_token
from knowledge_ai.config import Settings
from knowledge_ai.main import create_app


def test_extract_bearer():
    assert extract_bearer_token("Bearer abc") == "abc"
    assert extract_bearer_token("bearer xyz") == "xyz"
    assert extract_bearer_token(None) is None
    assert extract_bearer_token("Token abc") is None


def test_verify_service_token():
    assert verify_service_token("Bearer secret", "secret") is True
    assert verify_service_token("Bearer wrong", "secret") is False
    assert verify_service_token(None, "secret") is False
    # Unequal length must be False (401 path), never raise (would become 500).
    assert verify_service_token("Bearer x", "secret") is False
    assert verify_service_token("Bearer secret-extra-long", "secret") is False


def test_health_public_no_token():
    """Health must be reachable without token."""
    app = create_app()

    @asynccontextmanager
    async def fake_lifespan(app_):
        app_.state.pg = MagicMock()
        app_.state.pg.health = AsyncMock(return_value=(True, "ok"))
        app_.state.es = MagicMock()
        app_.state.es.health = AsyncMock(return_value=(True, "ok"))
        app_.state.indexer = MagicMock()
        app_.state.retriever = MagicMock()
        app_.state.settings = Settings(knowledge_ai_service_token="test-service-token")
        yield

    app.router.lifespan_context = fake_lifespan

    with TestClient(app) as client:
        r = client.get("/health")
        assert r.status_code == 200
        r2 = client.post("/retrieve", json={"query": "q", "kb_ids": ["a"]})
        assert r2.status_code == 401
