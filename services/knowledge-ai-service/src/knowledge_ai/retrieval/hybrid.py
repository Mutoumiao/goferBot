"""Hybrid retrieval: L1 → filter → BM25∥vector → RRF → Parent → API Rerank."""

from __future__ import annotations

import asyncio
import logging

from knowledge_ai.config import Settings, get_settings
from knowledge_ai.indexing.embedder import Embedder
from knowledge_ai.infrastructure.elasticsearch_store import ElasticsearchStore
from knowledge_ai.infrastructure.pg import ChunkRow, PgChunkStore
from knowledge_ai.observability.trace import TraceContext
from knowledge_ai.retrieval.api_rerank import api_rerank
from knowledge_ai.retrieval.parent import resolve_parents
from knowledge_ai.retrieval.rrf import rrf_fuse
from knowledge_ai.schemas import (
    HistoryMessage,
    PromptsConfig,
    ProviderConfig,
    RetrievalMode,
    SourceItem,
)
from knowledge_ai.understanding.merged import MergedUnderstanding

logger = logging.getLogger("knowledge_ai.hybrid")


class HybridRetriever:
    def __init__(
        self,
        pg: PgChunkStore,
        es: ElasticsearchStore,
        settings: Settings | None = None,
    ):
        self.pg = pg
        self.es = es
        self.settings = settings or get_settings()

    async def retrieve(
        self,
        query: str,
        kb_ids: list[str],
        *,
        top_k: int | None = None,
        history: list[HistoryMessage] | None = None,
        provider: ProviderConfig | None = None,
        prompts: PromptsConfig | None = None,
        retrieval_mode: RetrievalMode = RetrievalMode.strict,
        trace: TraceContext | None = None,
    ) -> tuple[list[SourceItem], bool, bool]:
        """
        Returns (sources, retrieval_empty, degraded).
        Pipeline order: L1 → filter kb_ids → BM25∥vector → RRF → Parent → Rerank.
        """
        trace = trace or TraceContext.create()
        top_k = top_k or self.settings.default_top_k
        candidate_n = max(self.settings.retrieve_candidates, top_k)

        with trace.span("L1:understanding"):
            understanding = await MergedUnderstanding(provider, prompts).understand(
                query, history
            )
            search_q = understanding.rewritten_query or query

        # L2 metadata filter: trust Nest-validated kb_ids only
        with trace.span("L2:filter", kb_ids=kb_ids):
            if not kb_ids:
                return [], True, False

        # L3 parallel BM25 + vector
        with trace.span("L3:hybrid_search"):
            embedder = Embedder(provider)
            query_emb = (await embedder.embed_texts([search_q]))[0]
            bm25_task = self.es.bm25_search(search_q, kb_ids, limit=candidate_n)
            vec_task = self.pg.vector_search(query_emb, kb_ids, limit=candidate_n)
            bm25_hits, vec_hits = await asyncio.gather(bm25_task, vec_task)

        with trace.span("L4:rrf", k=self.settings.rrf_k):
            fused = rrf_fuse([vec_hits, bm25_hits], k=self.settings.rrf_k)

        with trace.span("L5:parent"):
            parents = await resolve_parents(fused, self.pg)

        with trace.span("L6:rerank"):
            ranked, degraded = await api_rerank(
                search_q,
                parents,
                provider,
                top_k=top_k,
                trace=trace,
            )

        sources = [_to_source(c) for c in ranked]
        empty = len(sources) == 0
        trace.attributes["retrieval_empty"] = empty
        trace.attributes["retrieval_mode"] = retrieval_mode.value
        return sources, empty, degraded or trace.degraded


def _to_source(c: ChunkRow) -> SourceItem:
    content = c.content
    if content and len(content) > 500:
        content = content[:500] + "…"
    return SourceItem(
        kb_id=c.kb_id,
        document_id=c.document_id,
        chunk_id=c.id,
        content=content,
        score=c.score,
        parent_id=c.parent_id,
    )
