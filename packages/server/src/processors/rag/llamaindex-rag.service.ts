import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { LlamaIndexProviderConfig } from '../../modules/chat/llm/llama-index-provider.service.js'
import { LlamaIndexProvider } from '../../modules/chat/llm/llama-index-provider.service.js'
import { ConfigChangedEvent, MODEL_PROVIDER_ERROR_CODES } from '../../modules/settings/constants.js'
import type { ModelProvider, Settings } from '../../modules/settings/dto/settings.dto.js'
import { ModelProviderService } from '../../modules/settings/model-provider.service.js'
import { SystemConfigService } from '../../modules/settings/system-config.service.js'
import { PrismaService } from '../database/prisma.service.js'
import { BgeRerankService } from './bge-rerank.service.js'
import type { ChunkDocument, SearchHit } from './elasticsearch.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { EsKeywordService } from './es-keyword.service.js'
import { EsVectorService } from './es-vector.service.js'
import type { GroundingResult } from './grounding.service.js'
import { GroundingService } from './grounding.service.js'
import { GuardrailService } from './guardrail.service.js'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'
import { QueryUnderstandingService } from './query-understanding.service.js'
import type { RouterDecision } from './router.service.js'
import { RouterService } from './router.service.js'

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

/**
 * LlamaIndexRagService —— RAG 系统的「大脑」与总编排器
 *
 *   本服务把一条用户提问变成了「带来源的答案」。整条链路分为 5 条主线：
 *     1. retrieve()       只检索：拿到相关文档 chunks
 *     2. query()           检索 + 生成 + 安全校验
 *     3. streamQuery()     流式版本（SSE 逐 token 输出 + 心跳保活）
 *     4. indexDocument()   把一篇文档切分、Embedding、写入 ES
 *     5. removeDocument()  删除文档（带 IDOR 防护）
 *
 * 核心流水线：
 *   查询理解 → 意图路由 → 混合检索(BM25+向量+RRF) → 二阶段重排
 *     → Parent-Child 聚合 → 构建上下文 → LLM 生成 → Guardrail → Grounding
 *
 * 安全设计：
 *   双层 ACL —— 应用层 verifyKbOwnership + 索引层 ES knn.filter 物理过滤
 *   IDOR 防护 —— removeDocument 对"不存在"统一按无权处理，不暴露存在性
 */
