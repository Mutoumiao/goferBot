import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

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

const ALLOWED_RERANK_MODEL_PREFIXES = ['BAAI/', 'Xorbits/', 'sentence-transformers/']
const DEFAULT_RERANK_MODEL = 'BAAI/bge-reranker-v2-m3'

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
 *   RERANK_MODEL 通过白名单校验（BAAI/、Xorbits/、sentence-transformers/）
 *   防止通过环境变量注入任意 HF 仓库。
 */
@Injectable()
export class BgeRerankService implements OnModuleInit {
  private readonly logger = new Logger(BgeRerankService.name)
  private readonly modelId: string
  private readonly maxLength: number

  constructor(private readonly config: ConfigService) {
    const raw = config.get<string>('RERANK_MODEL')
    // Allowlist gate for model id to avoid arbitrary HF repo injection via
    // environment variables. Production must pin to one of the approved
    // prefixes or rely on the safe default.
    if (raw && this.isAllowedModelId(raw)) {
      this.modelId = raw
    } else {
      if (raw) {
        this.logger.warn(
          `RERANK_MODEL="${raw}" 不在允许列表，已回退到默认 ${DEFAULT_RERANK_MODEL}`,
        )
      }
      this.modelId = DEFAULT_RERANK_MODEL
    }
    this.maxLength = config.get<number>('RERANK_MAX_LENGTH', 512)
  }

  private isAllowedModelId(modelId: string): boolean {
    return ALLOWED_RERANK_MODEL_PREFIXES.some((p) => modelId.startsWith(p))
  }

  private initialized = false
  private tokenizer: any = null
  private model: any = null

  async onModuleInit(): Promise<void> {
    // H4: 启动时预加载模型，避免首次请求延迟
    const eagerLoad = this.config.get<string>('RERANK_EAGER_LOAD')
    if (eagerLoad === 'true' || eagerLoad === '1') {
      this.logger.log('Eager loading reranker model on startup...')
      await this.ensureInitialized()
    }
  }

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return
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

    await this.ensureInitialized()

    if (!this.initialized || !this.model || !this.tokenizer) {
      return this.fallbackRerank(query, candidates, options)
    }

    try {
      return await this.modelRerank(query, candidates, options)
    } catch (err) {
      this.logger.warn(
        `Model rerank failed, falling back: ${err instanceof Error ? err.message : String(err)}`,
      )
      return this.fallbackRerank(query, candidates, options)
    }
  }

  private async modelRerank(
    query: string,
    candidates: RerankCandidate[],
    options: { topK?: number },
  ): Promise<RerankResult[]> {
    const pairs: [string, string][] = candidates.map((c) => [query, c.content])
    const batchSize = 16
    const scores: number[] = []

    for (let i = 0; i < pairs.length; i += batchSize) {
      const batch = pairs.slice(i, i + batchSize)
      const encoded = await this.tokenizer(batch, {
        padding: true,
        truncation: true,
        max_length: this.maxLength,
        return_tensors: 'tf',
      })
      const output = await this.model(encoded)
      const logits = output.logits
      const arr = await logits.array()
      const flat = Array.isArray(arr) ? arr.flat() : [Number(arr)]
      scores.push(...flat.map((n) => Number(n)))
    }

    const maxScore = scores.reduce((m, s) => Math.max(m, s), 0) || 1
    const results: RerankResult[] = candidates.map((c, idx) => ({
      id: c.id,
      content: c.content,
      metadata: c.metadata,
      originalScore: c.originalScore,
      score: scores[idx] / maxScore,
    }))

    const topK = options.topK ?? results.length
    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  /**
   * 降级重排（BGE 模型不可用时的兜底）
   *
   *   fusedScore = 0.4 * lexicalScore + 0.6 * originalScore
   *
   *   - lexicalScore：query 词在 content 中命中的比例
   *   - originalScore：第一阶段的原始检索分数
   *
   *
   *   不用模型也能工作，只是精度下降。这保证了在资源受限（如 Docker 环境）
   *   下 RAG 仍可用，只是最终排名不如 Cross-Encoder 精细。
   */
  private fallbackRerank(
    query: string,
    candidates: RerankCandidate[],
    options: { topK?: number },
  ): Promise<RerankResult[]> {
    const queryLower = query.toLowerCase()
    const terms = queryLower
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1)

    const scored = candidates.map((c) => {
      const contentLower = c.content.toLowerCase()
      let hitCount = 0
      for (const term of terms) {
        if (contentLower.includes(term)) hitCount += 1
      }
      const lexicalScore = terms.length > 0 ? hitCount / terms.length : 0
      const originalScore = c.originalScore ?? 0
      const fusedScore = 0.4 * lexicalScore + 0.6 * originalScore
      return {
        id: c.id,
        content: c.content,
        metadata: c.metadata,
        originalScore,
        score: fusedScore,
      }
    })

    const topK = options.topK ?? scored.length
    return Promise.resolve(scored.sort((a, b) => b.score - a.score).slice(0, topK))
  }
}
