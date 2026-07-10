from knowledge_ai.infrastructure.pg import ChunkRow
from knowledge_ai.retrieval.rrf import rrf_fuse


def _c(id_: str, score: float = 1.0) -> ChunkRow:
    return ChunkRow(
        id=id_,
        document_id="d1",
        kb_id="k1",
        content=id_,
        parent_id=None,
        is_parent=False,
        parent_content=None,
        embedding=None,
        meta={},
        score=score,
    )


def test_rrf_prefers_multi_channel_hits():
    a = [_c("a"), _c("b"), _c("c")]
    b = [_c("b"), _c("a"), _c("d")]
    fused = rrf_fuse([a, b], k=60)
    ids = [x.id for x in fused]
    # a and b appear in both lists → should rank high
    assert ids[0] in ("a", "b")
    assert set(ids) == {"a", "b", "c", "d"}
