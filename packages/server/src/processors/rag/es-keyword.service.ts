import { Injectable, Logger, Inject } from '@nestjs/common'
import { ElasticsearchService } from './elasticsearch.service.js'
import type { SearchHit } from './elasticsearch.service.js'

export interface Bm25Options {
  topK?: number
  minScore?: number
  filters?: {
    kbIds?: string[]
    documentIds?: string[]
    metadata?: Record<string, unknown>
    allowedUserIds?: string[]
    allowedTeamIds?: string[]
    language?: string
  }
}

/**
 * EsKeywordService —— RAG 的「BM25 关键词检索器」
 *
 *   本服务负责把用户的关键词查询转换成 ES 的 `match` 查询（ik_smart 分词），
 *   返回词法最相关的 chunks。与向量检索的区别：BM25 对"精确术语""函数名"
 *   更敏感，但不理解语义（"报错""异常"会匹配不到"error"）。
 *
 * 查询构建：
 *   - 语言 = zh → ik_smart 分词
 *   - 语言 = en → standard 分词
 *   - multipleQueries → 用 `should` 子句合成 OR 召回
 *
 * ACL 过滤（与向量检索对称）：
 *   - 行级：kb_ids / doc_ids / metadata
 *   - 用户级：allowed_user_ids ∈ 命中 OR 字段不存在（默认可见）
 *   - 团队级：allowed_team_ids ∈ 命中 OR 字段不存在
 */
@Injectable()
export class EsKeywordService {
  private readonly logger = new Logger(EsKeywordService.name)

  constructor(@Inject(ElasticsearchService) private readonly es: ElasticsearchService) { }

  async search(query: string, options: Bm25Options = {}): Promise<SearchHit[]> {
    if (!query || query.trim() === '') return []

    const topK = options.topK ?? 20
    const language = options.filters?.language ?? 'zh'
    // M3: 根据 language 动态切换分词器
    const analyzer = language === 'en' ? 'standard' : 'ik_smart'

    const must: unknown[] = [
      {
        match: {
          content: {
            query,
            analyzer,
            operator: 'or',
          },
        },
      },
    ]

    if (options.filters?.kbIds && options.filters.kbIds.length > 0) {
      must.push({ terms: { kb_id: options.filters.kbIds } })
    }

    if (options.filters?.documentIds && options.filters.documentIds.length > 0) {
      must.push({ terms: { document_id: options.filters.documentIds } })
    }

    if (options.filters?.metadata) {
      for (const [key, value] of Object.entries(options.filters.metadata)) {
        if (value === undefined || value === null) continue
        const field = `metadata.${key}`
        if (Array.isArray(value)) {
          must.push({ terms: { [field]: value } })
        } else if (typeof value === 'number' && Number.isFinite(value)) {
          must.push({ term: { [field]: value } })
        } else {
          must.push({ term: { [field]: value } })
        }
      }
    }

    // ACL physical filter: documents can declare explicit user/team allow lists.
    // When provided, only users matching the allow list (or docs without any
    // allow list = public) are visible. Implements the supplemental doc
    // "Trap 3: Multi-tenant isolation" recommendation.
    if (options.filters?.allowedUserIds && options.filters.allowedUserIds.length > 0) {
      must.push({
        bool: {
          should: [
            { terms: { allowed_user_ids: options.filters.allowedUserIds } },
            { bool: { must_not: { exists: { field: 'allowed_user_ids' } } } },
          ],
          minimum_should_match: 1,
        },
      })
    }

    if (options.filters?.allowedTeamIds && options.filters.allowedTeamIds.length > 0) {
      must.push({
        bool: {
          should: [
            { terms: { allowed_team_ids: options.filters.allowedTeamIds } },
            { bool: { must_not: { exists: { field: 'allowed_team_ids' } } } },
          ],
          minimum_should_match: 1,
        },
      })
    }

    const body = {
      size: topK,
      _source: ['id', 'document_id', 'kb_id', 'content', 'chunk_index', 'token_count', 'parent_id', 'parent_content'],
      query: {
        bool: { must } as { must: unknown[] },
      },
      track_scores: true,
    }

    try {
      const response = await this.es.getClient().search({
        index: this.es.getIndexName(),
        body,
      } as any)

      const hits = (response.hits.hits as unknown[]).map((hit: any) => ({
        id: hit._id,
        score: hit._score ?? 0,
        source: {
          ...hit._source,
          id: hit._source.id ?? hit._id,
          document_id: hit._source.document_id,
          kb_id: hit._source.kb_id,
          content: hit._source.content,
          chunk_index: hit._source.chunk_index,
          token_count: hit._source.token_count,
          embedding: [],
        },
      })) as SearchHit[]

      const maxScore = hits.reduce((m, h) => Math.max(m, h.score), 0) || 1
      const minScore = options.minScore ?? 0

      return hits
        .map((h) => ({ ...h, score: h.score / maxScore }))
        .filter((h) => h.score >= minScore)
    } catch (err) {
      this.logger.error(
        `BM25 search failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return []
    }
  }
}
