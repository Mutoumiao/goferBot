"""Runtime configuration from environment."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Insecure defaults / short tokens rejected when ENVIRONMENT=production
_WEAK_TOKENS = frozenset(
    {
        "dev-token-change-me",
        "change-me",
        "change-me-in-dev",
        "test-service-token",
        "secret",
        "token",
    }
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    # development | production | test
    environment: str = Field(default="development", validation_alias="ENVIRONMENT")
    # When true (or ENVIRONMENT=development), expose /docs OpenAPI UI
    enable_docs: bool | None = Field(default=None, validation_alias="KNOWLEDGE_AI_ENABLE_DOCS")

    knowledge_ai_service_token: str = Field(
        default="dev-token-change-me",
        validation_alias="KNOWLEDGE_AI_SERVICE_TOKEN",
    )
    database_url: str = Field(
        default="postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot",
        validation_alias="DATABASE_URL",
    )
    elasticsearch_url: str = Field(
        default="http://localhost:9200",
        validation_alias="ELASTICSEARCH_URL",
    )
    elasticsearch_index: str = Field(
        default="knowledge_chunks",
        validation_alias="ELASTICSEARCH_INDEX",
    )
    embedding_dimension: int = Field(default=1536, validation_alias="EMBEDDING_DIMENSION")
    host: str = Field(default="0.0.0.0", validation_alias="HOST")
    port: int = Field(default=8090, validation_alias="PORT")
    log_level: str = Field(default="info", validation_alias="LOG_LEVEL")

    # Optional Langfuse
    langfuse_public_key: str | None = Field(default=None, validation_alias="LANGFUSE_PUBLIC_KEY")
    langfuse_secret_key: str | None = Field(default=None, validation_alias="LANGFUSE_SECRET_KEY")
    langfuse_host: str | None = Field(default=None, validation_alias="LANGFUSE_HOST")

    # Chunking defaults (parent-child)
    parent_chunk_size: int = 1200
    child_chunk_size: int = 400
    chunk_overlap: int = 50

    # Retrieval defaults
    rrf_k: int = 60
    default_top_k: int = 5
    retrieve_candidates: int = 20

    @property
    def is_production(self) -> bool:
        return self.environment.lower() in ("production", "prod")

    @property
    def docs_enabled(self) -> bool:
        if self.enable_docs is not None:
            return bool(self.enable_docs)
        return not self.is_production

    @model_validator(mode="after")
    def reject_weak_token_in_production(self) -> Settings:
        token = (self.knowledge_ai_service_token or "").strip()
        if self.is_production:
            if not token or token in _WEAK_TOKENS or len(token) < 16:
                raise ValueError(
                    "production requires a strong KNOWLEDGE_AI_SERVICE_TOKEN "
                    "(length >= 16, not a known dev default)"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