@Injectable()
export class LlamaIndexRagService implements OnModuleInit {
  private readonly logger = new Logger(LlamaIndexRagService.name)
  private llm: LlamaIndexProvider | null = null
  private parentChunkSize = DEFAULT_PARENT_CHUNK_SIZE
  private childChunkSize = DEFAULT_CHILD_CHUNK_SIZE
  private enableContextualEmbedding = true
  private contextualWindow = DEFAULT_CONTEXTUAL_WINDOW

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
    private readonly systemConfigService: SystemConfigService,
    private readonly modelProviderService: ModelProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshConfig()
  }

  @OnEvent('config.changed')
  async handleConfigChanged(event: ConfigChangedEvent): Promise<void> {
    if (
      event.category === 'rag' ||
      event.category === 'indexing' ||
      event.category === 'providers'
    ) {
      await this.refreshConfig()
    }
  }

  private async refreshConfig(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    this.applyRagConfig(config)
    this.applyIndexingConfig(config.indexing)
  }

  private applyRagConfig(config: Settings): void {
    const providerId = config.rag.llmProvider
    if (!providerId) {
      this.logger.warn('RAG LLM 未配置：请在管理后台配置 rag.llmProvider')
      this.llm = null
      return
    }

    let provider: ModelProvider
    try {
      provider = this.modelProviderService.resolveProvider('rag.llmProvider', 'llm', config)
    } catch (err) {
      this.logger.warn(
        `RAG LLM provider 解析失败：${err instanceof Error ? err.message : String(err)}`,
      )
      this.llm = null
      return
    }

    if (!provider.apiKey) {
      this.logger.warn('RAG LLM 未配置：缺少 API Key')
      this.llm = null
      return
    }

    this.llm = new LlamaIndexProvider({
      apiKey: provider.apiKey,
      model: provider.model,
      baseURL: provider.baseUrl || undefined,
      timeout: config.rag.timeoutMs ?? provider.timeoutMs,
    } satisfies LlamaIndexProviderConfig)
    this.logger.debug(`RAG LLM refreshed: ${provider.model}`)
  }

  private applyIndexingConfig(config: Settings['indexing']): void {
    this.parentChunkSize = config.parentChunkSize
    this.childChunkSize = config.childChunkSize
    this.contextualWindow = Math.max(1, config.contextualWindow)
    this.enableContextualEmbedding = config.contextualEmbedding

    if (this.enableContextualEmbedding) {
      this.logger.log(`Contextual embedding enabled (window=${this.contextualWindow})`)
    }
  }

  private getLlm(): LlamaIndexProvider {
    if (!this.llm) {
      throw new BadRequestException({
        code: MODEL_PROVIDER_ERROR_CODES.NOT_CONFIGURED,
        message: 'RAG LLM 未配置：请在管理后台配置 rag.llmProvider',
      })
    }
    return this.llm
  }

  /**
   * 检索主流程（RAG 第一步：只找相关文档，不生成答案）
   *
   * 调用顺序：
   *   1) 输入校验：截断超长查询、空 kbIds 直接返回
   *   2) 应用层 ACL：verifyKbOwnership（Prisma 校验 kb 归属）
   *      ⚠️ 校验失败时记录警告并返回 []，不抛异常（调用方无感）
   *   3) 查询理解：语言检测 → 短查询改写 → 同义词扩展
   *   4) 意图路由：根据 query 选择检索模式（bm25/vector/hybrid）、权重、topK
   *      ⚠️ 显式 options.mode 会覆盖路由决策
   *   5) 组装 ES 过滤条件：kbIds / documentIds / metadata / ACL 用户+团队
   *   6) 并行检索：
   *        - vector 模式：仅 Dense Vector kNN
   *        - bm25 模式：仅 ES match 查询（ik_smart 分词）
   *        - hybrid 模式：两路并行 + RRF 融合
   *   7) 二阶段重排：BGE Cross-Encoder（可选）
   *   8) Parent-Child 聚合：命中 Child → 拉取 Parent 内容去重
   *   9) minScore 过滤 + topK 截断
   */
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
        this.logger.warn(`Permission denied: user ${options.userId} does not own requested kbIds`)
        throw new ForbiddenException('无权访问指定的知识库')
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

  /**
   * 应用层 ACL：校验 userId 是否真正拥有所有请求的 kbIds
   *
   *
   *   这是 RAG 的第一道安全门。请求里带的 kbIds 不一定属于当前用户，
   *   必须用 Prisma 去查数据库确认：ownedCount 必须 == kbIds.length，
   *   才算"全部属于自己"。用 count 而非 findMany 是为了省内存。
   *
   * ⚠️ 注意：这只是"应用层校验"，真正的防线是 ES 索引层的 knn.filter，
   *   后者会在向量检索之前就把未授权文档过滤掉。
   */
  private async verifyKbOwnership(userId: string, kbIds?: string[]): Promise<boolean> {
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

  /**
   * RRF 融合（Reciprocal Rank Fusion）—— 混合检索的核心算法
   *
   * 为什么需要 RRF？
   *   BM25 分数（0~20）和向量余弦分数（0~1）尺度完全不同，不能直接相加。
   *   RRF 只看「排名位置」，不关心分数尺度，天然支持跨算法融合。
   *
   * 公式：score(d) = vectorWeight/(rrfK+rank_vector) + bm25Weight/(rrfK+rank_bm25)
   *   - rrfK 默认 60（文献经验值，平衡头部与长尾）
   *   - 排名从 1 开始，代码里用 idx+1 体现
   *   - vectorWeight / bm25Weight 可按意图调整（如 code_search 偏重 BM25）
   *
   * 新人记忆：
   *   「排名靠前 → 分数大」「被两路检索都命中 → 分数叠加」
   */
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
        const hit = hitMap.get(id)
        if (!hit) return null
        return { ...hit, score }
      })
      .filter((h): h is SearchHit => h !== null)
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Context Builder —— 把检索结果打包成 LLM 的「上下文」
   *
   * 流程：
   *   1) 按 documentId 去重（避免同文档多 chunk 浪费 token）
   *   2) 按分数降序排列
   *   3) 估算 token（中文粗略按 length/4）累加至 tokenBudget（默认 3000）
   *   4) 最后一个 chunk 按比例截断，追加 "..."
   *   5) 输出带编号引用格式：`[1] 内容\n\n[2] 内容`
   *
   *
   *   LLM 有上下文窗口限制，不能把所有检索结果塞进去。本方法用
   *   「贪心 + 按文档去重 + 比例截断」保证有限 token 里装最多样的信息。
   */
  async buildContext(
    chunks: RetrievedChunk[],
    tokenBudget: number = DEFAULT_CONTEXT_TOKEN_BUDGET,
  ): Promise<string> {
    if (chunks.length === 0) return ''

    const deduped = this.deduplicateByDocument(chunks)

    const ordered = [...deduped].sort((a, b) => b.score - a.score)

    const selected: RetrievedChunk[] = []
    let usedTokens = 0

    for (const chunk of ordered) {
      // C2: 中文 token 比例通常 1:2~1:3，使用更保守的 length/2 估算
      const estimatedTokens = Math.max(1, Math.ceil(chunk.content.length / 2))
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

  /**
   * 完整 RAG 查询：检索 → 生成 → 输出安全 → 事实校验
   *
   * 流程：
   *   retrieve → buildContext → LLM invoke → Guardrail 脱敏 → Grounding 校验
   *
   * ⚠️ 注意：Guardrail 在生成之后应用，如果 LLM 输出了 PII，会被脱敏；
   *   Grounding 把答案拆成句子，逐句判断是否被检索内容支撑。
   */
  async query(question: string, options: RagQueryOptions = {}): Promise<RagQueryResult> {
    const chunks = await this.retrieve(question, options)
    const rawAnswer = await this.generateAnswer(question, chunks, options.systemPrompt)
    const guardrailOutcome = this.guardrailService.apply(rawAnswer)
    const answer = guardrailOutcome.filteredText

    if (guardrailOutcome.warnings.length > 0) {
      this.logger.warn(`[Guardrail] warnings during query: ${guardrailOutcome.warnings.join('; ')}`)
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
  ): AsyncIterable<{
    text: string
    sourceChunks?: RetrievedChunk[]
    grounding?: GroundingResult[]
  }> {
    const chunks = await this.retrieve(question, options)

    yield { text: '', sourceChunks: chunks }

    const context = await this.buildContext(chunks)
    const system =
      options.systemPrompt ?? '你是一个基于知识库的问答助手。请根据给定的上下文回答问题。'
    const userPrompt = context
      ? `上下文：\n\n${context}\n\n问题：${question}\n\n请仅根据上下文内容回答。如果上下文没有相关信息，请直接说"没有相关信息"。`
      : `问题：${question}\n\n知识库中没有检索到相关内容，请直接说"没有相关信息"。`

    const llmStream = this.getLlm().stream([
      { role: 'system', content: system },
      { role: 'user', content: userPrompt },
    ])

    let buffer = ''
    let lastDataTs = Date.now()
    let lastHeartbeatTs = 0

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
          // ponytail: 双时间戳判定，防止连续心跳
          if (
            Date.now() - lastDataTs >= SSE_HEARTBEAT_MS &&
            Date.now() - lastHeartbeatTs >= SSE_HEARTBEAT_MS
          ) {
            lastHeartbeatTs = Date.now()
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
        // C1: 限制 buffer 累积长度，防止超长回复内存溢出
        const MAX_BUFFER_LENGTH = 100_000
        if (buffer.length < MAX_BUFFER_LENGTH) {
          buffer += chunk.text
        }
        // 流式实时 PII 过滤：在 yield 前对当前 chunk 做轻量脱敏
        const filteredText = this.guardrailService.applyStream(chunk.text)
        yield { text: filteredText }
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
      return await this.getLlm().invoke([
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ])
    } catch (err) {
      this.logger.error(`RAG query failed: ${err instanceof Error ? err.message : String(err)}`)
      throw err
    }
  }

  /**
   * 索引一篇文档到 ES（包含 Upsert、分块、Embedding、批量写入）
   *
   * 流程：
   *   1) 归属校验：只有 kb 所有者才能往里面写内容（防止"注入他人知识库"）
   *   2) Upsert：先按 documentId 删除旧数据，保证幂等
   *   3) Parent-Child 分块（默认开启）：
   *        - Parent：800 tokens 大粒度
   *        - Child：150 tokens 小粒度（真正被检索的是 Child）
   *        - 每个 Child 携带 parent_id / parent_content，命中后聚合返回
   *   4) Contextual Embedding：拼接文档标题、章节路径、前后文
   *   5) embedBatch 批量向量化
   *   6) bulkIndex 批量写入 ES
   */
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
        this.logger.warn(`Permission denied: user ${userId} cannot index into kbId=${kbId}`)
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
      // C3: 使用 randomUUID() 生成唯一 chunk ID，避免重建索引时 ID 冲突
      const docs: ChunkDocument[] = chunks.map((text, i) => ({
        id: randomUUID(),
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
      id: randomUUID(),
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
   * Contextual Embedding：构造真正被 Embedding 的文本
   *
   * 格式：文档：{title} | 章节：{path} | 正文：{prefix} {current} {suffix}
   *
   * 为什么要这样做？
   *   如果只嵌入当前 Child，那么不同文档里的"简介""设计"等同名章节
   *   向量会非常接近。加入文档标题 + 前后文后，向量就能携带
   *   「文档级上下文」，区分度显著提高。
   *
   * window 由 RAG_CONTEXTUAL_WINDOW 配置，默认 1（前后各 1 个兄弟分块）。
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
      if (`${buffer}\n\n${para}`.length <= chunkSize) {
        buffer = buffer ? `${buffer}\n\n${para}` : para
        continue
      }

      if (buffer) {
        result.push(buffer.trim())
        const startIdx = Math.max(0, buffer.length - overlap)
        buffer = buffer.slice(startIdx)
      }

      if (para.length > chunkSize) {
        // H3: 长段落按 chunkSize 切分，优先在句子边界切断
        let pos = 0
        while (pos < para.length) {
          const end = Math.min(pos + chunkSize, para.length)
          let cut = end
          // 如果不是最后一段，尝试在句子边界切断
          if (end < para.length) {
            const searchRange = para.slice(Math.max(pos, end - 100), end)
            const lastSentenceEnd = Math.max(
              searchRange.lastIndexOf('。'),
              searchRange.lastIndexOf('．'),
              searchRange.lastIndexOf('.'),
              searchRange.lastIndexOf('！'),
              searchRange.lastIndexOf('?'),
              searchRange.lastIndexOf('？'),
              searchRange.lastIndexOf('\n'),
            )
            if (lastSentenceEnd > 0) {
              cut = Math.max(pos, end - 100) + lastSentenceEnd + 1
            }
          }
          const piece = para.slice(pos, cut)
          if (piece.trim()) result.push(piece.trim())
          const nextPos = cut - overlap
          // 防止无限循环：确保至少前进 1 个字符
          pos = nextPos > pos ? nextPos : cut
          if (pos >= para.length) break
        }
        buffer = ''
      } else {
        buffer = para
      }
    }

    if (buffer.trim()) result.push(buffer.trim())
    return result
  }
}
