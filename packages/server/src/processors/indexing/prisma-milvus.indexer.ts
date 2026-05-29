import { Injectable } from '@nestjs/common'
import type { IIndexer, Chunk, TokenUsage } from '@goferbot/rag-sdk'
import { ValidationError } from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'
import { VectorService } from '../vector/vector.service.js'

@Injectable()
export class PrismaMilvusIndexer implements IIndexer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
  ) {}

  async index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(`chunks length ${chunks.length} != vectors length ${vectors.length}`)
    }
    if (chunks.length === 0) return

    const tokenCounts = this.computeTokenCounts(chunks, usage)

    await this.prisma.$transaction(
      chunks.map((chunk, i) =>
        this.prisma.chunk.create({
          data: {
            id: chunk.id,
            documentId: chunk.documentId,
            kbId: chunk.kbId,
            content: chunk.content,
            tokenCount: tokenCounts[i],
            chunkIndex: chunk.chunkIndex,
          },
        })
      )
    )

    const records = chunks.map((chunk, i) => ({
      id: chunk.id,
      chunkId: chunk.id,
      kbId: chunk.kbId,
      fileId: chunk.documentId,
      embedding: vectors[i],
    }))

    await this.vectorService.insertVectors(records)
  }

  private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
    if (usage && usage.length === chunks.length) {
      return usage.map(u => u.promptTokens)
    }
    return chunks.map(c => c.tokenCount ?? Math.ceil(c.content.length / 4))
  }
}
