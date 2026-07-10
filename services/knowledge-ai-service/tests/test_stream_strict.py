"""Strict empty retrieval + stream contract (mocked retriever)."""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

os.environ["KNOWLEDGE_AI_SERVICE_TOKEN"] = "test-service-token"

from knowledge_ai.config import Settings
from knowledge_ai.main import create_app


@pytest.fixture
def client_empty_retrieve():
    app = create_app()

    @asynccontextmanager
    async def fake_lifespan(app_):
        app_.state.settings = Settings(knowledge_ai_service_token="test-service-token")
        app_.state.pg = MagicMock()
        app_.state.es = MagicMock()
        app_.state.indexer = MagicMock()
        retriever = MagicMock()
        retriever.retrieve = AsyncMock(return_value=([], True, False))
        app_.state.retriever = retriever
        yield

    app.router.lifespan_context = fake_lifespan

    with TestClient(app) as c:
        yield c


def test_stream_strict_empty_business_success(client_empty_retrieve):
    headers = {"Authorization": "Bearer test-service-token"}
    body = {
        "query": "不存在的问题",
        "kb_ids": ["11111111-1111-1111-1111-111111111111"],
        "retrieval_mode": "strict",
        "conversation_id": "conv-1",
        "message_id": "msg-1",
    }
    with client_empty_retrieve.stream("POST", "/stream", headers=headers, json=body) as resp:
        assert resp.status_code == 200
        text = "".join(resp.iter_text())

    assert "event: sources" in text
    assert "event: message" in text
    assert "event: message_end" in text
    assert "event: error" not in text
    assert "retrieval_empty" in text

    for block in text.split("\n\n"):
        if block.startswith("event: sources"):
            data_line = [ln for ln in block.split("\n") if ln.startswith("data:")][0]
            data = json.loads(data_line[5:].strip())
            assert data["retrieval_empty"] is True
            assert data["sources"] == []
            assert data["conversation_id"] == "conv-1"


def test_query_strict_empty(client_empty_retrieve):
    headers = {"Authorization": "Bearer test-service-token"}
    body = {
        "query": "不存在的问题",
        "kb_ids": ["11111111-1111-1111-1111-111111111111"],
        "retrieval_mode": "strict",
    }
    r = client_empty_retrieve.post("/query", headers=headers, json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["retrieval_empty"] is True
    assert data["sources"] == []
    assert data["answer"]
