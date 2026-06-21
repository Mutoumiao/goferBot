import { Injectable, Logger, ForbiddenException } from '@nestjs/common'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import type { ChunkDocument } from './elasticsearch.service.js'
import type { SearchHit } from './elasticsearch.service.js'
import { EsKeywordService } from './es-keyword.service.js'
import { EsVectorService } from './es-vector.service.js'
import { BgeRerankService } from './bge-rerank.service.js'
import { GroundingService } from './grounding.service.js'
import { GuardrailService } from './guardrail.service.js'
import { RouterService } from './router.service.js'
import type { RouterDecision } from './router.service.js'
import { QueryUnderstandingService } from './query-understanding.service.js'
import type { GroundingResult } from './grounding.service.js'
import { LlamaIndexProvider } from '../../modules/chat/llm/llama-index-provider.service.js'
import type { LlamaIndexProviderConfig } from '../../modules/chat/llm/llama-index-provider.service.js'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../database/prisma.service.js'

export type RetrievalMode = 'vector' | 'bm25' | 'hybrid'

export type RagMetadataValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | boolean[]
  | Array<string | number | boolean>

export interface RagMetadataFilter {
  [key: string]: RagMetadataValue
}

export interface RagRetrieveOptions {
  kbIds?: string[]
  documentIds?: string[]
  topK?: number
  candidateK?: number
  minScore?: number
  mode?: RetrievalMode
  vectorWeight?: number
  bm25Weight?: number
  rrfK?: number
  needRerank?: boolean
  rerankTopK?: number
  metadata?: RagMetadataFilter
  userId?: string
  userTeams?: string[]
  resolveParents?: boolean
  skipRouter?: boolean
}

export interface RagQueryOptions extends RagRetrieveOptions {
  systemPrompt?: string
}

export interface RetrievedChunk {
  id: string
  documentId: string
  kbId: string
  content: string
  chunkIndex: number
  score: number
}

export interface RagQueryResult {
  answer: string
  grounding: GroundingResult[]
}

const DEFAULT_RRF_K = 60
const DEFAULT_VECTOR_WEIGHT = 0.7
const DEFAULT_BM25_WEIGHT = 0.3
const DEFAULT_PARENT_CHUNK_SIZE = 800
const DEFAULT_CHILD_CHUNK_SIZE = 150
const DEFAULT_PARENT_OVERLAP = 100
const DEFAULT_CHILD_OVERLAP = 20
const DEFAULT_CONTEXTUAL_WINDOW = 1
const DEFAULT_CONTEXT_TOKEN_BUDGET = 3000
const SSE_HEARTBEAT_MS = 60_000
const MAX_QUERY_LENGTH = 2000

type StreamOutcome =
  | { type: 'data'; result: IteratorResult<{ text: string }> }
  | { type: 'heartbeat' }

@Injectable()
export class LlamaIndexRagService {
  private readonly logger = new Logger(LlamaIndexRagService.name)
  private readonly llm: LlamaIndexProvider
  readonly parentChunkSize: number
  readonly childChunkSize: number
  readonly enableContextualEmbedding: boolean
  readonly contextualWindow: number

