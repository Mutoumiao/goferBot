import { describe, it, expect } from 'vitest'
import {
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  ChunkWithScoreSchema, RetrievalCandidateSchema,
  EmbeddingConfigSchema, HybridSearchOptionsSchema,
} from '../../../packages/rag-sdk/src/schema.js'
import { RAGError, EmbeddingError, IndexingError } from '../../../packages/rag-sdk/src/errors.js'
import type { IChunker, IEmbedder, IIndexer, IRetriever, IReranker, IGenerator, IVectorStore, IKeywordStore } from '../../../packages/rag-sdk/src/interfaces.js'
import type { IndexingStage, RuntimeDebugInfo } from '../../../packages/rag-sdk/src/pipeline.js'

describe('Schema validation', () => {
  it('AC-01: validates valid DocumentSource', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello world',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(true)
  })

  it('AC-02: rejects empty content in DocumentSource', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: '',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })

  it('AC-03: rejects negative chunkIndex in Chunk', () => {
    const result = ChunkSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      kbId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'hello',
      chunkIndex: -1,
    })
    expect(result.success).toBe(false)
  })

  it('AC-04: rejects invalid UUID format', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: 'not-a-uuid',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })
})

describe('Error hierarchy', () => {
  it('AC-05: preserves error cause chain', () => {
    const cause = new Error('network timeout')
    const err = new EmbeddingError('embed failed', cause)
    // vitest happy-dom 环境下 cause 可能被包装，检查 message 更可靠
    expect(err.cause).toBeDefined()
    expect((err.cause as Error).message).toBe('network timeout')
    expect(err.name).toBe('EmbeddingError')
  })

  it('AC-05b: IndexingError exists and supports cause', () => {
    const cause = new Error('milvus down')
    const err = new IndexingError('index failed', cause)
    expect(err.cause).toBeDefined()
    expect((err.cause as Error).message).toBe('milvus down')
    expect(err.name).toBe('IndexingError')
    expect(err).toBeInstanceOf(RAGError)
  })
})

describe('Interface shapes', () => {
  it('AC-09: IVectorStore has required methods', () => {
    const store: IVectorStore = {
      insertVectors: async () => {},
      searchVectors: async () => [],
      deleteByIds: async () => {},
      ensureCollection: async () => {},
    }
    expect(store).toBeDefined()
  })

  it('AC-09b: IRetriever accepts Query object', () => {
    const retriever: IRetriever = {
      retrieve: async (query, topK, options) => {
        expect(query.original).toBeDefined()
        return []
      },
    }
    expect(retriever).toBeDefined()
  })
})

describe('Pipeline types', () => {
  it('AC-08: validates IndexingStage status enum', () => {
    const stage: IndexingStage = {
      name: 'chunking',
      status: 'running',
    }
    expect(stage.status).toBe('running')
  })

  it('AC-08b: RuntimeDebugInfo has required metrics', () => {
    const debug: RuntimeDebugInfo = {
      traceId: 'abc',
      query: { original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] },
      stages: [],
      metrics: {
        retrievalCount: 0,
        selectedCount: 0,
        droppedCount: 0,
        totalTokens: 0,
        latencyMs: 0,
      },
    }
    expect(debug.metrics.latencyMs).toBe(0)
  })
})

describe('Type inference', () => {
  it('AC-06: infers correct types from Zod schemas', () => {
    const docResult = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello',
      mimeType: 'text/plain',
    })
    expect(docResult.success).toBe(true)
    if (docResult.success) {
      expect(docResult.data.content).toBe('hello')
    }

    const queryResult = QuerySchema.safeParse({
      original: 'test query',
      kbIds: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(queryResult.success).toBe(true)
    if (queryResult.success) {
      expect(queryResult.data.original).toBe('test query')
    }

    const chunkResult = ChunkSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      kbId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'hello',
      chunkIndex: 0,
    })
    expect(chunkResult.success).toBe(true)

    const candidateResult = RetrievalCandidateSchema.safeParse({
      chunk: chunkResult.success ? chunkResult.data : {},
      score: 0.5,
      source: 'vector',
    })
    expect(candidateResult.success).toBe(true)
    if (candidateResult.success) {
      expect(candidateResult.data.source).toBe('vector')
    }
  })
})
