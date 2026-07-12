import { ChatOpenAI } from '@langchain/openai'
import type { FetchedModel, ProviderType } from '@goferbot/data'

export type { FetchedModel }

export interface ProviderConfig {
  /** Provider 级 */
  id: string
  name: string
  notes?: string
  enabled: boolean
  apiKey: string
  baseUrl: string
  isCompleteUrl: boolean
  timeoutMs: number
  /** Model 级 */
  model: string
  type: ProviderType
  dimensions?: number
  maxLength?: number
}

export class BaseProvider {
  readonly id: string
  readonly name: string
  readonly model: string
  readonly type: ProviderType
  protected readonly apiKey: string
  protected readonly baseUrl: string
  protected readonly isCompleteUrl: boolean
  protected readonly timeoutMs: number
  readonly dimensions?: number
  readonly maxLength?: number

  constructor(config: ProviderConfig) {
    this.id = config.id
    this.name = config.name
    this.model = config.model
    this.type = config.type
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    this.isCompleteUrl = config.isCompleteUrl
    this.timeoutMs = config.timeoutMs
    this.dimensions = config.dimensions
    this.maxLength = config.maxLength
  }

  /** 获取模型列表（子类可覆盖；基类使用 OpenAI 协议） */
  async fetchModels(): Promise<FetchedModel[]> {
    return this.defaultFetchModels()
  }

  /**
   * LangChain 聊天客户端（Companion + Chat 标题生成）。
   * RAG 索引/检索不在 Nest 侧调用，由 Knowledge AI 供应商适配器处理。
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toLangChain(overrides?: Record<string, unknown>): any {
    return new ChatOpenAI({
      apiKey: this.apiKey,
      model: this.model,
      configuration: { baseURL: this.resolveLlmBaseURL() },
      timeout: this.timeoutMs,
      ...overrides,
    })
  }

  /** 子类可覆盖：模型列表 API 路径（默认 /models） */
  protected get modelsEndpoint(): string {
    return '/models'
  }

  /** 基类默认 fetchModels 实现：GET {baseURL}/models → OpenAI 格式 */
  protected async defaultFetchModels(): Promise<FetchedModel[]> {
    const url = `${this.resolveBaseURL()}${this.modelsEndpoint}`
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(15_000),
    })
    if (!resp.ok) {
      throw new Error(`远程返回 ${resp.status}`)
    }

    // 限制响应体大小，防止恶意远程服务器返回超大 JSON 导致 OOM
    const MAX_RESPONSE_SIZE = 1_000_000 // 1MB
    const contentLength = Number.parseInt(resp.headers.get('content-length') ?? '0', 10)
    if (contentLength > MAX_RESPONSE_SIZE) {
      throw new Error('远程响应体过大（>1MB），已拒绝')
    }
    const text = await resp.text()
    if (text.length > MAX_RESPONSE_SIZE) {
      throw new Error('远程响应体过大（>1MB），已拒绝')
    }
    const json = JSON.parse(text) as { data?: Array<{ id: string }> }
    return (json.data ?? []).map((m) => ({
      name: m.id,
      type: this.inferModelType(m.id),
    }))
  }

  /** 根据模型名推断类型 */
  protected inferModelType(name: string): ProviderType {
    const lower = name.toLowerCase()
    if (lower.includes('embed')) return 'embedding'
    if (lower.includes('rerank')) return 'reranker'
    if (lower.includes('parser') || lower.includes('ocr')) return 'document-parser'
    return 'llm'
  }

  /** isCompleteUrl 时 strip 后缀，否则直接拼 /chat/completions */
  protected resolveLlmBaseURL(): string | undefined {
    if (!this.baseUrl) return undefined
    if (this.isCompleteUrl) {
      return this.baseUrl.replace(/\/(chat\/completions|embeddings|models)$/, '')
    }
    return `${this.baseUrl}/chat/completions`
  }

  /** 还原基础 URL（用于 fetchModels 构建完整路径） */
  protected resolveBaseURL(): string {
    if (this.isCompleteUrl) {
      return this.baseUrl.replace(/\/(chat\/completions|embeddings|models)$/, '')
    }
    return this.baseUrl
  }
}
