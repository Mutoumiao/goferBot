import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaMilvusIndexer } from '../../../packages/server/src/processors/indexing/prisma-milvus.indexer.js'
import { ValidationError } from '../../../packages/rag-sdk/src/errors.js'
import type { Chunk } from '../../../packages/rag-sdk/src/types.js'

describe('PrismaMilvusIndexer', () => {
  let indexer: PrismaMilvusIndexer
  let mockPrisma: any
  let mockVectorService: any

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn((ops) => Promise.all(ops)),
      chunk: { create: vi.fn((args) => Promise.resolve({ id: args.data.id })) },
    }
    mockVectorService = { insertVectors: vi.fn().mockResolvedValue(undefined) }
    indexer = new PrismaMilvusIndexer(mockPrisma, mockVectorService)
  })

  it('AC-06: creates chunks and inserts vectors with chunk.id as milvus id', async () => {
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'hello', chunkIndex: 0 },
    ]
    const vectors = [[0.1, 0.2, 0.3]]

    await indexer.index(chunks, vectors)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockVectorService.insertVectors).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c1', chunkId: 'c1', kbId: 'kb1', fileId: 'd1', embedding: [0.1, 0.2, 0.3] }),
    ])
  })

  it('AC-07: throws ValidationError when lengths mismatch', async () => {
    const chunks: Chunk[] = [{ id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'a', chunkIndex: 0 }]
    await expect(indexer.index(chunks, [])).rejects.toThrow(ValidationError)
  })

  it('AC-08: uses per-chunk TokenUsage when available', async () => {
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'hello', chunkIndex: 0 },
    ]
    const vectors = [[0.1]]
    const usage = [{ promptTokens: 5, totalTokens: 5 }]

    await indexer.index(chunks, vectors, usage)

    const createCalls = mockPrisma.chunk.create.mock.calls
    expect(createCalls[0][0].data.tokenCount).toBe(5)
  })

  it('AC-09: falls back to chunk.tokenCount or length/4 estimate', async () => {
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'hello world', chunkIndex: 0, tokenCount: 3 },
    ]
    const vectors = [[0.1]]

    await indexer.index(chunks, vectors)

    const createCalls = mockPrisma.chunk.create.mock.calls
    expect(createCalls[0][0].data.tokenCount).toBe(3)
  })

  it('AC-10: leaves orphan chunks when vector insert fails, cleaned by deleteByFileId', async () => {
    mockVectorService.insertVectors.mockRejectedValue(new Error('Milvus down'))
    const chunks: Chunk[] = [{ id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'a', chunkIndex: 0 }]
    const vectors = [[0.1]]

    await expect(indexer.index(chunks, vectors)).rejects.toThrow('Milvus down')
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('AC-11: does not insert vectors if chunk creation fails', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('PG constraint'))
    const chunks: Chunk[] = [{ id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'a', chunkIndex: 0 }]
    const vectors = [[0.1]]

    await expect(indexer.index(chunks, vectors)).rejects.toThrow('PG constraint')
    expect(mockVectorService.insertVectors).not.toHaveBeenCalled()
  })
})
