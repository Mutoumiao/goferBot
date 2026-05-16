import {
  MilvusClient,
  DataType,
  type CreateCollectionReq,
  type FieldType,
  type FieldSchema,
} from '@zilliz/milvus2-sdk-node'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '../interfaces/IVectorStore.js'
import { VectorStoreError } from '../interfaces/errors.js'

export interface MilvusVectorStoreOptions {
  /** Milvus 服务地址，默认 localhost */
  host?: string
  /** Milvus gRPC 端口，默认 19530 */
  port?: string | number
  /** Collection 名称，默认 'knowledge_chunks' */
  collectionName?: string
  /** 向量维度，默认 1536 */
  vectorDim?: number
  /** 相似度度量，默认 'COSINE' */
  metricType?: 'COSINE' | 'IP' | 'L2'
}

export class MilvusVectorStore implements IVectorStore {
  private readonly client: MilvusClient
  private readonly collectionName: string
  private readonly vectorDim: number
  private readonly metricType: 'COSINE' | 'IP' | 'L2'
  private readonly host: string
  private readonly port: number

  constructor(options: MilvusVectorStoreOptions = {}) {
    this.host = options.host ?? process.env.MILVUS_HOST ?? 'localhost'
    this.port = options.port
      ? typeof options.port === 'number'
        ? options.port
        : parseInt(options.port, 10)
      : parseInt(process.env.MILVUS_PORT ?? '19530', 10)
    this.collectionName = options.collectionName ?? process.env.MILVUS_COLLECTION ?? 'knowledge_chunks'
    this.vectorDim = options.vectorDim
      ? typeof options.vectorDim === 'number'
        ? options.vectorDim
        : parseInt(String(options.vectorDim), 10)
      : parseInt(process.env.MILVUS_VECTOR_DIM ?? '1536', 10)
    this.metricType = options.metricType ?? 'COSINE'

    const address = `${this.host}:${this.port}`
    this.client = new MilvusClient({ address })
  }

  async checkHealth(): Promise<void> {
    try {
      const res = await this.client.checkHealth()
      if (!res.isHealthy) {
        throw new VectorStoreError(`Milvus 连接失败: 服务未健康 (${this.host}:${this.port})`)
      }
      console.log(`[Milvus] Connected to ${this.host}:${this.port}`)
    } catch (err) {
      if (err instanceof VectorStoreError) throw err
      throw new VectorStoreError(
        `Milvus 连接失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }

  async ensureCollection(): Promise<void> {
    try {
      const hasRes = await this.client.hasCollection({
        collection_name: this.collectionName,
      })

      if (!hasRes.value) {
        await this.createCollection()
        console.log(`[Milvus] Collection '${this.collectionName}' created (dim=${this.vectorDim})`)
        return
      }

      const descRes = await this.client.describeCollection({
        collection_name: this.collectionName,
      })

      const embeddingField = descRes.schema?.fields?.find(
        (f: FieldSchema) => f.name === 'embedding',
      )
      const actualDimRaw = embeddingField?.type_params?.find((p) => p.key === 'dim')?.value
      const actualDim = actualDimRaw ? parseInt(String(actualDimRaw), 10) : undefined

      if (actualDim && actualDim !== this.vectorDim) {
        throw new VectorStoreError(
          `Collection 维度不匹配: 期望 ${this.vectorDim}, 实际 ${actualDim}`,
        )
      }

      await this.client.loadCollection({ collection_name: this.collectionName })
      console.log(`[Milvus] Collection '${this.collectionName}' already exists, verified`)
    } catch (err) {
      if (err instanceof VectorStoreError) throw err
      throw new VectorStoreError(
        `ensureCollection 失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }

  private async createCollection(): Promise<void> {
    const fields: FieldType[] = [
      {
        name: 'id',
        data_type: DataType.VarChar,
        is_primary_key: true,
        max_length: 64,
      },
      {
        name: 'chunk_id',
        data_type: DataType.VarChar,
        max_length: 64,
      },
      {
        name: 'kb_id',
        data_type: DataType.VarChar,
        max_length: 64,
      },
      {
        name: 'file_id',
        data_type: DataType.VarChar,
        max_length: 64,
      },
      {
        name: 'embedding',
        data_type: DataType.FloatVector,
        dim: this.vectorDim,
      },
    ]

    const createReq: CreateCollectionReq = {
      collection_name: this.collectionName,
      fields,
    }

    await this.client.createCollection(createReq)

    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: 'embedding',
      index_type: 'AUTOINDEX',
      metric_type: this.metricType,
    })

    await this.client.createIndex({
      collection_name: this.collectionName,
      field_name: 'kb_id',
      index_type: 'Trie',
    })

    await this.client.loadCollection({ collection_name: this.collectionName })
  }

