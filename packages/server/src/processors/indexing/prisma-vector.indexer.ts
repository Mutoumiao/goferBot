import { Injectable } from '@nestjs/common'
import type { IIndexer, Chunk, TokenUsage } from '@goferbot/rag-sdk'
import { ValidationError } from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'

@Injectable()
export class PrismaVectorIndexer implements IIndexer {
  constructor(private readonly prisma: PrismaService) {}

  async index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(`chunks length ${chunks.length} != vectors length ${vectors.length}`)
    }
    if (chunks.length === 0) return

    const tokenCounts = this.computeTokenCounts(chunks, usage)

    await this.prisma.$transaction(async (tx: any) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRaw`
          INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
          VALUES (
            ${chunks[i].id}::uuid,
            ${chunks[i].documentId}::uuid,
            ${chunks[i].kbId}::uuid,
            ${chunks[i].content},
            ${tokenCounts[i]},
            ${chunks[i].chunkIndex},
            ${vectors[i]}::vector
          )
          ON CONFLICT (id) DO UPDATE SET
            document_id = EXCLUDED.document_id,
            kb_id = EXCLUDED.kb_id,
            content = EXCLUDED.content,
            token_count = EXCLUDED.token_count,
            chunk_index = EXCLUDED.chunk_index,
            embedding = EXCLUDED.embedding
        `
      }
    })
  }

  private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
    // 方案 A：embedder 提供了逐条 usage
    if (usage && usage.length === chunks.length) {
      return usage.map(u => u.promptTokens)
    }

    // 方案 B：embedder 提供了总量，按文本长度比例分配
    if (usage && usage.length === 1) {
      const totalTokens = usage[0].promptTokens
      const totalLength = chunks.reduce((sum, c) => sum + c.content.length, 0)
      return chunks.map(c =>
        Math.round((c.content.length / totalLength) * totalTokens)
      )
    }

    // 方案 C（回退）：使用 chunker 的估算值
    return chunks.map(c =>
      c.tokenCount ?? Math.ceil(c.content.length / 4)
    )
  }
}
