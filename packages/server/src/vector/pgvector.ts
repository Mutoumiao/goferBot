import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
import type { PrismaService } from '../processors/database/prisma.service.js'
import { VectorStoreError } from '../interfaces/errors.js'

export class PgVectorStore implements IVectorStore {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCollection(): Promise<void> {
    try {
      await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
    } catch (err) {
      throw new VectorStoreError(
        `pgvector 扩展创建失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }

  /**
   * @deprecated ADR 0005 后，向量插入由 PrismaVectorIndexer 处理（单事务写入元数据+向量）。
   * 本方法保留仅用于 IVectorStore 接口完整性，直接调用会丢失 content/tokenCount/chunkIndex。
   */
  async insertVectors(records: VectorRecord[]): Promise<void> {
    if (!records.length) {
      throw new VectorStoreError('插入失败: 向量数组不能为空')
    }

    for (const record of records) {
      if (record.embedding.length !== 1536) {
        throw new VectorStoreError(
          `维度不匹配: 期望 1536, 实际 ${record.embedding.length}`,
        )
      }
    }

    for (const record of records) {
      try {
        await this.prisma.$executeRaw`
          INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
          VALUES (
            ${record.id}::uuid,
            ${record.chunkId}::uuid,
            ${record.kbId}::uuid,
            ${''},
            ${0},
            ${0},
            ${record.embedding}::vector
          )
          ON CONFLICT (id) DO UPDATE SET
            embedding = EXCLUDED.embedding
        `
      } catch (err) {
        throw new VectorStoreError(
          `向量插入失败: ${err instanceof Error ? err.message : String(err)}`,
          err,
        )
      }
    }
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    if (queryVector.length !== 1536) {
      throw new VectorStoreError(
        `维度不匹配: 期望 1536, 实际 ${queryVector.length}`,
      )
    }

    const topK = options?.topK ?? 5
    const kbId = options?.filter?.kbId

    try {
      const results = kbId
        ? await this.prisma.$queryRaw<Array<{
            id: string
            score: number
          }>>`
            SELECT
              id::text,
              1 - (embedding <=> ${queryVector}::vector) as score
            FROM chunks
            WHERE kb_id = ${kbId}::uuid
              AND embedding IS NOT NULL
            ORDER BY embedding <=> ${queryVector}::vector
            LIMIT ${topK}
          `
        : await this.prisma.$queryRaw<Array<{
            id: string
            score: number
          }>>`
            SELECT
              id::text,
              1 - (embedding <=> ${queryVector}::vector) as score
            FROM chunks
            WHERE embedding IS NOT NULL
            ORDER BY embedding <=> ${queryVector}::vector
            LIMIT ${topK}
          `

      return results.map((r) => ({
        id: r.id,
        chunkId: r.id,
        score: Number(r.score),
      }))
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

    try {
      await this.prisma.$executeRaw`
        DELETE FROM chunks WHERE id = ANY(${ids}::uuid[])
      `
    } catch (err) {
      throw new VectorStoreError(
        `向量删除失败: ${err instanceof Error ? err.message : String(err)}`,
        err,
      )
    }
  }
}
