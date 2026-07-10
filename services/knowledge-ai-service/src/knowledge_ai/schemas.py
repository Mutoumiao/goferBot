"""Pydantic request/response models for Knowledge AI HTTP API."""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class RetrievalMode(str, Enum):
    strict = "strict"
    loose = "loose"


class HistoryMessage(BaseModel):
    role: str
    content: str


class ProviderConfig(BaseModel):
    embedding_model: str | None = None
    embedding_api_key: str | None = None
    embedding_base_url: str | None = None
    rerank_model: str | None = None
    rerank_api_key: str | None = None
    rerank_base_url: str | None = None
    llm_model: str | None = None
    llm_api_key: str | None = None
    llm_base_url: str | None = None


class PromptsConfig(BaseModel):
    understanding: str | None = None
    generation: str | None = None
    guardrail: str | None = None


class IndexRequest(BaseModel):
    document_id: str
    kb_id: str
    text: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    provider: ProviderConfig | None = Field(default=None, alias="_provider")
    trace_id: str | None = None

    model_config = {"populate_by_name": True}


class IndexResponse(BaseModel):
    document_id: str
    kb_id: str
    chunk_count: int
    status: str = "ok"


class DeleteResponse(BaseModel):
    deleted: bool
    document_id: str | None = None
    kb_id: str | None = None
    pg_deleted: int = 0
    es_deleted: int = 0


class RetrieveRequest(BaseModel):
    query: str
    kb_ids: list[str] = Field(min_length=1)
    top_k: int = 5
    retrieval_mode: RetrievalMode = RetrievalMode.strict
    history: list[HistoryMessage] = Field(default_factory=list)
    trace_id: str | None = None
    conversation_id: str | None = None
    message_id: str | None = None
    provider: ProviderConfig | None = Field(default=None, alias="_provider")
    prompts: PromptsConfig | None = Field(default=None, alias="_prompts")

    model_config = {"populate_by_name": True}

    @field_validator("retrieval_mode", mode="before")
    @classmethod
    def normalize_mode(cls, v: Any) -> Any:
        if v is None or v == "":
            return RetrievalMode.strict
        if isinstance(v, str) and v not in ("strict", "loose"):
            raise ValueError("retrieval_mode must be 'strict' or 'loose'")
        return v


class SourceItem(BaseModel):
    kb_id: str
    document_id: str
    chunk_id: str | None = None
    content: str | None = None
    score: float | None = None
    parent_id: str | None = None


class RetrieveResponse(BaseModel):
    chunks: list[SourceItem]
    retrieval_empty: bool = False
    degraded: bool = False
    trace_id: str | None = None


class QueryRequest(RetrieveRequest):
    pass


class QueryResponse(BaseModel):
    answer: str
    sources: list[SourceItem]
    retrieval_empty: bool = False
    degraded: bool = False
    conversation_id: str | None = None
    message_id: str | None = None
    trace_id: str | None = None


class StreamRequest(RetrieveRequest):
    pass


class HealthDependency(BaseModel):
    status: str
    detail: str | None = None


class HealthResponse(BaseModel):
    status: str
    postgres: HealthDependency
    elasticsearch: HealthDependency
    version: str