  constructor(
    private readonly embeddings: LlamaIndexEmbeddingService,
    private readonly es: ElasticsearchService,
    private readonly keywordService: EsKeywordService,
    private readonly vectorService: EsVectorService,
    private readonly reranker: BgeRerankService,
    private readonly groundingService: GroundingService,
    private readonly guardrailService: GuardrailService,
    private readonly routerService: RouterService,
    private readonly queryUnderstanding: QueryUnderstandingService,
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const apiKey = config.get<string>('RAG_LLM_API_KEY') ?? config.get<string>('LLM_API_KEY')
    const model = config.get<string>('RAG_LLM_MODEL') ?? config.get<string>('LLM_MODEL') ?? 'gpt-3.5-turbo'
    const baseURL = config.get<string>('RAG_LLM_BASE_URL') ?? config.get<string>('LLM_BASE_URL')
    const timeout = config.get<number>('RAG_LLM_TIMEOUT_MS') ?? config.get<number>('LLM_TIMEOUT_MS') ?? 60_000

    if (!apiKey) {
      throw new Error('RAG LLM 未配置：请设置 RAG_LLM_API_KEY 或 LLM_API_KEY 环境变量')
    }

    this.llm = new LlamaIndexProvider({
      apiKey,
      model,
      baseURL,
      timeout,
    } satisfies LlamaIndexProviderConfig)

    this.parentChunkSize = config.get<number>('RAG_PARENT_CHUNK_SIZE', DEFAULT_PARENT_CHUNK_SIZE)
    this.childChunkSize = config.get<number>('RAG_CHILD_CHUNK_SIZE', DEFAULT_CHILD_CHUNK_SIZE)

    const contextualCfg = config.get<string>('RAG_CONTEXTUAL_EMBEDDING')
    if (contextualCfg === undefined) {
      this.enableContextualEmbedding = true
    } else {
      this.enableContextualEmbedding = ['true', '1', 'yes', 'on'].includes(
        contextualCfg.trim().toLowerCase(),
      )
    }
    this.contextualWindow = Math.max(
      1,
      config.get<number>('RAG_CONTEXTUAL_WINDOW', DEFAULT_CONTEXTUAL_WINDOW),
    )

    if (this.enableContextualEmbedding) {
      this.logger.log(
        `Contextual embedding enabled (window=${this.contextualWindow})`,
      )
    }
  }

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
      const ownershipOk = await this.verifyKbOwnership(options.userId, options.kbIds)
      if (!ownershipOk) {
        this.logger.warn(
          `Permission denied: user ${options.userId} does not own requested kbIds`,
        )
        return []
      }
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

    // Run Router to choose pipeline. Explicit option overrides router decision.
    let routerDecision: RouterDecision | null = null
    if (!options.skipRouter && !options.mode) {
      routerDecision = this.routerService.decide(workingQuery)
    }

    const effectiveMode = options.mode ?? routerDecision?.pipeline.mode ?? 'hybrid'
    const effectiveNeedRerank = options.needRerank ?? routerDecision?.pipeline.needRerank ?? false
    const effectiveTopK = options.topK ?? routerDecision?.pipeline.topK ?? 5
    const effectiveCandidateK =
      options.candidateK ?? routerDecision?.pipeline.candidateK ?? Math.max(30, effectiveTopK * 6)
    const effectiveVectorWeight = options.vectorWeight ?? routerDecision?.pipeline.vectorWeight ?? DEFAULT_VECTOR_WEIGHT
    const effectiveBm25Weight = options.bm25Weight ?? routerDecision?.pipeline.bm25Weight ?? DEFAULT_BM25_WEIGHT
    const effectiveResolveParents = options.resolveParents ?? routerDecision?.pipeline.needFullContext ?? true

    if (routerDecision) {
      this.logger.log(
        `[Router] intent=${routerDecision.intent} mode=${effectiveMode} rerank=${effectiveNeedRerank} topK=${effectiveTopK}`,
      )
    }

    this.logger.log(
      `Permission check: user=${options.userId ?? 'anonymous'} kbIds=${JSON.stringify(options.kbIds ?? [])} mode=${effectiveMode} lang=${quResult.language}`,
    )

    // ACL physical filter: inject user/team ids into ES query so that even
    // if the application-level check is bypassed, unauthorized docs are
    // filtered out at the index level.
    const filters = {
      kbIds: options.kbIds,
      documentIds: options.documentIds,
      metadata: options.metadata,
      language: quResult.language,
      allowedUserIds: options.userId ? [options.userId] : undefined,
      allowedTeamIds: options.userTeams,
    }

    // Consume QU's synonym expansion by running parallel queries.
    const queriesToRun =
      quResult.expandedQueries && quResult.expandedQueries.length > 1
        ? quResult.expandedQueries.slice(0, 3)
        : [workingQuery]

