import { Injectable, Logger } from '@nestjs/common'
import type { ElasticsearchService, SearchHit } from './elasticsearch.service.js'

export interface Bm25Options {
  topK?: number
  minScore?: number
  filters?: {
    kbIds?: string[]
    documentIds?: string[]
    metadata?: Record<string, unknown>
  }
}

@Injectable()
export class EsKeywordService {
  private readonly logger = new Logger(EsKeywordService.name)

  constructor(private readonly es: ElasticsearchService) {}

  async search(query: string, options: Bm25Options = {}): Promise<SearchHit[]> {
    if (!query || query.trim() === '') return []

    const topK = options.topK ?? 20
    const must: unknown[] = [
      {
        match: {
          content: {
            query,
            analyzer: 'ik_smart',
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
