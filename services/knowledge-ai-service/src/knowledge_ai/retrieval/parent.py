"""Parent resolution after RRF, before Rerank."""

from __future__ import annotations

from knowledge_ai.infrastructure.pg import ChunkRow, PgChunkStore


async def resolve_parents(
    children: list[ChunkRow],
    pg: PgChunkStore,
) -> list[ChunkRow]:
    """
    Expand child hits to parent content; dedupe by parent_id (or child id if no parent).
    Order preserved by first occurrence in fused list.
    """
    parent_ids = [c.parent_id for c in children if c.parent_id]
    parents = await pg.get_parents(parent_ids)

    seen: set[str] = set()
    out: list[ChunkRow] = []
    for c in children:
        key = c.parent_id or c.id
        if key in seen:
            continue
        seen.add(key)
        if c.parent_id and c.parent_id in parents:
            p = parents[c.parent_id]
            out.append(
                ChunkRow(
                    id=p.id,
                    document_id=p.document_id,
                    kb_id=p.kb_id,
                    content=p.content or c.parent_content or c.content,
                    parent_id=None,
                    is_parent=True,
                    parent_content=None,
                    embedding=None,
                    meta={**p.meta, "from_child_id": c.id},
                    score=c.score,
                )
            )
        elif c.parent_content:
            out.append(
                ChunkRow(
                    id=c.parent_id or c.id,
                    document_id=c.document_id,
                    kb_id=c.kb_id,
                    content=c.parent_content,
                    parent_id=None,
                    is_parent=True,
                    parent_content=None,
                    embedding=None,
                    meta={**c.meta, "from_child_id": c.id},
                    score=c.score,
                )
            )
        else:
            out.append(c)
    return out
