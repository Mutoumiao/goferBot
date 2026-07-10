"""Elasticsearch full-text store (BM25 only; no dense vector as primary)."""

from __future__ import annotations

import logging
from typing import Any

from elasticsearch import AsyncElasticsearch
from elasticsearch.helpers import async_bulk

from knowledge_ai.config import Settings, get_settings
from knowledge_ai.infrastructure.pg import ChunkRow

logger = logging.getLogger("knowledge_ai.es")


def build_index_body() -> dict[str, Any]:
    """
    Mapping without embedding/dense_vector as primary vector store.
    Chinese: try IK if available; analyzer fallback documented as standard.
    """
    return {
        "settings": {
            "number_of_shards": 1,
            "number_of_replicas": 0,
            "analysis": {
                "analyzer": {
                    # Prefer installing analysis-ik in compose; fallback uses standard.
                    "knowledge_text": {
                        "type": "custom",
                        "tokenizer": "standard",
                        "filter": ["lowercase"],
                    }
                }
            },
        },
        "mappings": {
            "properties": {
                "document_id": {"type": "keyword"},
                "kb_id": {"type": "keyword"},
                "content": {
                    "type": "text",
                    "analyzer": "knowledge_text",
                },
                "parent_id": {"type": "keyword"},
                "is_parent": {"type": "boolean"},
                "parent_content": {"type": "text", "analyzer": "knowledge_text"},
                # NOTE: no embedding / dense_vector field — vector lives in PG pgvector
            }
        },
    }


class ElasticsearchStore:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._client: AsyncElasticsearch | None = None

    @property
    def client(self) -> AsyncElasticsearch:
        if self._client is None:
            raise RuntimeError("ElasticsearchStore not connected")
        return self._client

    @property
    def index(self) -> str:
        return self.settings.elasticsearch_index

    async def connect(self) -> None:
        if self._client is not None:
            return
        self._client = AsyncElasticsearch(self.settings.elasticsearch_url)
        await self.ensure_index()

    async def close(self) -> None:
        if self._client is not None:
            await self._client.close()
            self._client = None

    async def ensure_index(self) -> None:
        exists = await self.client.indices.exists(index=self.index)
        if not exists:
            try:
                await self.client.indices.create(index=self.index, body=build_index_body())
                logger.info("created ES index %s (BM25 only, no dense_vector)", self.index)
            except Exception as e:
                # If IK-related custom fails in some images, retry minimal mapping
                logger.warning("ES index create failed (%s); retrying minimal mapping", e)
                await self.client.indices.create(
                    index=self.index,
                    body={
                        "mappings": {
                            "properties": {
                                "document_id": {"type": "keyword"},
                                "kb_id": {"type": "keyword"},
                                "content": {"type": "text"},
                                "parent_id": {"type": "keyword"},
                                "is_parent": {"type": "boolean"},
                                "parent_content": {"type": "text"},
                            }
                        }
                    },
                )

    async def health(self) -> tuple[bool, str]:
        try:
            info = await self.client.ping()
            if not info:
                return False, "ping failed"
            return True, "ok"
        except Exception as e:
            return False, str(e)

    async def delete_by_document(self, document_id: str) -> int:
        resp = await self.client.delete_by_query(
            index=self.index,
            body={"query": {"term": {"document_id": document_id}}},
            refresh=True,
            conflicts="proceed",
        )
        return int(resp.get("deleted", 0))

    async def delete_by_kb(self, kb_id: str) -> int:
        resp = await self.client.delete_by_query(
            index=self.index,
            body={"query": {"term": {"kb_id": kb_id}}},
            refresh=True,
            conflicts="proceed",
        )
        return int(resp.get("deleted", 0))

    async def bulk_index(self, docs: list[dict[str, Any]]) -> int:
        """Bulk write ES docs. Partial failures raise — caller must not report status=ok."""
        if not docs:
            return 0

        async def actions():
            for d in docs:
                yield {
                    "_index": self.index,
                    "_id": d["id"],
                    "_source": {
                        "document_id": d["document_id"],
                        "kb_id": d["kb_id"],
                        "content": d["content"],
                        "parent_id": d.get("parent_id"),
                        "is_parent": d.get("is_parent", False),
                        "parent_content": d.get("parent_content"),
                    },
                }

        # raise_on_error=True: any item failure aborts with exception (no silent PG/ES split).
        success, errors = await async_bulk(
            self.client,
            actions(),
            raise_on_error=True,
            raise_on_exception=True,
            refresh=True,
        )
        if errors:
            # Defensive: some helpers still return error lists when not raising.
            sample = errors[:3] if isinstance(errors, list) else errors
            logger.error("ES bulk partial errors: %s", sample)
            raise RuntimeError(f"Elasticsearch bulk_index partial failure: {sample}")
        return int(success)

    async def delete_stale_for_document(
        self,
        document_id: str,
        keep_ids: set[str],
    ) -> int:
        """
        After writing new chunk ids, remove older ES docs for the same document_id.
        Avoids delete-before-write: new docs exist before stale cleanup.
        """
        if not keep_ids:
            return await self.delete_by_document(document_id)

        body: dict[str, Any] = {
            "query": {
                "bool": {
                    "filter": [{"term": {"document_id": document_id}}],
                    "must_not": [{"ids": {"values": list(keep_ids)}}],
                }
            }
        }
        resp = await self.client.delete_by_query(
            index=self.index,
            body=body,
            refresh=True,
            conflicts="proceed",
        )
        return int(resp.get("deleted", 0))

    async def bm25_search(
        self,
        query: str,
        kb_ids: list[str],
        limit: int = 20,
    ) -> list[ChunkRow]:
        if not kb_ids:
            return []
        body = {
            "size": limit,
            "query": {
                "bool": {
                    "must": [
                        {
                            "multi_match": {
                                "query": query,
                                "fields": ["content", "parent_content"],
                            }
                        }
                    ],
                    "filter": [
                        {"terms": {"kb_id": kb_ids}},
                        {"term": {"is_parent": False}},
                    ],
                }
            },
        }
        resp = await self.client.search(index=self.index, body=body)
        hits = resp.get("hits", {}).get("hits", [])
        out: list[ChunkRow] = []
        for h in hits:
            src = h.get("_source", {})
            out.append(
                ChunkRow(
                    id=str(h.get("_id")),
                    document_id=str(src.get("document_id", "")),
                    kb_id=str(src.get("kb_id", "")),
                    content=src.get("content") or "",
                    parent_id=src.get("parent_id"),
                    is_parent=bool(src.get("is_parent", False)),
                    parent_content=src.get("parent_content"),
                    embedding=None,
                    meta={},
                    score=float(h.get("_score") or 0.0),
                )
            )
        return out
