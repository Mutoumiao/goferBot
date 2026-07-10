import pytest

from knowledge_ai.infrastructure.pg import ChunkRow
from knowledge_ai.retrieval.parent import resolve_parents


class FakePg:
    async def get_parents(self, parent_ids):
        return {
            "p1": ChunkRow(
                id="p1",
                document_id="d1",
                kb_id="k1",
                content="PARENT BODY",
                parent_id=None,
                is_parent=True,
                parent_content=None,
                embedding=None,
                meta={},
            )
        }


@pytest.mark.asyncio
async def test_resolve_parents_dedupe():
    children = [
        ChunkRow(
            id="c1",
            document_id="d1",
            kb_id="k1",
            content="child1",
            parent_id="p1",
            is_parent=False,
            parent_content="PARENT BODY",
            embedding=None,
            meta={},
            score=0.9,
        ),
        ChunkRow(
            id="c2",
            document_id="d1",
            kb_id="k1",
            content="child2",
            parent_id="p1",
            is_parent=False,
            parent_content="PARENT BODY",
            embedding=None,
            meta={},
            score=0.8,
        ),
    ]
    out = await resolve_parents(children, FakePg())  # type: ignore[arg-type]
    assert len(out) == 1
    assert out[0].content == "PARENT BODY"
