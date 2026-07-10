"""Replace-index pipeline: chunk → embed → dual-write → drop stale (never delete-before-embed)."""

from __future__ import annotations

import logging
from typing import Any

from knowledge_ai.config import Settings, get_settings
from knowledge_ai.indexing.chunker import chunk_parent_child
from knowledge_ai.indexing.embedder import Embedder
from knowledge_ai.infrastructure.elasticsearch_store import ElasticsearchStore
from knowledge_ai.infrastructure.pg import PgChunkStore, new_uuid
from knowledge_ai.observability.trace import TraceContext
from knowledge_ai.schemas import IndexRequest, IndexResponse

logger = logging.getLogger("knowledge_ai.indexer")


class Indexer:
    def __init__(
        self,
        pg: PgChunkStore,
        es: ElasticsearchStore,
        settings: Settings | None = None,
    ):
        self.pg = pg
        self.es = es
        self.settings = settings or get_settings()

    async def index_document(
        self,
        req: IndexRequest,
        trace: TraceContext | None = None,
    ) -> IndexResponse:
        """
        Safe replace semantics:
        1) chunk + embed first (failure leaves prior index intact)
        2) PG atomic delete+insert for this document_id
        3) ES bulk write new ids; raise on partial failure
        4) ES drop stale docs for document_id not in the new id set
        """
        trace = trace or TraceContext.create(req.trace_id)

        with trace.span("index:chunk"):
            pieces = chunk_parent_child(
                req.text,
                parent_size=self.settings.parent_chunk_size,
                child_size=self.settings.child_chunk_size,
                overlap=self.settings.chunk_overlap,
            )

        if not pieces:
            # Intentional empty replace: clear both stores only after we know there is no content.
            with trace.span("index:empty_clear"):
                await self.pg.delete_by_document(req.document_id)
                await self.es.delete_by_document(req.document_id)
            return IndexResponse(
                document_id=req.document_id,
                kb_id=req.kb_id,
                chunk_count=0,
                status="ok",
            )

        # Assign IDs: parents first, map parent_index -> uuid
        parent_ids: list[str] = []
        rows: list[dict[str, Any]] = []
        child_texts: list[str] = []
        child_row_indices: list[int] = []

        for p in pieces:
            if p.is_parent:
                pid = new_uuid()
                parent_ids.append(pid)
                rows.append(
                    {
                        "id": pid,
                        "document_id": req.document_id,
                        "kb_id": req.kb_id,
                        "content": p.content,
                        "parent_id": None,
                        "is_parent": True,
                        "parent_content": None,
                        "embedding": None,
                        "meta": {**(req.metadata or {}), "role": "parent"},
                    }
                )
            else:
                parent_id = (
                    parent_ids[p.parent_index]
                    if p.parent_index is not None and p.parent_index < len(parent_ids)
                    else None
                )
                cid = new_uuid()
                child_row_indices.append(len(rows))
                child_texts.append(p.content)
                rows.append(
                    {
                        "id": cid,
                        "document_id": req.document_id,
                        "kb_id": req.kb_id,
                        "content": p.content,
                        "parent_id": parent_id,
                        "is_parent": False,
                        "parent_content": p.parent_content,
                        "embedding": None,
                        "meta": {**(req.metadata or {}), "role": "child"},
                    }
                )

        # Embed before any destructive store mutation so failures preserve prior index.
        with trace.span("index:embed", child_count=len(child_texts)):
            embedder = Embedder(req.provider)
            embeddings = await embedder.embed_texts(child_texts)
            for idx, emb in zip(child_row_indices, embeddings, strict=True):
                rows[idx]["embedding"] = emb

        keep_ids = {str(r["id"]) for r in rows}

        with trace.span("index:write_pg", rows=len(rows)):
            # Atomic PG replace: old rows remain until this txn commits.
            await self.pg.replace_document_chunks(req.document_id, rows)

        with trace.span("index:write_es", rows=len(rows)):
            # Write new ES docs first, then drop stale ids for this document.
            await self.es.bulk_index(rows)
            await self.es.delete_stale_for_document(req.document_id, keep_ids)

        logger.info(
            "indexed document_id=%s kb_id=%s chunks=%s",
            req.document_id,
            req.kb_id,
            len(rows),
        )
        return IndexResponse(
            document_id=req.document_id,
            kb_id=req.kb_id,
            chunk_count=len(rows),
            status="ok",
        )

    async def delete_document(self, document_id: str) -> tuple[int, int]:
        pg_n = await self.pg.delete_by_document(document_id)
        es_n = await self.es.delete_by_document(document_id)
        return pg_n, es_n

    async def delete_kb(self, kb_id: str) -> tuple[int, int]:
        pg_n = await self.pg.delete_by_kb(kb_id)
        es_n = await self.es.delete_by_kb(kb_id)
        return pg_n, es_n
