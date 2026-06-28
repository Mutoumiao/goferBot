import { Injectable, Logger } from '@nestjs/common'
import type { SearchHit } from './elasticsearch.service.js'
import { ElasticsearchService } from './elasticsearch.service.js'
import { EsFilterBuilder } from './es-filter.builder.js'

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

  constructor(
    private readonly es: ElasticsearchService,
    private readonly filterBuilder: EsFilterBuilder,
  ) {}

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

    const filterClauses = this.filterBuilder.buildFilterClauses(options.filters ?? {})

    if (filterClauses.length > 0) {
      knn.filter = { bool: { filter: filterClauses } }
    }

    this.logger.debug(`ES vector search: k=${topK}, num_candidates=${numCandidates}`)
    return this.es.searchKnn(knn, topK)
  }
}
