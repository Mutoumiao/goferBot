import type { Chunk, TokenUsage } from '../types.js'
import type { IVectorStore, VectorRecord } from '../vector-store.js'
import { ValidationError, IndexingError } from '../errors.js'

/**
 * 通用向量索引器实现。
 *
 * 将 Chunk + 向量映射为 VectorRecord，通过 IVectorStore 接口写入。
 * 不绑定具体向量数据库（Milvus/pgvector 等），由注入的 IVectorStore 实现决定存储后端。
 */
export class VectorIndexer {
  constructor(private vectorStore: IVectorStore) {}

  async index(chunks: Chunk[], vectors: number[][], _usage?: TokenUsage[]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(`chunks length ${chunks.length} != vectors length ${vectors.length}`)
    }
    if (chunks.length === 0) return

    const records: VectorRecord[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      chunkId: chunk.id,
      kbId: chunk.kbId,
      fileId: chunk.documentId,
      embedding: vectors[i],
    }))

    try {
      await this.vectorStore.insertVectors(records)
    } catch (cause) {
      throw new IndexingError('Failed to insert vectors into vector store', cause)
    }
  }
}

