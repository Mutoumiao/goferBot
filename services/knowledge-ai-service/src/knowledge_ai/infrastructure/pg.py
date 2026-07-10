"""PostgreSQL knowledge schema + pgvector chunk store."""

from __future__ import annotations

import json
import logging
import uuid
from dataclasses import dataclass
from typing import Any

import asyncpg

from knowledge_ai.config import Settings, get_settings

logger = logging.getLogger("knowledge_ai.pg")


@dataclass
class ChunkRow:
    id: str
    document_id: str
    kb_id: str
    content: str
    parent_id: str | None
    is_parent: bool
    parent_content: str | None
    embedding: list[float] | None
    meta: dict[str, Any]
    score: float | None = None


SCHEMA_SQL = """
CREATE SCHEMA IF NOT EXISTS knowledge;
CREATE EXTENSION IF NOT EXISTS vector;
"""

# embedding dimension applied via format; Phase 1 default 1536
TABLE_SQL_TEMPLATE = """
CREATE TABLE IF NOT EXISTS knowledge.chunks (
  id             uuid PRIMARY KEY,
  document_id    uuid NOT NULL,
  kb_id          uuid NOT NULL,
  content        text NOT NULL,
  parent_id      uuid,
  is_parent      boolean DEFAULT false,
  parent_content text,
  embedding      vector({dim}),
  meta           jsonb,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chunks_kb_id   ON knowledge.chunks(kb_id);
CREATE INDEX IF NOT EXISTS idx_chunks_doc_id  ON knowledge.chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_parent  ON knowledge.chunks(parent_id);
"""


class PgChunkStore:
    def __init__(self, settings: Settings | None = None):
        self.settings = settings or get_settings()
        self._pool: asyncpg.Pool | None = None

    @property
    def pool(self) -> asyncpg.Pool:
        if self._pool is None:
            raise RuntimeError("PgChunkStore not connected")
        return self._pool

    async def connect(self) -> None:
        if self._pool is not None:
            return
        self._pool = await asyncpg.create_pool(
            dsn=self.settings.database_url,
            min_size=1,
            max_size=10,
            command_timeout=60,
        )
        await self.ensure_schema()

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    async def ensure_schema(self) -> None:
        dim = self.settings.embedding_dimension
        async with self.pool.acquire() as conn:
            await conn.execute(SCHEMA_SQL)
            await conn.execute(TABLE_SQL_TEMPLATE.format(dim=dim))
            # HNSW index (idempotent-ish: ignore if exists via IF NOT EXISTS)
            await conn.execute(
                """
                DO $$
                BEGIN
                  IF NOT EXISTS (
                    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_chunks_embedding'
                  ) THEN
                    CREATE INDEX idx_chunks_embedding
                      ON knowledge.chunks USING hnsw (embedding vector_cosine_ops)
                      WITH (m = 16, ef_construction = 200);
                  END IF;
                END$$;
                """
            )
        logger.info("knowledge schema ready (embedding dim=%s)", dim)

    async def health(self) -> tuple[bool, str]:
        try:
            async with self.pool.acquire() as conn:
                await conn.fetchval("SELECT 1")
                await conn.fetchval("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
            return True, "ok"
        except Exception as e:
            return False, str(e)

    async def delete_by_document(self, document_id: str) -> int:
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM knowledge.chunks WHERE document_id = $1::uuid",
                document_id,
            )
        # asyncpg returns like "DELETE 3"
        count = int(result.split()[-1]) if result else 0
        return count

    async def delete_by_kb(self, kb_id: str) -> int:
        async with self.pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM knowledge.chunks WHERE kb_id = $1::uuid",
                kb_id,
            )
        return int(result.split()[-1]) if result else 0

    async def insert_chunks(self, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                for r in rows:
                    await self._insert_one(conn, r)
        return len(rows)

    async def replace_document_chunks(
        self,
        document_id: str,
        rows: list[dict[str, Any]],
    ) -> int:
        """
        Atomically replace all chunks for a document_id.
        Old rows remain visible until this transaction commits (no delete-before-embed hole).
        """
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute(
                    "DELETE FROM knowledge.chunks WHERE document_id = $1::uuid",
                    document_id,
                )
                for r in rows:
                    await self._insert_one(conn, r)
        return len(rows)

    async def _insert_one(self, conn: asyncpg.Connection, r: dict[str, Any]) -> None:
        emb = r.get("embedding")
        emb_str = None
        if emb is not None:
            emb_str = "[" + ",".join(str(float(x)) for x in emb) + "]"
        await conn.execute(
            """
            INSERT INTO knowledge.chunks
              (id, document_id, kb_id, content, parent_id, is_parent,
               parent_content, embedding, meta)
            VALUES
              ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6,
               $7, $8::vector, $9::jsonb)
            """,
            r["id"],
            r["document_id"],
            r["kb_id"],
            r["content"],
            r.get("parent_id"),
            r.get("is_parent", False),
            r.get("parent_content"),
            emb_str,
            json.dumps(r.get("meta") or {}),
        )

    async def vector_search(
        self,
        embedding: list[float],
        kb_ids: list[str],
        limit: int = 20,
    ) -> list[ChunkRow]:
        if not kb_ids:
            return []
        emb_str = "[" + ",".join(str(float(x)) for x in embedding) + "]"
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, document_id, kb_id, content, parent_id, is_parent,
                       parent_content, meta,
                       1 - (embedding <=> $1::vector) AS score
                FROM knowledge.chunks
                WHERE kb_id = ANY($2::uuid[])
                  AND is_parent = false
                  AND embedding IS NOT NULL
                ORDER BY embedding <=> $1::vector
                LIMIT $3
                """,
                emb_str,
                kb_ids,
                limit,
            )
        return [_row_to_chunk(r) for r in rows]

    async def get_by_ids(self, ids: list[str]) -> list[ChunkRow]:
        if not ids:
            return []
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, document_id, kb_id, content, parent_id, is_parent,
                       parent_content, meta, NULL::float AS score
                FROM knowledge.chunks
                WHERE id = ANY($1::uuid[])
                """,
                ids,
            )
        return [_row_to_chunk(r) for r in rows]

    async def get_parents(self, parent_ids: list[str]) -> dict[str, ChunkRow]:
        if not parent_ids:
            return {}
        unique = list({p for p in parent_ids if p})
        if not unique:
            return {}
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, document_id, kb_id, content, parent_id, is_parent,
                       parent_content, meta, NULL::float AS score
                FROM knowledge.chunks
                WHERE id = ANY($1::uuid[])
                """,
                unique,
            )
        return {str(r["id"]): _row_to_chunk(r) for r in rows}


def _row_to_chunk(r: asyncpg.Record) -> ChunkRow:
    meta = r["meta"]
    if isinstance(meta, str):
        meta = json.loads(meta)
    return ChunkRow(
        id=str(r["id"]),
        document_id=str(r["document_id"]),
        kb_id=str(r["kb_id"]),
        content=r["content"] or "",
        parent_id=str(r["parent_id"]) if r["parent_id"] else None,
        is_parent=bool(r["is_parent"]),
        parent_content=r["parent_content"],
        embedding=None,
        meta=meta or {},
        score=float(r["score"]) if r["score"] is not None else None,
    )


def new_uuid() -> str:
    return str(uuid.uuid4())
