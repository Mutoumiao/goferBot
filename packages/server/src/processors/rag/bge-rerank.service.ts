import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { OnEvent } from '@nestjs/event-emitter'
import { ConfigChangedEvent } from '../../modules/settings/constants.js'
import type { ResolvedProvider, Settings } from '../../modules/settings/dto/settings.dto.js'
import { ModelProviderService } from '../../modules/settings/model-provider.service.js'
import { SystemConfigService } from '../../modules/settings/system-config.service.js'

export interface RerankCandidate {
  id: string
  content: string
  metadata?: Record<string, unknown>
  originalScore?: number
}

export interface RerankResult {
  id: string
  score: number
  content: string
  metadata?: Record<string, unknown>
  originalScore?: number
}

/**
 * BgeRerankService —— RAG 的「二阶段重排器」
 *
 *   第一阶段（BM25 + 向量）只做粗排，可能有 30~100 个候选。本服务用
 *   **Cross-Encoder**（query+doc 拼接联合编码）对候选做精排，精度更高但更慢。
 *
 * 工作模式：
 *   1) 首次调用 `ensureInitialized()` 懒加载 BGE 模型（启动快）
 *   2) `modelRerank` 按 batchSize=16 批量推理
 *   3) 模型加载失败 → `fallbackRerank`（词法匹配 + 原始分数融合）
 *
 * 安全设计：
 *   Reranker 模型通过 rag.rerankerAllowedModelPrefixes 白名单校验，
 *   防止通过配置注入任意 HF 仓库。
 */
@Injectable()
export class BgeRerankService implements OnModuleInit {
  private readonly logger = new Logger(BgeRerankService.name)
  private modelId: string | null = null
  private maxLength = 512
  private allowedPrefixes: string[] = ['BAAI/', 'Xorbits/', 'sentence-transformers/']

  constructor(
    private readonly config: ConfigService,
    private readonly systemConfigService: SystemConfigService,
    private readonly modelProviderService: ModelProviderService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refreshConfig()

    // H4: 启动时预加载模型，避免首次请求延迟
    const eagerLoad = this.config.get<string>('RERANK_EAGER_LOAD')
    if (eagerLoad === 'true' || eagerLoad === '1') {
      this.logger.log('Eager loading reranker model on startup...')
      await this.ensureInitialized()
    }
  }

  @OnEvent('config.changed')
  async handleConfigChanged(event: ConfigChangedEvent): Promise<void> {
    if (event.category === 'rag' || event.category === 'providers') {
      await this.refreshConfig()
    }
  }

  async reload(): Promise<void> {
    await this.refreshConfig()
  }

  private async refreshConfig(): Promise<void> {
    const config = await this.systemConfigService.getDecryptedSystemConfig()
    this.applyRerankerConfig(config)
  }

  private applyRerankerConfig(config: Settings): void {
    this.allowedPrefixes = config.rag.rerankerAllowedModelPrefixes

    const providerId = config.rag.rerankerProvider
    if (!providerId) {
      this.logger.warn('Reranker 未配置：请在管理后台配置 rag.rerankerProvider')
      this.modelId = null
      this.resetModel()
      return
    }

    let provider: ResolvedProvider
    try {
      provider = this.modelProviderService.resolveProvider(
        'rag.rerankerProvider',
        'reranker',
        config,
      )
    } catch (err) {
      this.logger.warn(
        `Reranker provider 解析失败：${err instanceof Error ? err.message : String(err)}`,
      )
      this.modelId = null
      this.resetModel()
      return
    }

    const raw = provider.model
    if (raw && this.isAllowedModelId(raw)) {
      this.modelId = raw
    } else {
      if (raw) {
        this.logger.warn(`Reranker 模型 "${raw}" 不在允许列表，将使用 fallback 重排`)
      }
      this.modelId = null
    }
    this.maxLength = provider.maxLength ?? 512
    this.resetModel()
  }

  private isAllowedModelId(modelId: string): boolean {
    return this.allowedPrefixes.some((p) => modelId.startsWith(p))
  }

  private resetModel(): void {
    this.initialized = false
    this.tokenizer = null
    this.model = null
  }

  private initialized = false
  private tokenizer: any = null
  private model: any = null

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    if (!this.modelId) return
    try {
      const { AutoTokenizer, AutoModelForSequenceClassification } = await import(
        '@xenova/transformers'
      )
      this.logger.log(`Loading reranker model: ${this.modelId}`)
      ;[this.tokenizer, this.model] = await Promise.all([
        AutoTokenizer.from_pretrained(this.modelId),
        AutoModelForSequenceClassification.from_pretrained(this.modelId),
      ])
      this.initialized = true
      this.logger.log('Reranker model loaded successfully')
    } catch (err) {
      this.logger.warn(
        `Failed to load reranker model: ${err instanceof Error ? err.message : String(err)}`,
      )
      this.logger.warn('Falling back to lexical + original score fusion')
      this.initialized = false
    }
  }

  async rerank(
    query: string,
    candidates: RerankCandidate[],
    options: { topK?: number } = {},
  ): Promise<RerankResult[]> {
    if (candidates.length === 0) return []

    if (!this.modelId) {
      return this.fallbackRerank(query, candidates, options)
    }

    await this.ensureInitialized()

    if (!this.initialized || !this.model || !this.tokenizer) {
      return this.fallbackRerank(query, candidates, options)
    }

    try {
      return await this.modelRerank(query, candidates, options)
    } catch (err) {
      this.logger.warn(
        `Model rerank failed: ${err instanceof Error ? err.message : String(err)}. Falling back.`,
      )
      return this.fallbackRerank(query, candidates, options)
    }
  }

  private async modelRerank(
    query: string,
    candidates: RerankCandidate[],
    options: { topK?: number } = {},
  ): Promise<RerankResult[]> {
    const topK = options.topK ?? candidates.length
    const batchSize = 16
    const scores: number[] = []

    for (let i = 0; i < candidates.length; i += batchSize) {
      const batch = candidates.slice(i, i + batchSize)
      const inputs = batch.map((c) => [query, c.content.slice(0, this.maxLength)])

      const encoded = this.tokenizer(inputs, {
        padding: true,
        truncation: true,
        max_length: this.maxLength,
      })

      const result = await this.model(encoded)
      const batchScores = Array.from(result.logits.data as Float32Array)
      scores.push(...batchScores)
    }

    const ranked = candidates
      .map((c, idx) => ({
        ...c,
        score: scores[idx],
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return ranked.map((c) => ({
      id: c.id,
      score: c.score,
      content: c.content,
      metadata: c.metadata,
      originalScore: c.originalScore,
    }))
  }

  private fallbackRerank(
    query: string,
    candidates: RerankCandidate[],
    options: { topK?: number } = {},
  ): RerankResult[] {
    const topK = options.topK ?? candidates.length
    const queryTerms = query.toLowerCase().split(/\s+/)

    const scored = candidates.map((c) => {
      const contentTerms = c.content.toLowerCase().split(/\s+/)
      const matches = queryTerms.filter((term) => contentTerms.includes(term)).length
      const lexicalScore = queryTerms.length > 0 ? matches / queryTerms.length : 0
      const combinedScore = (c.originalScore ?? 0) * 0.5 + lexicalScore * 0.5
      return { ...c, score: combinedScore }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((c) => ({
        id: c.id,
        score: c.score,
        content: c.content,
        metadata: c.metadata,
        originalScore: c.originalScore,
      }))
  }
}
