import { Client } from '@elastic/elasticsearch'
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { LlamaIndexEmbeddingService } from './llamaindex-embedding.service.js'

export interface ChunkDocument {
  id: string
  document_id: string
  kb_id: string
  content: string
  chunk_index: number
  token_count: number
  embedding: number[]
  parent_id?: string
  parent_content?: string
  metadata?: Record<string, unknown>
  allowed_user_ids?: string[]
  allowed_team_ids?: string[]
  document_title?: string
  section_path?: string
  created_at?: string
  updated_at?: string
}

export interface SearchHit {
  id: string
  score: number
  source: ChunkDocument
}

const DEFAULT_INDEX = 'knowledge_chunks'

type ElasticClient = Client & {
  deleteByQuery: (params: Record<string, unknown>) => Promise<{ acknowledged?: boolean }>
}

@Injectable()
export class ElasticsearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ElasticsearchService.name)
  private readonly client: ElasticClient
  readonly indexName: string
  readonly embeddingDimensions: number

  constructor(
    private readonly config: ConfigService,
    private readonly embeddings: LlamaIndexEmbeddingService,
  ) {
    const node = config.get<string>('ELASTICSEARCH_NODE', 'http://localhost:9200')
    const apiKey = config.get<string>('ELASTICSEARCH_API_KEY')
    const username = config.get<string>('ELASTICSEARCH_USERNAME')
    const password = config.get<string>('ELASTICSEARCH_PASSWORD')

    this.indexName = config.get<string>('ELASTICSEARCH_INDEX', DEFAULT_INDEX)
    this.embeddingDimensions = embeddings.getDimensions() ?? 1536

    const auth = apiKey ? { apiKey } : username && password ? { username, password } : undefined

    this.client = new Client({ node, auth }) as ElasticClient
  }

  getClient(): ElasticClient {
    return this.client
  }

  async onModuleInit(): Promise<void> {
    try {
      const info = await this.client.info()
      this.logger.log(`Elasticsearch connected: ${info.version.number}`)
      await this.ensureIndex()
    } catch (err) {
      this.logger.warn(
        `Elasticsearch connection failed: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.close()
    } catch {
      this.logger.warn('Failed to close Elasticsearch client')
    }
  }

  getIndexName(): string {
    return this.indexName
  }

  async ensureIndex(): Promise<void> {
    const exists = await this.client.indices.exists({ index: this.indexName })
    if (exists) {
      this.logger.log(`Index ${this.indexName} already exists`)
      return
    }

    await this.client.indices.create({
      index: this.indexName,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0,
          'analysis.analyzer.default.type': 'ik_max_word',
          'analysis.search_analyzer.default.type': 'ik_smart',
        },
        mappings: {
          dynamic: false,
          properties: {
            id: { type: 'keyword' },
            document_id: { type: 'keyword' },
            kb_id: { type: 'keyword' },
            content: {
              type: 'text',
              analyzer: 'ik_max_word',
              search_analyzer: 'ik_smart',
              term_vector: 'with_positions_offsets',
              store: true,
            },
            parent_id: { type: 'keyword' },
            parent_content: {
              type: 'text',
              analyzer: 'ik_max_word',
              search_analyzer: 'ik_smart',
              store: true,
            },
            chunk_index: { type: 'integer' },
            token_count: { type: 'integer' },
            embedding: {
              type: 'dense_vector',
              dims: this.embeddingDimensions,
              index: true,
              similarity: 'cosine',
            },
            metadata: { type: 'object', dynamic: true, enabled: false },
            allowed_user_ids: { type: 'keyword' },
            allowed_team_ids: { type: 'keyword' },
            document_title: {
              type: 'text',
              analyzer: 'ik_max_word',
              store: true,
            },
            section_path: { type: 'keyword' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' },
          },
        },
      },
    } as any)
    this.logger.log(`Index ${this.indexName} created (dims=${this.embeddingDimensions})`)
  }

  async indexDocument(doc: ChunkDocument): Promise<void> {
    const now = new Date().toISOString()
    await this.client.index({
      index: this.indexName,
      id: doc.id,
      document: {
        ...doc,
        created_at: doc.created_at ?? now,
        updated_at: doc.updated_at ?? now,
      },
      refresh: false,
    } as any)
  }

  async bulkIndex(docs: ChunkDocument[], refresh: boolean | 'wait_for' = false): Promise<void> {
    if (docs.length === 0) return
    const now = new Date().toISOString()
    const operations = docs.flatMap((doc) => [
      { index: { _index: this.indexName, _id: doc.id } },
      {
        ...doc,
        created_at: doc.created_at ?? now,
        updated_at: doc.updated_at ?? now,
      },
    ])
    // C4: 默认 refresh=false 保持性能，但支持显式配置
    await this.client.bulk({ body: operations, refresh } as any)
  }

  async deleteById(id: string): Promise<void> {
    await this.client.delete({ index: this.indexName, id } as any)
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    await this.client.deleteByQuery({
      index: this.indexName,
      body: { query: { term: { document_id: documentId } } },
      refresh: false,
    })
  }

  async deleteByKbId(kbId: string): Promise<void> {
    await this.client.deleteByQuery({
      index: this.indexName,
      body: { query: { term: { kb_id: kbId } } },
      refresh: false,
    })
  }

  async countByDocumentId(documentId: string): Promise<number> {
    try {
      const response = await this.client.count({
        index: this.indexName,
        body: { query: { term: { document_id: documentId } } },
      } as any)
      return response.count ?? 0
    } catch (err) {
      this.logger.error(
        `countByDocumentId failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 0
    }
  }

  async countByKbId(kbId: string): Promise<number> {
    try {
      const response = await this.client.count({
        index: this.indexName,
        body: { query: { term: { kb_id: kbId } } },
      } as any)
      return response.count ?? 0
    } catch (err) {
      this.logger.error(`countByKbId failed: ${err instanceof Error ? err.message : String(err)}`)
      return 0
    }
  }

  /**
   * Resolve the kb_id(s) that a document currently belongs to. Returns an
   * empty array when the document does not exist or the query fails. Used by
   * the delete / index authorization guards to confirm the caller actually
   * owns the underlying kb before mutating data.
   */
  async getKbIdsByDocumentId(documentId: string): Promise<string[]> {
    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: 1,
          _source: ['kb_id'],
          query: { bool: { must: [{ term: { document_id: documentId } }] } },
        },
      } as any)
      const hits = (response.hits?.hits ?? []) as any[]
      const kbIds: string[] = []
      for (const hit of hits) {
        const kbId = hit?._source?.kb_id
        if (typeof kbId === 'string' && !kbIds.includes(kbId)) kbIds.push(kbId)
      }
      return kbIds
    } catch (err) {
      this.logger.warn(
        `getKbIdsByDocumentId failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return []
    }
  }

  async checkIkPlugin(): Promise<'installed' | 'missing'> {
    try {
      const response: any = await this.client.indices.getMapping({
        index: this.indexName,
      } as any)
      const indexSettings: any = response?.[this.indexName]?.settings ?? {}
      const analyzer: any = indexSettings?.analysis?.analyzer?.default ?? {}
      const type: string = analyzer?.type ?? ''
      return String(type).startsWith('ik_') ? 'installed' : 'missing'
    } catch (err) {
      this.logger.warn(
        `IK plugin check failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      return 'missing'
    }
  }

  async getParentsByIds(parentIds: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>()
    if (!parentIds || parentIds.length === 0) return result

    try {
      const response = await this.client.search({
        index: this.indexName,
        body: {
          size: parentIds.length,
          _source: ['parent_id', 'parent_content'],
          query: {
            bool: {
              must: [{ terms: { parent_id: parentIds } }, { exists: { field: 'parent_content' } }],
            },
          },
          collapse: { field: 'parent_id' },
        },
      } as any)

      const hits = (response.hits?.hits ?? []) as any[]
      for (const hit of hits) {
        const source = hit._source ?? {}
        if (source.parent_id && source.parent_content) {
          result.set(source.parent_id as string, source.parent_content as string)
        }
      }

      for (const id of parentIds) {
        if (!result.has(id)) {
          result.set(id, '')
        }
      }
    } catch (err) {
      this.logger.error(
        `getParentsByIds failed: ${err instanceof Error ? err.message : String(err)}`,
      )
      for (const id of parentIds) {
        if (!result.has(id)) result.set(id, '')
      }
    }

    return result
  }
}
