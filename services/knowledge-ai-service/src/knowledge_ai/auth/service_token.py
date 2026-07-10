"""Shared service token auth (Nest → Knowledge AI)."""

from __future__ import annotations

import secrets
from collections.abc import Callable

from fastapi import Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from knowledge_ai.config import Settings, get_settings

# Paths that skip service-token auth. /docs* only exist when docs are enabled (non-prod).
PUBLIC_PATHS = frozenset({"/health", "/health/live", "/docs", "/openapi.json", "/redoc"})


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def verify_service_token(
    authorization: str | None,
    expected: str,
) -> bool:
    token = extract_bearer_token(authorization)
    if token is None or not expected:
        return False
    # compare_digest raises ValueError when lengths differ — must be 401, not 500.
    if len(token) != len(expected):
        return False
    try:
        return secrets.compare_digest(token, expected)
    except (TypeError, ValueError):
        return False


class ServiceTokenMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, settings: Settings | None = None):
        super().__init__(app)
        self._settings = settings

    @property
    def settings(self) -> Settings:
        return self._settings or get_settings()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith("/docs"):
            return await call_next(request)

        if not verify_service_token(
            request.headers.get("Authorization"),
            self.settings.knowledge_ai_service_token,
        ):
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid or missing service token"},
            )
        return await call_next(request)


