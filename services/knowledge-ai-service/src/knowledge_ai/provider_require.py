"""Fail-closed helpers for injected `_provider` fields.

Knowledge AI never assumes a vendor (e.g. OpenAI) endpoint or model name.
Callers (Nest) must inject base_url + model + credentials per request.
"""

from __future__ import annotations


def require_http_base_url(value: str | None, field_name: str) -> str:
    """Return stripped base URL without trailing slash; raise if missing/blank."""
    url = (value or "").strip().rstrip("/")
    if not url:
        raise ValueError(
            f"{field_name} is required; "
            "no default vendor API base URL is assumed (inject via Nest _provider)"
        )
    return url


def require_model_name(value: str | None, field_name: str) -> str:
    """Return stripped model id; raise if missing/blank."""
    name = (value or "").strip()
    if not name:
        raise ValueError(
            f"{field_name} is required; no default model name is assumed (inject via Nest _provider)"
        )
    return name
