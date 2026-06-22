import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LlamaIndexProvider } from '../../modules/chat/llm/llama-index-provider.service.js'
import type { LlmMessage } from '../../modules/chat/llm/llm-provider.interface.js'

export type Language = 'zh' | 'en'

export interface QueryUnderstandingResult {
  rewrittenQuery: string
  language: Language
  expandedQueries: string[]
}

const SHORT_QUERY_TOKEN_THRESHOLD = 5
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fff]/
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
export class QueryUnderstandingService {
  private readonly logger = new Logger(QueryUnderstandingService.name)
  private readonly llm: LlamaIndexProvider | null = null

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RAG_LLM_API_KEY') ?? config.get<string>('LLM_API_KEY')
    const model = config.get<string>('RAG_LLM_MODEL') ?? config.get<string>('LLM_MODEL') ?? 'gpt-3.5-turbo'
    const baseURL = config.get<string>('RAG_LLM_BASE_URL') ?? config.get<string>('LLM_BASE_URL')
    const timeout = config.get<number>('RAG_LLM_TIMEOUT_MS') ?? config.get<number>('LLM_TIMEOUT_MS') ?? 60_000

    if (apiKey) {
      this.llm = new LlamaIndexProvider({ apiKey, model, baseURL, timeout })
    } else {
      this.logger.warn('RAG LLM 未配置，短查询改写功能将不可用')
    }
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
    const dict = this.loadSynonymDict()
    if (!dict) {
      this.logger.debug('未配置 RAG_SYNONYM_DICT，跳过同义词扩展')
      return [query]
    }

    const langDict = dict[language]
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

    const list = Array.from(results)
    this.logger.debug(`同义词扩展：[${query}] -> ${JSON.stringify(list)}`)
    return list
  }

  /**
   * 按顺序执行三件事：语言检测 → 短查询改写 → 同义词扩展
   *
   * 返回的 expandedQueries 会被上层用作 OR 多路召回（见 llamaindex-rag 的
   * buildEsShouldClauses 处理）。
   */
  async process(query: string): Promise<QueryUnderstandingResult> {
    this.logger.log(`开始处理查询理解：原始查询长度=${query.length}`)

    const language = this.detectLanguage(query)
    this.logger.debug(`语言检测结果：${language}`)

    const rewrittenQuery = await this.rewriteShortQuery(query)
    if (rewrittenQuery !== query) {
      this.logger.log(`短查询改写：${JSON.stringify(query)} -> ${JSON.stringify(rewrittenQuery)}`)
    }

    const expandedQueries = this.expandSynonyms(rewrittenQuery, language)

    this.logger.log(
      `查询理解完成：language=${language}, rewritten=${JSON.stringify(rewrittenQuery)}, expandedCount=${expandedQueries.length}`,
    )

    return { rewrittenQuery, language, expandedQueries }
  }

  private async rewriteShortQuery(query: string): Promise<string> {
    const estimatedTokens = Math.max(1, Math.ceil(query.length / 4))
    if (estimatedTokens > SHORT_QUERY_TOKEN_THRESHOLD) {
      this.logger.debug(`查询 token 估算 ${estimatedTokens} > ${SHORT_QUERY_TOKEN_THRESHOLD}，跳过改写`)
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

  private loadSynonymDict(): Record<Language, Record<string, string[]>> | null {
    const raw = this.config.get<unknown>('RAG_SYNONYM_DICT')
    if (!raw) return null

    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw)
        return this.normalizeSynonymDict(parsed)
      } catch {
        this.logger.warn('RAG_SYNONYM_DICT JSON 解析失败')
        return null
      }
    }

    if (typeof raw === 'object' && raw !== null) {
      return this.normalizeSynonymDict(raw as Record<string, unknown>)
    }

    return null
  }

  private normalizeSynonymDict(raw: Record<string, unknown>): Record<Language, Record<string, string[]>> | null {
    const result: Partial<Record<Language, Record<string, string[]>>> = {}

    for (const lang of ['zh', 'en'] as const) {
      const langEntry = raw[lang]
      if (!langEntry || typeof langEntry !== 'object') continue

      const langDict: Record<string, string[]> = {}
      for (const [trigger, value] of Object.entries(langEntry as Record<string, unknown>)) {
        if (Array.isArray(value) && value.every((v) => typeof v === 'string')) {
          langDict[trigger] = value as string[]
        }
      }
      result[lang] = langDict
    }

    if (!result.zh && !result.en) return null
    return result as Record<Language, Record<string, string[]>>
  }
}
