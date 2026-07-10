"""Reciprocal Rank Fusion."""

from __future__ import annotations

from knowledge_ai.infrastructure.pg import ChunkRow


def rrf_fuse(
    ranked_lists: list[list[ChunkRow]],
    *,
    k: int = 60,
) -> list[ChunkRow]:
    """
    Fuse multiple ranked lists by RRF score: sum 1/(k + rank).
    rank is 1-based. Same chunk id scores are summed.
    """
    scores: dict[str, float] = {}
    best: dict[str, ChunkRow] = {}

    for ranked in ranked_lists:
        for rank, item in enumerate(ranked, start=1):
            cid = item.id
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank)
            prev = best.get(cid)
            if prev is None or (item.score or 0) > (prev.score or 0):
                best[cid] = item

    ordered = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
    out: list[ChunkRow] = []
    for cid in ordered:
        row = best[cid]
        row.score = scores[cid]
        out.append(row)
    return out
