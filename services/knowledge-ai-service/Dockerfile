# Knowledge AI Service — multi-stage build with uv
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim AS builder

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock README.md ./
COPY src ./src

# --frozen: install exactly from committed uv.lock (reproducible builds)
RUN uv sync --frozen --no-dev --no-editable

FROM python:3.12-slim-bookworm AS runtime

WORKDIR /app
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app/src" \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8090

# Copy virtualenv from builder (uv places it at /app/.venv)
COPY --from=builder /app/.venv /app/.venv
COPY --from=builder /app/src /app/src
COPY --from=builder /app/pyproject.toml /app/pyproject.toml

EXPOSE 8090

# Service is internal-only; do not publish to public internet in compose.
CMD ["python", "-m", "knowledge_ai.main"]
