"""Pytest fixtures."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

# Ensure deterministic token for tests before app import
os.environ.setdefault("KNOWLEDGE_AI_SERVICE_TOKEN", "test-service-token")
os.environ.setdefault("DATABASE_URL", "postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot")
os.environ.setdefault("ELASTICSEARCH_URL", "http://localhost:9200")


@pytest.fixture
def service_token() -> str:
    return "test-service-token"


@pytest.fixture
def auth_headers(service_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {service_token}"}