  async insertVectors(vectors: VectorRecord[]): Promise<void> {
    if (!vectors.length) {
      throw new VectorStoreError('插入失败: 向量数组不能为空')
    }

    for (const v of vectors) {
      if (v.embedding.length !== this.vectorDim) {
        throw new VectorStoreError(
          `维度不匹配: 期望 ${this.vectorDim}, 实际 ${v.embedding.length}`,
        )
      }
    }

    const batchSize = 1000
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize)

      const fields_data = [
        {
          field_name: 'id',
          type: DataType.VarChar,
          data: batch.map((v) => v.id),
        },
        {
          field_name: 'chunk_id',
          type: DataType.VarChar,
          data: batch.map((v) => v.chunkId),
        },
        {
          field_name: 'kb_id',
          type: DataType.VarChar,
          data: batch.map((v) => v.kbId),
        },
        {
          field_name: 'file_id',
          type: DataType.VarChar,
          data: batch.map((v) => v.fileId),
        },
        {
          field_name: 'embedding',
          type: DataType.FloatVector,
          data: batch.map((v) => v.embedding),
        },
      ]

      try {
        await this.client.insert({
          collection_name: this.collectionName,
          fields_data,
        })
      } catch (err) {
        throw new VectorStoreError(
          `向量插入失败: ${err instanceof Error ? err.message : String(err)}`,
          err,
        )
      }
    }

    console.log(`[Milvus] Inserted ${vectors.length} vectors into '${this.collectionName}'`)
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    if (queryVector.length !== this.vectorDim) {
      throw new VectorStoreError(
        `维度不匹配: 期望 ${this.vectorDim}, 实际 ${queryVector.length}`,
      )
    }

    const topK = options?.topK ?? 5
    const filter = options?.filter?.kbId
      ? `kb_id == "${options.filter.kbId}"`
      : undefined

    try {
      const res = await this.client.search({
        collection_name: this.collectionName,
        vector: queryVector,
        filter,
        limit: topK,
        output_fields: ['chunk_id'],
      })

      const results: VectorSearchResult[] = []
      if (res.results) {
        for (const r of res.results) {
          results.push({
            id: String(r.id),
            chunkId: String((r as Record<string, unknown>).chunk_id ?? ''),
            score: typeof r.score === 'number' ? r.score : 0,
          })
        }
      }

      console.log(
        `[Milvus] Searched '${this.collectionName}', topK=${topK}, filter=${filter ?? 'none'}, results=${results.length}`,
      )

      return results.sort((a, b) => b.score - a.score)
    } catch (err) {
      throw new VectorStoreError(
        `向量搜索失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (!ids.length) {
      throw new VectorStoreError('删除失败: ID 数组不能为空')
    }

    const filter = `id in [${ids.map((id) => `"${id}"`).join(', ')}]`

    try {
      await this.client.delete({
        collection_name: this.collectionName,
        filter,
      })
      console.log(`[Milvus] Deleted vectors from '${this.collectionName}', filter=${filter}`)
    } catch (err) {
      throw new VectorStoreError(
        `向量删除失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }

  async deleteByFileId(fileId: string): Promise<void> {
    const filter = `file_id == "${fileId}"`

    try {
      await this.client.delete({
        collection_name: this.collectionName,
        filter,
      })
      console.log(`[Milvus] Deleted vectors by file_id from '${this.collectionName}', fileId=${fileId}`)
    } catch (err) {
      throw new VectorStoreError(
        `按 file_id 删除向量失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }

  async deleteByKbId(kbId: string): Promise<void> {
    const filter = `kb_id == "${kbId}"`

    try {
      await this.client.delete({
        collection_name: this.collectionName,
        filter,
      })
      console.log(`[Milvus] Deleted vectors by kb_id from '${this.collectionName}', kbId=${kbId}`)
    } catch (err) {
      throw new VectorStoreError(
        `按 kb_id 删除向量失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }
}
