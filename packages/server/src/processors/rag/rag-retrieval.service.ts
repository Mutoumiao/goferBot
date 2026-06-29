import { ForbiddenException, Injectable, Logger } from '@nestjs/common'
import { CacheService } from '../../shared/cache/cache.service.js'
import { PrismaService } from '../database/prisma.service.js'
import { BgeRerankService } from './bge-rerank.service.js'
import type { SearchHit } from './elasticsearch.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { EsKeywordService } from './es-keyword.service.js'
import { EsVectorService } from './es-vector.service.js'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'
import { QueryUnderstandingService } from './query-understanding.service.js'
import type { RagRetrieveOptions, RetrievedChunk } from './rag-types.js'
import type { RouterDecision } from './router.service.js'
import { RouterService } from './router.service.js'

const DEFAULT_RRF_K = 60
const DEFAULT_VECTOR_WEIGHT = 0.7
const DEFAULT_BM25_WEIGHT = 0.3
const MAX_QUERY_LENGTH = 2000
const RAG_RETRIEVAL_CACHE_PREFIX = 'rag:retrieval:'
const RAG_RETRIEVAL_CACHE_TTL = 60

@Injectable()
export class RagRetrievalService {
  private readonly logger = new Logger(RagRetrievalService.name)

  constructor(
    private readonly embeddings: LlamaIndexEmbeddingService,
    private readonly es: ElasticsearchService,
    private readonly keywordService: EsKeywordService,
    private readonly vectorService: EsVectorService,
    private readonly reranker: BgeRerankService,
    private readonly routerService: RouterService,
    private readonly queryUnderstanding: QueryUnderstandingService,
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async retrieve(query: string, options: RagRetrieveOptions = {}): Promise<RetrievedChunk[]> {
    const startTs = Date.now()
    let workingQuery = query

    if (workingQuery.length > MAX_QUERY_LENGTH) {
      this.logger.warn(
        `Query length ${workingQuery.length} exceeds limit ${MAX_QUERY_LENGTH}, truncating`,
      )
      workingQuery = workingQuery.slice(0, MAX_QUERY_LENGTH)
    }

    if (options.kbIds !== undefined && options.kbIds.length === 0) {
      this.logger.warn(
        `Permission check: user ${options.userId ?? 'anonymous'} provided empty kbIds, returning empty result`,
      )
      return []
    }

    if (options.userId) {
      if (options.kbIds === undefined) {
        this.logger.warn(`Permission denied: user ${options.userId} called retrieve without kbIds`)
        throw new ForbiddenException('必须显式指定要检索的知识库 (kbIds)')
      }
      const ownershipOk = await this.verifyKbOwnership(options.userId, options.kbIds)
      if (!ownershipOk) {
        this.logger.warn(`Permission denied: user ${options.userId} does not own requested kbIds`)
        throw new ForbiddenException('无权访问指定的知识库')
      }
    }

    const keyParts = [
      workingQuery,
      options.kbIds?.join(',') ?? '',
      options.documentIds?.join(',') ?? '',
      options.mode ?? '',
      String(options.topK ?? ''),
      String(options.candidateK ?? ''),
      String(options.vectorWeight ?? ''),
      String(options.bm25Weight ?? ''),
      String(options.rrfK ?? ''),
      String(options.needRerank ?? ''),
      String(options.rerankTopK ?? ''),
      options.metadata ?? '',
      options.userId ?? '',
      options.userTeams?.join(',') ?? '',
      String(options.resolveParents ?? ''),
      String(options.skipRouter ?? ''),
    ]
    const cacheKey = `${RAG_RETRIEVAL_CACHE_PREFIX}${keyParts.join('|')}`

    const cached = await this.cacheService.get<RetrievedChunk[]>(cacheKey)
    if (cached) {
      this.logger.log('RAG cache hit')
      return cached
    }

    const quStart = Date.now()
    const quResult = await this.queryUnderstanding.process(workingQuery)
    const quMs = Date.now() - quStart
    if (quResult.rewrittenQuery && quResult.rewrittenQuery !== workingQuery) {
      this.logger.log(
        `[QueryUnderstanding] rewritten: ${JSON.stringify(workingQuery)} -> ${JSON.stringify(quResult.rewrittenQuery)} (${quMs}ms)`,
      )
      workingQuery = quResult.rewrittenQuery
    }

    let routerDecision: RouterDecision | null = null
    if (!options.skipRouter && !options.mode) {
      routerDecision = this.routerService.decide(workingQuery)
    }

    const effectiveMode = options.mode ?? routerDecision?.pipeline.mode ?? 'hybrid'
    const effectiveNeedRerank = options.needRerank ?? routerDecision?.pipeline.needRerank ?? false
    const effectiveTopK = options.topK ?? routerDecision?.pipeline.topK ?? 5
    const effectiveCandidateK =
      options.candidateK ?? routerDecision?.pipeline.candidateK ?? Math.max(30, effectiveTopK * 6)
    const effectiveVectorWeight =
      options.vectorWeight ?? routerDecision?.pipeline.vectorWeight ?? DEFAULT_VECTOR_WEIGHT
    const effectiveBm25Weight =
      options.bm25Weight ?? routerDecision?.pipeline.bm25Weight ?? DEFAULT_BM25_WEIGHT
    const effectiveResolveParents =
      options.resolveParents ?? routerDecision?.pipeline.needFullContext ?? true

    if (routerDecision) {
      this.logger.log(
        `[Router] intent=${routerDecision.intent} mode=${effectiveMode} rerank=${effectiveNeedRerank} topK=${effectiveTopK}`,
      )
    }

    this.logger.log(
      `Permission check: user=${options.userId ?? 'anonymous'} kbIds=${JSON.stringify(options.kbIds ?? [])} mode=${effectiveMode} lang=${quResult.language}`,
    )

    const filters = {
      kbIds: options.kbIds,
      documentIds: options.documentIds,
      metadata: options.metadata,
      language: quResult.language,
      allowedUserIds: options.userId ? [options.userId] : undefined,
      allowedTeamIds: options.userTeams,
    }

    const queriesToRun =
      quResult.expandedQueries && quResult.expandedQueries.length > 1
        ? quResult.expandedQueries.slice(0, 3)
        : [workingQuery]

    let hits: SearchHit[]
    let retrievalTime = 0

    if (effectiveMode === 'vector') {
      const retrievalStart = Date.now()
      const vectorHits = (
        await Promise.all(
          queriesToRun.map(async (q) => {
            const queryVector = await this.embeddings.embed(q)
            return this.vectorService.search(queryVector, {
              topK: Math.ceil(effectiveCandidateK / queriesToRun.length),
              numCandidates: effectiveCandidateK,
              filters,
            })
          }),
        )
      ).flat()
      hits = this.dedupeHits(vectorHits).slice(0, effectiveCandidateK)
      retrievalTime = Date.now() - retrievalStart
    } else if (effectiveMode === 'bm25') {
      const retrievalStart = Date.now()
      const bm25Hits = (
        await Promise.all(
          queriesToRun.map((q) =>
            this.keywordService.search(q, {
              topK: Math.ceil(effectiveCandidateK / queriesToRun.length),
              filters,
            }),
          ),
        )
      ).flat()
      hits = this.dedupeHits(bm25Hits).slice(0, effectiveCandidateK)
      retrievalTime = Date.now() - retrievalStart
    } else {
      const retrievalStart = Date.now()
      hits = await this.retrieveHybrid(workingQuery, effectiveCandidateK, filters, {
        ...options,
        vectorWeight: effectiveVectorWeight,
        bm25Weight: effectiveBm25Weight,
      })
      retrievalTime = Date.now() - retrievalStart
    }

    let rerankTime = 0
    if (effectiveNeedRerank && hits.length > 0) {
      const rerankStart = Date.now()
      const reranked = await this.reranker.rerank(
        workingQuery,
        hits.map((h) => ({
          id: h.id,
          content: h.source.content,
          metadata: h.source.metadata,
          originalScore: h.score,
        })),
        { topK: options.rerankTopK ?? effectiveTopK },
      )
      const rerankMap = new Map(reranked.map((r) => [r.id, r.score]))
      hits = hits
        .map((h) => ({ ...h, score: rerankMap.get(h.id) ?? h.score }))
        .sort((a, b) => b.score - a.score)
      rerankTime = Date.now() - rerankStart
    }

    if (effectiveResolveParents) {
      hits = await this.resolveParentsFromHits(hits)
    }

    const topK = effectiveTopK
    const minScore = options.minScore ?? 0
    const chunks = hits
      .filter((h) => h.score >= minScore)
      .slice(0, topK)
      .map((h) => ({
        id: h.source.id,
        documentId: h.source.document_id,
        kbId: h.source.kb_id,
        content: h.source.content,
        chunkIndex: h.source.chunk_index,
        score: h.score,
      }))

    this.logger.log(
      `[RAG] userId=${options.userId ?? 'anonymous'} queryLen=${workingQuery.length} mode=${effectiveMode} intent=${routerDecision?.intent ?? 'manual'} hits=${chunks.length} quMs=${quMs} retrievalMs=${retrievalTime} rerankMs=${rerankTime} totalMs=${Date.now() - startTs}`,
    )

    await this.cacheService.set(cacheKey, chunks, RAG_RETRIEVAL_CACHE_TTL)

    return chunks
  }

  dedupeHits(hits: SearchHit[]): SearchHit[] {
    const seen = new Set<string>()
    const result: SearchHit[] = []
    for (const h of hits) {
      if (!seen.has(h.id)) {
        seen.add(h.id)
        result.push(h)
      }
    }
    return result.sort((a, b) => b.score - a.score)
  }

  async verifyKbOwnership(userId: string, kbIds?: string[]): Promise<boolean> {
    if (!kbIds || kbIds.length === 0) return true
    try {
      const ownedCount = await this.prisma.knowledgeBase.count({
        where: { id: { in: kbIds }, userId },
      })
      return ownedCount === kbIds.length
    } catch (err) {
      this.logger.warn(
        `Ownership check failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return false
    }
  }

  async resolveParentsFromHits(hits: SearchHit[]): Promise<SearchHit[]> {
    if (hits.length === 0) return hits

    const hasParents = hits.some((h) => h.source.parent_id && h.source.parent_content)
    if (!hasParents) return hits

    const parentIds = Array.from(
      new Set(hits.filter((h) => h.source.parent_id).map((h) => h.source.parent_id as string)),
    )

    const parentMap = await this.es.getParentsByIds(parentIds)

    const seenParents = new Set<string>()
    const resolved: SearchHit[] = []

    for (const hit of hits) {
      if (hit.source.parent_id) {
        const parentId = hit.source.parent_id
        const parentContent =
          parentMap.get(parentId) ?? hit.source.parent_content ?? hit.source.content

        if (seenParents.has(parentId)) continue
        seenParents.add(parentId)

        resolved.push({
          ...hit,
          source: {
            ...hit.source,
            content: parentContent,
          },
        })
      } else {
        resolved.push(hit)
      }
    }

    return resolved
  }

  private async retrieveHybrid(
    query: string,
    candidateK: number,
    filters: {
      kbIds?: string[]
      documentIds?: string[]
      metadata?: Record<string, unknown>
      language?: string
    },
    options: RagRetrieveOptions = {},
  ): Promise<SearchHit[]> {
    const queryVector = await this.embeddings.embed(query)
    const [vectorHits, bm25Hits] = await Promise.all([
      this.vectorService.search(queryVector, {
        topK: candidateK,
        numCandidates: candidateK * 5,
        filters,
      }),
      this.keywordService.search(query, { topK: candidateK, filters }),
    ])

    return this.reciprocalRankFusion(vectorHits, bm25Hits, options)
  }

  reciprocalRankFusion(
    vectorHits: SearchHit[],
    bm25Hits: SearchHit[],
    options: RagRetrieveOptions = {},
  ): SearchHit[] {
    const vectorWeight = options.vectorWeight ?? DEFAULT_VECTOR_WEIGHT
    const bm25Weight = options.bm25Weight ?? DEFAULT_BM25_WEIGHT
    const rrfK = options.rrfK ?? DEFAULT_RRF_K

    const scoreMap = new Map<string, number>()
    const hitMap = new Map<string, SearchHit>()

    vectorHits.forEach((h, idx) => {
      scoreMap.set(h.id, (scoreMap.get(h.id) ?? 0) + vectorWeight / (rrfK + idx + 1))
      hitMap.set(h.id, h)
    })

    bm25Hits.forEach((h, idx) => {
      scoreMap.set(h.id, (scoreMap.get(h.id) ?? 0) + bm25Weight / (rrfK + idx + 1))
      if (!hitMap.has(h.id)) hitMap.set(h.id, h)
    })

    return Array.from(scoreMap.entries())
      .map(([id, score]) => {
        const hit = hitMap.get(id)
        if (!hit) return null
        return { ...hit, score }
      })
      .filter((h): h is SearchHit => h !== null)
      .sort((a, b) => b.score - a.score)
  }
}