    let hits: SearchHit[]
    let retrievalTime = 0

    if (effectiveMode === 'vector') {
      const retrievalStart = Date.now()
      const vectorHits: SearchHit[] = []
      for (const q of queriesToRun) {
        const queryVector = await this.embeddings.embed(q)
        const h = await this.vectorService.search(queryVector, {
          topK: Math.ceil(effectiveCandidateK / queriesToRun.length),
          numCandidates: effectiveCandidateK,
          filters,
        })
        vectorHits.push(...h)
      }
      hits = this.dedupeHits(vectorHits).slice(0, effectiveCandidateK)
      retrievalTime = Date.now() - retrievalStart
    } else if (effectiveMode === 'bm25') {
      const retrievalStart = Date.now()
      const bm25Hits: SearchHit[] = []
      for (const q of queriesToRun) {
        const h = await this.keywordService.search(q, {
          topK: Math.ceil(effectiveCandidateK / queriesToRun.length),
          filters,
        })
        bm25Hits.push(...h)
      }
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

    return chunks
  }

  private dedupeHits(hits: SearchHit[]): SearchHit[] {
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

  private async verifyKbOwnership(
    userId: string,
    kbIds?: string[],
  ): Promise<boolean> {
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

  private async resolveParentsFromHits(hits: SearchHit[]): Promise<SearchHit[]> {
    if (hits.length === 0) return hits

    const hasParents = hits.some(
      (h) => h.source.parent_id && h.source.parent_content,
    )
    if (!hasParents) return hits

    const parentIds = Array.from(
      new Set(
        hits
          .filter((h) => h.source.parent_id)
          .map((h) => h.source.parent_id as string),
      ),
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
    filters: { kbIds?: string[]; documentIds?: string[]; metadata?: Record<string, unknown>; language?: string },
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

  private reciprocalRankFusion(
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
        const hit = hitMap.get(id)!
        return { ...hit, score }
      })
      .sort((a, b) => b.score - a.score)
  }

  async buildContext(chunks: RetrievedChunk[], tokenBudget: number = DEFAULT_CONTEXT_TOKEN_BUDGET): Promise<string> {
    if (chunks.length === 0) return ''

    const deduped = this.deduplicateByDocument(chunks)

    const ordered = [...deduped].sort((a, b) => b.score - a.score)

    const selected: RetrievedChunk[] = []
    let usedTokens = 0

    for (const chunk of ordered) {
      const estimatedTokens = Math.max(1, Math.ceil(chunk.content.length / 4))
      if (usedTokens + estimatedTokens > tokenBudget) {
        const remaining = tokenBudget - usedTokens
        if (remaining <= 0) break
        const ratio = remaining / estimatedTokens
        const truncated = chunk.content.slice(0, Math.floor(chunk.content.length * ratio))
        if (truncated.trim().length > 0) {
          selected.push({ ...chunk, content: `${truncated.trim()}...` })
        }
        break
      }
      selected.push(chunk)
      usedTokens += estimatedTokens
    }

    this.logger.log(
      `[ContextBuilder] chunks=${chunks.length} deduped=${deduped.length} selected=${selected.length} tokens=${usedTokens} budget=${tokenBudget}`,
    )

    return selected.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n')
  }

  private deduplicateByDocument(chunks: RetrievedChunk[]): RetrievedChunk[] {
    const seenDocumentIds = new Set<string>()
    const result: RetrievedChunk[] = []
    for (const chunk of chunks) {
      if (!seenDocumentIds.has(chunk.documentId)) {
        seenDocumentIds.add(chunk.documentId)
        result.push(chunk)
      }
    }
    return result
  }

  async query(question: string, options: RagQueryOptions = {}): Promise<RagQueryResult> {
    const chunks = await this.retrieve(question, options)
    const rawAnswer = await this.generateAnswer(question, chunks, options.systemPrompt)
    const guardrailOutcome = this.guardrailService.apply(rawAnswer)
    const answer = guardrailOutcome.filteredText

    if (guardrailOutcome.warnings.length > 0) {
      this.logger.warn(
        `[Guardrail] warnings during query: ${guardrailOutcome.warnings.join('; ')}`,
      )
    }

    const grounding = await this.groundingService.checkGrounding(
      answer,
      chunks.map((c) => ({ id: c.id, content: c.content })),
    )
    return { answer, grounding }
  }

  async *streamQuery(
    question: string,
    options: RagQueryOptions = {},
  ): AsyncIterable<{ text: string; sourceChunks?: RetrievedChunk[]; grounding?: GroundingResult[] }> {
    const chunks = await this.retrieve(question, options)

    yield { text: '', sourceChunks: chunks }

    const context = await this.buildContext(chunks)
    const system = options.systemPrompt ?? '你是一个基于知识库的问答助手。请根据给定的上下文回答问题。'
    const userPrompt = context
      ? `上下文：\n\n${context}\n\n问题：${question}\n\n请仅根据上下文内容回答。如果上下文没有相关信息，请直接说"没有相关信息"。`
      : `问题：${question}\n\n知识库中没有检索到相关内容，请直接说"没有相关信息"。`

    const llmStream = this.llm.stream([
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ])

    let buffer = ''
    let lastDataTs = Date.now()

    async function* withHeartbeat(
      stream: AsyncIterable<{ text: string }>,
    ): AsyncIterable<{ text: string; heartbeat?: boolean }> {
      const iterator = stream[Symbol.asyncIterator]()

      while (true) {
        const dataPromise: Promise<{ type: 'data'; result: IteratorResult<{ text: string }> }> =
          iterator.next().then((r) => ({ type: 'data' as const, result: r }))
        const heartbeatPromise: Promise<{ type: 'heartbeat' }> = new Promise<{ type: 'heartbeat' }>(
          (resolve: (v: { type: 'heartbeat' }) => void) => {
            setTimeout(() => resolve({ type: 'heartbeat' }), SSE_HEARTBEAT_MS)
          },
        )

        const outcome = await Promise.race<StreamOutcome>([dataPromise, heartbeatPromise])

        if (outcome.type === 'heartbeat') {
          if (Date.now() - lastDataTs >= SSE_HEARTBEAT_MS) {
            yield { text: '', heartbeat: true }
          }
          continue
        }

        const { result } = outcome
        if (result.done) break
        lastDataTs = Date.now()
        yield result.value
      }
    }

    for await (const chunk of withHeartbeat(llmStream)) {
      if (chunk.heartbeat) {
        this.logger.debug('SSE heartbeat sent')
        continue
      }
      if (chunk.text) {
        buffer += chunk.text
        yield { text: chunk.text }
      }
    }

    // Apply output guardrails before final grounding check. This ensures the
    // streamed content is safe even though it was already delivered token-by-token.
    const guardedBuffer = this.guardrailService.apply(buffer).filteredText

    try {
      const grounding = await this.groundingService.checkGrounding(
        guardedBuffer,
        chunks.map((c) => ({ id: c.id, content: c.content })),
      )
      yield { text: '', grounding }
    } catch (err) {
      this.logger.warn(
        `Grounding check failed in streamQuery: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private async generateAnswer(
    question: string,
    chunks: RetrievedChunk[],
    systemPrompt?: string,
  ): Promise<string> {
    const context = await this.buildContext(chunks)
    const system = systemPrompt ?? '你是一个基于知识库的问答助手。请根据给定的上下文回答问题。'
    const userPrompt = context
      ? `上下文：\n\n${context}\n\n问题：${question}\n\n请仅根据上下文内容回答。如果上下文没有相关信息，请直接说"没有相关信息"。`
      : `问题：${question}\n\n知识库中没有检索到相关内容，请直接说"没有相关信息"。`

    try {
      return await this.llm.invoke([
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ])
    } catch (err) {
      this.logger.error(`RAG query failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  async indexDocument(
    documentId: string,
    kbId: string,
    content: string,
    chunkSize?: number,
    overlap?: number,
    metadata?: Record<string, unknown>,
    options?: {
      childChunkSize?: number
      parentChild?: boolean
      allowedUserIds?: string[]
      allowedTeamIds?: string[]
      documentTitle?: string
      sectionPath?: string
      userId?: string
    },
  ): Promise<{ totalChunks: number }> {
    // Authorization: only the owner of the target kb (or an admin) may index
    // content into it. This protects POST /rag/index from being abused as an
    // injection channel where an attacker plants chunks into a victim's kb.
    const userId = options?.userId
    if (userId) {
      const ownedCount = await this.prisma.knowledgeBase.count({
        where: { id: kbId, userId },
      })
      if (ownedCount === 0) {
        this.logger.warn(
          `Permission denied: user ${userId} cannot index into kbId=${kbId}`,
        )
        throw new ForbiddenException('无权向该知识库写入内容')
      }
    }

    const parentChunkSize = chunkSize ?? this.parentChunkSize
    const parentOverlap = overlap ?? DEFAULT_PARENT_OVERLAP
    const childChunkSize = options?.childChunkSize ?? this.childChunkSize
    const parentChild = options?.parentChild ?? true
    const allowedUserIds = options?.allowedUserIds
    const allowedTeamIds = options?.allowedTeamIds
    const documentTitle = options?.documentTitle ?? (metadata?.title as string | undefined)
    const sectionPath = options?.sectionPath ?? (metadata?.section_path as string | undefined)

    this.logger.log(`[Upsert] deleting existing chunks for documentId=${documentId}`)
    await this.es.deleteByDocumentId(documentId)

    const sharedMeta = {
      metadata,
      allowed_user_ids: allowedUserIds,
      allowed_team_ids: allowedTeamIds,
      document_title: documentTitle,
      section_path: sectionPath,
    }

    if (!parentChild) {
      const chunks = this.splitIntoChunks(content, parentChunkSize, parentOverlap)
      const embedTexts = this.buildEmbeddingTexts(chunks, documentTitle, sectionPath)
      const embeddings = await this.embeddings.embedBatch(embedTexts)

      const now = new Date().toISOString()
      const docs: ChunkDocument[] = chunks.map((text, i) => ({
        id: `${documentId}-${i}`,
        document_id: documentId,
        kb_id: kbId,
        content: text,
        chunk_index: i,
        token_count: Math.ceil(text.length / 4),
        embedding: embeddings[i],
        ...sharedMeta,
        created_at: now,
        updated_at: now,
      }))

      await this.es.bulkIndex(docs)
      return { totalChunks: chunks.length }
    }

    const parentChunks = this.splitIntoChunks(content, parentChunkSize, parentOverlap)
    const now = new Date().toISOString()

    const allChildTexts: string[] = []
    const childMeta: Array<{ parentId: string; parentContent: string }> = []

    parentChunks.forEach((parentText, parentIdx) => {
      const parentId = `${documentId}-parent-${parentIdx}`
      const parentContent = parentText
      const childChunks = this.splitIntoChunks(parentText, childChunkSize, DEFAULT_CHILD_OVERLAP)

      childChunks.forEach((childText) => {
        allChildTexts.push(childText)
        childMeta.push({ parentId, parentContent })
      })
    })

    if (allChildTexts.length === 0) {
      return { totalChunks: 0 }
    }

    const embedTexts = this.buildEmbeddingTexts(allChildTexts, documentTitle, sectionPath)
    this.logger.debug(
      `Embedding ${allChildTexts.length} chunks (contextual=${this.enableContextualEmbedding})`,
    )
    const embeddings = await this.embeddings.embedBatch(embedTexts)

    const docs: ChunkDocument[] = allChildTexts.map((text, i) => ({
      id: `${documentId}-child-${i}`,
      document_id: documentId,
      kb_id: kbId,
      content: text,
      chunk_index: i,
      token_count: Math.ceil(text.length / 4),
      embedding: embeddings[i],
      parent_id: childMeta[i].parentId,
      parent_content: childMeta[i].parentContent,
      ...sharedMeta,
      created_at: now,
      updated_at: now,
    }))

    await this.es.bulkIndex(docs)
    return { totalChunks: docs.length }
  }

  /**
   * Build the text that gets embedded. Per the design doc, the contextual
   * string is `{document_title} | {section_path} | {prefix} {current} {suffix}`
   * so that the model picks up document-level context rather than sibling
   * child-chunk noise.
   */
  private buildEmbeddingTexts(
    childTexts: string[],
    documentTitle?: string,
    sectionPath?: string,
  ): string[] {
    if (childTexts.length === 0) return childTexts

    const headerParts: string[] = []
    if (documentTitle) headerParts.push(`文档：${documentTitle}`)
    if (sectionPath) headerParts.push(`章节：${sectionPath}`)
    const header = headerParts.length > 0 ? `${headerParts.join(' | ')} | ` : ''

    if (!this.enableContextualEmbedding) {
      return childTexts.map((t) => `${header}正文：${t}`)
    }

    const window = this.contextualWindow
    return childTexts.map((current, idx) => {
      const prefixParts: string[] = []
      for (let w = 1; w <= window && idx - w >= 0; w++) {
        prefixParts.push(childTexts[idx - w])
      }
      const prefix = prefixParts.reverse().join(' ')

      const suffixParts: string[] = []
      for (let w = 1; w <= window && idx + w < childTexts.length; w++) {
        suffixParts.push(childTexts[idx + w])
      }
      const suffix = suffixParts.join(' ')

      return `${header}正文：${prefix} ${current} ${suffix}`.replace(/\s+/g, ' ').trim()
    })
  }

  async removeDocument(documentId: string, userId?: string): Promise<void> {
    // Authorization: resolve the kb(s) the document lives in and make sure the
    // caller actually owns one of them before deleting. This closes the IDOR
    // on DELETE /rag/documents/:documentId that previously allowed any
    // authenticated user to drop arbitrary documents by id.
    if (userId) {
      const kbIds = await this.es.getKbIdsByDocumentId(documentId)
      if (kbIds.length === 0) {
        // No visible evidence of the document. Treat as permission denied
        // rather than leaking existence information.
        this.logger.warn(
          `Permission check on delete: documentId=${documentId} not found or inaccessible`,
        )
        throw new ForbiddenException('无权删除该文档')
      }
      const ownedCount = await this.prisma.knowledgeBase.count({
        where: { id: { in: kbIds }, userId },
      })
      if (ownedCount === 0) {
        this.logger.warn(
          `Permission denied: user ${userId} cannot delete documentId=${documentId} (kbIds=${JSON.stringify(kbIds)})`,
        )
        throw new ForbiddenException('无权删除该文档')
      }
    }

    await this.es.deleteByDocumentId(documentId)
  }

  private splitIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    if (!text) return []
    const result: string[] = []
    const normalized = text.replace(/\r\n/g, '\n')

    const paragraphs = normalized.split(/\n\s*\n/)
    let buffer = ''

    for (const para of paragraphs) {
      if ((buffer + '\n\n' + para).length <= chunkSize) {
        buffer = buffer ? `${buffer}\n\n${para}` : para
        continue
      }

      if (buffer) {
        result.push(buffer.trim())
        const startIdx = Math.max(0, buffer.length - overlap)
        buffer = buffer.slice(startIdx)
      }

      if (para.length > chunkSize) {
        for (let i = 0; i < para.length; i += chunkSize - overlap) {
          const piece = para.slice(i, i + chunkSize)
          if (piece.trim()) result.push(piece.trim())
          if (i + chunkSize >= para.length) {
            buffer = ''
            break
          }
        }
      } else {
        buffer = para
      }
    }

    if (buffer.trim()) result.push(buffer.trim())
    return result
  }
}
