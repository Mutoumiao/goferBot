import { describe, it, expect, vi } from 'vitest'
import { MilvusIndexer } from '../../../packages/rag-sdk/src/indexers/milvus.indexer.js'
import { ValidationError, IndexingError } from '../../../packages/rag-sdk/src/errors.js'
import type { IVectorStore } from '../../../packages/rag-sdk/src/vector-store.js'

describe('MilvusIndexer', () => {
  it('AC-03: throws ValidationError when chunks and vectors length mismatch', async () => {
    const mockStore: IVectorStore = {
      insertVectors: vi.fn().mockResolvedValue(undefined),
      searchVectors: vi.fn(),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const indexer = new MilvusIndexer(mockStore)
    const chunks = [{ id: 'c1', documentId: 'd1', kbId: 'k1', content: 'a', chunkIndex: 0 }] as any
    await expect(indexer.index(chunks, [[0.1], [0.2]])).rejects.toThrow(ValidationError)
  })

  it('AC-03: indexes chunks and vectors via IVectorStore', async () => {
    const insertVectors = vi.fn().mockResolvedValue(undefined)
    const mockStore: IVectorStore = {
      insertVectors,
      searchVectors: vi.fn(),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const indexer = new MilvusIndexer(mockStore)
    const chunks = [
      { id: 'c1', documentId: 'd1', kbId: 'k1', content: 'hello', chunkIndex: 0 },
      { id: 'c2', documentId: 'd1', kbId: 'k1', content: 'world', chunkIndex: 1 },
    ] as any
    const vectors = [[0.1, 0.2], [0.3, 0.4]]

    await indexer.index(chunks, vectors)
    expect(insertVectors).toHaveBeenCalledTimes(1)
    const records = insertVectors.mock.calls[0][0]
    expect(records).toHaveLength(2)
    expect(records[0].id).toBe('c1')
    expect(records[0].chunkId).toBe('c1')
    expect(records[0].kbId).toBe('k1')
    expect(records[0].fileId).toBe('d1')
    expect(records[0].embedding).toEqual([0.1, 0.2])
  })

  it('AC-03: throws IndexingError on IVectorStore failure', async () => {
    const mockStore: IVectorStore = {
      insertVectors: vi.fn().mockRejectedValue(new Error('connection refused')),
      searchVectors: vi.fn(),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const indexer = new MilvusIndexer(mockStore)
    const chunks = [{ id: 'c1', documentId: 'd1', kbId: 'k1', content: 'a', chunkIndex: 0 }] as any
    await expect(indexer.index(chunks, [[0.1]])).rejects.toThrow(IndexingError)
  })
})
