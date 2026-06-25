import { Injectable, Logger } from '@nestjs/common'
import { ElasticsearchService } from './elasticsearch.service.js'
import type { SearchHit } from './elasticsearch.service.js'

export interface VectorOptions {
  topK?: number
  numCandidates?: number
  filters?: {
    kbIds?: string[]
    documentIds?: string[]
    metadata?: Record<string, unknown>
    allowedUserIds?: string[]
    allowedTeamIds?: string[]
  }
}

/**
 * EsVectorService —— RAG 的「向量检索器」
 *
 *   把用户 query 做 Embedding，在 ES 里用 `knn` 搜索 ANN 索引（HNSW），
 *   返回语义最相似的 chunks。BM25 擅长"字面匹配"，本服务擅长"意思相近"。
 *
 * 关键参数：
 *   - k：从 ANN 索引进多少近邻（默认 topK）
 *   - num_candidates：召回后再精排的候选池大小（默认 100，越大越准但越慢）
 *   - similarity：最小相似度阈值（0~1）
 *
 * ACL 物理隔离（重要安全点）：
 *   `knn.filter` 在 ANN 遍历**之前**执行，而不是打分之后。这意味着
 *   未授权文档根本不会进入候选集，比"事后过滤"更安全。
 */
@Injectable()
export class EsVectorService {
  private readonly logger = new Logger(EsVectorService.name)

  constructor(private readonly es: ElasticsearchService) {}

  async search(queryVector: number[], options: VectorOptions = {}): Promise<SearchHit[]> {
    if (!queryVector || queryVector.length === 0) return []

    const topK = options.topK ?? 20
    const numCandidates = options.numCandidates ?? topK * 5

    const knn: Record<string, unknown> = {
      field: 'embedding',
      query_vector: queryVector,
      k: topK,
      num_candidates: numCandidates,
      boost: 1.0,
    }

    const filterClauses: unknown[] = []
    if (options.filters?.kbIds && options.filters.kbIds.length > 0) {
      filterClauses.push({ terms: { kb_id: options.filters.kbIds } })
    }
    if (options.filters?.documentIds && options.filters.documentIds.length > 0) {
      filterClauses.push({ terms: { document_id: options.filters.documentIds } })
    }

    if (options.filters?.metadata) {
      for (const [key, value] of Object.entries(options.filters.metadata)) {
        if (value === undefined || value === null) continue
        const field = `metadata.${key}`
        if (Array.isArray(value)) {
          filterClauses.push({ terms: { [field]: value } })
        } else {
          filterClauses.push({ term: { [field]: value } })
        }
      }
    }

    // ACL physical filter for vector search. Note: ES `knn.filter` is executed
    // BEFORE the ANN traversal, which is the recommended mode for strong
    // multi-tenant isolation (supplemental doc Trap 3).
    if (options.filters?.allowedUserIds && options.filters.allowedUserIds.length > 0) {
      filterClauses.push({
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
      filterClauses.push({
        bool: {
          should: [
            { terms: { allowed_team_ids: options.filters.allowedTeamIds } },
            { bool: { must_not: { exists: { field: 'allowed_team_ids' } } } },
          ],
          minimum_should_match: 1,
        },
      })
    }

    if (filterClauses.length > 0) {
      knn.filter = filterClauses
    }

    const body = {
      size: topK,
      _source: [
        'id',
        'document_id',
        'kb_id',
        'content',
        'chunk_index',
        'token_count',
        'parent_id',
        'parent_content',
      ],
      query: {
        knn,
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
      return hits.map((h) => ({ ...h, score: h.score / maxScore }))
    } catch (err) {
      this.logger.error(`Vector search failed: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }
  }
}
