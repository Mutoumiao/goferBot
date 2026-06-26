import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { LlamaIndexProvider } from '../../modules/chat/llm/llama-index-provider.service.js'
import type { LlmMessage } from '../../modules/chat/llm/llm-provider.interface.js'
import { ConfigChangedEvent } from '../../modules/settings/constants.js'
import type { ModelProvider, Settings } from '../../modules/settings/dto/settings.dto.js'
import { ModelProviderService } from '../../modules/settings/model-provider.service.js'
import { SystemConfigService } from '../../modules/settings/system-config.service.js'

export type Language = 'zh' | 'en'

export interface QueryUnderstandingResult {
  rewrittenQuery: string
  language: Language
  expandedQueries: string[]
}

const SHORT_QUERY_TOKEN_THRESHOLD = 5
const CHINESE_CHAR_REGEX = /[一-鿿㐀-䶿぀-ヿ]/
const ZH_CHAR_RATIO_THRESHOLD = 0.2
const REWRITE_SYSTEM_PROMPT =
  '你是一个查询改写助手。请将用户的短查询扩展为更完整、更具体、更适合进行语义检索的问题描述。只输出改写后的查询，不要附加解释。'

/**
 * QueryUnderstandingService —— RAG 的「查询理解前处理」
 *
 *   用户的提问常常太随意——"这个函数"、"刚才说的那个"、"在 ES 里"。直接
 *   拿去检索命中率低。本服务在检索前对 query 做三件事：
 *
 *   1) 语言检测（中文 / English / unknown）→ 给 BM25 分词器提供提示
 *   2) 短查询改写（≤20 字时尝试用 LLM 扩写，失败则回退模板式补全）
 *   3) 同义词扩展（按关键词命中预设 SYNONYM_MAP，扩展成 OR 查询）
 *
 * 所有子操作都有 try/catch，任何一步失败不影响主流程，保证"永不阻塞检索"。
 */
@Injectable()
export class QueryUnderstandingService implements OnModuleInit {
  private readonly logger = new Logger(QueryUnderstandingService.name)
  private llm: LlamaIndexProvider | null = null
  private synonymDict: Settings['indexing']['synonymDict'] = { zh: {}, en: {} }

  constructor(
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
    this.synonymDict = config.indexing.synonymDict
  }

  private applyRagConfig(config: Settings): void {
    const providerId = config.rag.llmProvider
    if (!providerId) {
      this.logger.warn('RAG LLM 未配置，短查询改写功能将不可用')
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
      this.logger.warn('RAG LLM 未配置，缺少 API Key，短查询改写功能将不可用')
      this.llm = null
      return
    }

    this.llm = new LlamaIndexProvider({
      apiKey: provider.apiKey,
      model: provider.model,
      baseURL: provider.baseUrl || undefined,
      timeout: config.rag.timeoutMs ?? provider.timeoutMs,
    })
  }

  detectLanguage(text: string): Language {
    if (!text) return 'en'
    let zhCount = 0
    for (const ch of text) {
      if (CHINESE_CHAR_REGEX.test(ch)) zhCount += 1
    }
    return zhCount / text.length > ZH_CHAR_RATIO_THRESHOLD ? 'zh' : 'en'
  }

  expandSynonyms(query: string, language: Language): string[] {
    const langDict = this.synonymDict[language]
    if (!langDict) {
      this.logger.debug(`未找到 ${language} 的同义词配置`)
      return [query]
    }

    const results = new Set<string>([query])
    const lowerQuery = query.toLowerCase()

    for (const [trigger, synonyms] of Object.entries(langDict)) {
      if (lowerQuery.includes(trigger.toLowerCase())) {
        for (const syn of synonyms) {
          results.add(syn)
        }
      }
    }

    return Array.from(results)
  }

  async process(query: string): Promise<QueryUnderstandingResult> {
    const language = this.detectLanguage(query)

    let rewrittenQuery = query
    try {
      rewrittenQuery = await this.rewriteShortQuery(query, language)
    } catch (err) {
      this.logger.warn(
        `查询改写失败：${err instanceof Error ? err.message : String(err)}，保持原查询不变`,
      )
    }

    let expandedQueries: string[]
    try {
      expandedQueries = this.expandSynonyms(rewrittenQuery, language)
    } catch (err) {
      this.logger.warn(
        `同义词扩展失败：${err instanceof Error ? err.message : String(err)}，保持改写后查询不变`,
      )
      expandedQueries = [rewrittenQuery]
    }

    return {
      rewrittenQuery,
      language,
      expandedQueries,
    }
  }

  private async rewriteShortQuery(query: string, language: Language): Promise<string> {
    const estimatedTokens = this.estimateTokens(query, language)
    if (estimatedTokens > SHORT_QUERY_TOKEN_THRESHOLD) {
      this.logger.debug(
        `查询 token 估算 ${estimatedTokens} > ${SHORT_QUERY_TOKEN_THRESHOLD}，跳过改写`,
      )
      return query
    }

    if (!this.llm) {
      this.logger.warn('LLM 未配置，跳过短查询改写')
      return query
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: REWRITE_SYSTEM_PROMPT },
      { role: 'user', content: query },
    ]

    try {
      const rewritten = (await this.llm.invoke(messages)).trim()
      return rewritten || query
    } catch (err) {
      this.logger.warn(
        `短查询改写失败：${err instanceof Error ? err.message : String(err)}，保持原查询不变`,
      )
      return query
    }
  }

  private estimateTokens(text: string, language: Language): number {
    if (language === 'zh') {
      // 中文按字估算，保守按 1:1
      return text.length
    }
    // 英文按空格分词估算
    return text.split(/\s+/).filter(Boolean).length
  }
}
