"""Production token / docs configuration guards."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from knowledge_ai.config import Settings


def test_production_rejects_weak_token():
    with pytest.raises(ValidationError):
        Settings(
            environment="production",
            knowledge_ai_service_token="dev-token-change-me",
        )


def test_production_accepts_strong_token():
    s = Settings(
        environment="production",
        knowledge_ai_service_token="prod-strong-token-xyz",
    )
    assert s.is_production
    assert s.docs_enabled is False


def test_development_keeps_docs_by_default():
    s = Settings(environment="development", knowledge_ai_service_token="dev-token-change-me")
    assert s.docs_enabled is True


def test_enable_docs_override():
    s = Settings(
        environment="production",
        knowledge_ai_service_token="prod-strong-token-xyz",
        enable_docs=True,
    )
    assert s.docs_enabled is True
