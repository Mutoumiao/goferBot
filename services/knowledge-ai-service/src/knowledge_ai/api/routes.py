"""Knowledge AI HTTP routes."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from knowledge_ai import __version__
from knowledge_ai.generation.generate import AnswerGenerator
from knowledge_ai.indexing.indexer import Indexer
from knowledge_ai.observability.langfuse_adapter import LangfuseAdapter
from knowledge_ai.observability.trace import TraceContext, redact_provider_secrets
from knowledge_ai.retrieval.hybrid import HybridRetriever
from knowledge_ai.schemas import (
    DeleteResponse,
    HealthDependency,
    HealthResponse,
    IndexRequest,
    IndexResponse,
    QueryRequest,
    QueryResponse,
    RetrieveRequest,
    RetrieveResponse,
    StreamRequest,
)

if TYPE_CHECKING:
    from knowledge_ai.infrastructure.elasticsearch_store import ElasticsearchStore
    from knowledge_ai.infrastructure.pg import PgChunkStore

logger = logging.getLogger("knowledge_ai.api")

router = APIRouter()


def _app_state(request: Request):
    return request.app.state


@router.get("/health", response_model=HealthResponse)
@router.get("/health/live", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    pg: PgChunkStore | None = getattr(_app_state(request), "pg", None)
    es: ElasticsearchStore | None = getattr(_app_state(request), "es", None)

    pg_ok, pg_detail = (False, "not connected")
    es_ok, es_detail = (False, "not connected")
    if pg is not None:
        try:
            pg_ok, pg_detail = await pg.health()
        except Exception as e:
            pg_ok, pg_detail = False, str(e)
    if es is not None:
        try:
            es_ok, es_detail = await es.health()
        except Exception as e:
            es_ok, es_detail = False, str(e)

    overall = "ok" if pg_ok and es_ok else "degraded"
    if not pg_ok and not es_ok:
        overall = "unavailable"

    return HealthResponse(
        status=overall,
        postgres=HealthDependency(status="up" if pg_ok else "down", detail=pg_detail),
        elasticsearch=HealthDependency(status="up" if es_ok else "down", detail=es_detail),
        version=__version__,
    )


@router.post("/index", response_model=IndexResponse)
async def index_document(req: IndexRequest, request: Request) -> IndexResponse:
    state = _app_state(request)
    indexer: Indexer = state.indexer
    trace = TraceContext.create(req.trace_id)
    # Never log secrets
    logger.info(
        "index start document_id=%s kb_id=%s provider=%s",
        req.document_id,
        req.kb_id,
        redact_provider_secrets(req.provider.model_dump() if req.provider else {}),
    )
    try:
        result = await indexer.index_document(req, trace=trace)
        trace.log_summary()
        LangfuseAdapter().try_export(trace, name="knowledge:index")
        return result
    except Exception as e:
        logger.exception("index failed document_id=%s", req.document_id)
        raise HTTPException(status_code=500, detail=_public_error(e)) from e


@router.delete("/documents/{document_id}", response_model=DeleteResponse)
async def delete_document(document_id: str, request: Request) -> DeleteResponse:
    indexer: Indexer = _app_state(request).indexer
    try:
        pg_n, es_n = await indexer.delete_document(document_id)
        return DeleteResponse(
            deleted=True,
            document_id=document_id,
            pg_deleted=pg_n,
            es_deleted=es_n,
        )
    except Exception as e:
        logger.exception("delete document failed id=%s", document_id)
        raise HTTPException(status_code=500, detail=_public_error(e)) from e


@router.delete("/kb/{kb_id}", response_model=DeleteResponse)
async def delete_kb(kb_id: str, request: Request) -> DeleteResponse:
    indexer: Indexer = _app_state(request).indexer
    try:
        pg_n, es_n = await indexer.delete_kb(kb_id)
        return DeleteResponse(
            deleted=True,
            kb_id=kb_id,
            pg_deleted=pg_n,
            es_deleted=es_n,
        )
    except Exception as e:
        logger.exception("delete kb failed id=%s", kb_id)
        raise HTTPException(status_code=500, detail=_public_error(e)) from e


@router.post("/retrieve", response_model=RetrieveResponse)
async def retrieve(req: RetrieveRequest, request: Request) -> RetrieveResponse:
    retriever: HybridRetriever = _app_state(request).retriever
    trace = TraceContext.create(req.trace_id)
    try:
        sources, empty, degraded = await retriever.retrieve(
            req.query,
            req.kb_ids,
            top_k=req.top_k,
            history=req.history,
            provider=req.provider,
            prompts=req.prompts,
            retrieval_mode=req.retrieval_mode,
            trace=trace,
        )
        trace.log_summary()
        LangfuseAdapter().try_export(trace, name="knowledge:retrieve")
        return RetrieveResponse(
            chunks=sources,
            retrieval_empty=empty,
            degraded=degraded,
            trace_id=trace.trace_id,
        )
    except Exception as e:
        logger.exception("retrieve failed")
        raise HTTPException(status_code=500, detail=_public_error(e)) from e


@router.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest, request: Request) -> QueryResponse:
    retriever: HybridRetriever = _app_state(request).retriever
    trace = TraceContext.create(req.trace_id)
    try:
        sources, empty, degraded = await retriever.retrieve(
            req.query,
            req.kb_ids,
            top_k=req.top_k,
            history=req.history,
            provider=req.provider,
            prompts=req.prompts,
            retrieval_mode=req.retrieval_mode,
            trace=trace,
        )
        with trace.span("L8:generate"):
            gen = AnswerGenerator(req.provider, req.prompts)
            answer = await gen.generate(
                req.query,
                sources,
                history=req.history,
                retrieval_empty=empty,
                retrieval_mode=req.retrieval_mode,
            )
        trace.attributes["retrieval_empty"] = empty
        trace.log_summary()
        LangfuseAdapter().try_export(trace, name="knowledge:query")
        return QueryResponse(
            answer=answer,
            sources=sources,
            retrieval_empty=empty,
            degraded=degraded,
            conversation_id=req.conversation_id,
            message_id=req.message_id,
            trace_id=trace.trace_id,
        )
    except Exception as e:
        logger.exception("query failed")
        raise HTTPException(status_code=500, detail=_public_error(e)) from e


@router.post("/stream")
async def stream(req: StreamRequest, request: Request) -> StreamingResponse:
    retriever: HybridRetriever = _app_state(request).retriever
    trace = TraceContext.create(req.trace_id)

    async def event_gen():
        try:
            sources, empty, degraded = await retriever.retrieve(
                req.query,
                req.kb_ids,
                top_k=req.top_k,
                history=req.history,
                provider=req.provider,
                prompts=req.prompts,
                retrieval_mode=req.retrieval_mode,
                trace=trace,
            )
            # 1) sources first
            yield _sse(
                "sources",
                {
                    "sources": [s.model_dump() for s in sources],
                    "retrieval_empty": empty,
                    "degraded": degraded,
                    "conversation_id": req.conversation_id,
                    "message_id": req.message_id,
                    "trace_id": trace.trace_id,
                },
            )

            gen = AnswerGenerator(req.provider, req.prompts)
            full: list[str] = []
            async for token in gen.generate_stream(
                req.query,
                sources,
                history=req.history,
                retrieval_empty=empty,
                retrieval_mode=req.retrieval_mode,
            ):
                full.append(token)
                yield _sse(
                    "message",
                    {
                        "delta": token,
                        "conversation_id": req.conversation_id,
                        "message_id": req.message_id,
                    },
                )

            yield _sse(
                "message_end",
                {
                    "answer": "".join(full),
                    "retrieval_empty": empty,
                    "degraded": degraded,
                    "conversation_id": req.conversation_id,
                    "message_id": req.message_id,
                    "trace_id": trace.trace_id,
                },
            )
            trace.log_summary()
            LangfuseAdapter().try_export(trace, name="knowledge:stream")
        except Exception as e:
            logger.exception("stream failed")
            # Never leak stack traces to client
            yield _sse(
                "error",
                {
                    "message": _public_error(e),
                    "conversation_id": req.conversation_id,
                    "message_id": req.message_id,
                    "trace_id": trace.trace_id,
                },
            )

    return StreamingResponse(event_gen(), media_type="text/event-stream")


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _public_error(e: Exception) -> str:
    """User-facing error without internal stack."""
    name = type(e).__name__
    msg = str(e)
    # strip potential secrets
    if "api_key" in msg.lower() or "authorization" in msg.lower():
        return f"{name}: upstream request failed"
    if len(msg) > 200:
        msg = msg[:200] + "…"
    return f"{name}: {msg}" if msg else name
