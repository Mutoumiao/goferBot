import { describe, it, expect, vi } from 'vitest'
import { HybridRetriever } from '../../../packages/rag-sdk/src/runtime/hybrid-retriever.js'
import { reciprocalRankFusion } from '../../../packages/rag-sdk/src/runtime/rrf.js'
import { DefaultRetrievalPostprocessor } from '../../../packages/rag-sdk/src/runtime/postprocessor.js'
import { runRetrievalPipeline } from '../../../packages/rag-sdk/src/runtime/pipeline.js'
import { ValidationError, RetrievalError } from '../../../packages/rag-sdk/src/errors.js'
import type { IVectorStore, VectorSearchResult } from '../../../packages/rag-sdk/src/vector-store.js'
import type { IKeywordStore, IEmbedder, IRetriever, IGenerator, IReranker } from '../../../packages/rag-sdk/src/interfaces.js'
import type { Query, RetrievalCandidate } from '../../../packages/rag-sdk/src/types.js'

const makeCandidate = (id: string, score: number, sourceOrTokenCount: any): RetrievalCandidate => {
  const isTokenCount = typeof sourceOrTokenCount === 'number'
  return {
    chunk: {
      id, documentId: 'd1', kbId: 'k1',
      content: 'test ' + id,
      chunkIndex: 0,
      tokenCount: isTokenCount ? sourceOrTokenCount : undefined,
    } as any,
    score,
    source: isTokenCount ? 'vector' : sourceOrTokenCount,
  }
}

describe('IKeywordStore', () => {
  it('AC-02: defines search method with correct signature', () => {
    const store: IKeywordStore = {
      search: async (query, kbIds, topK) => {
        expect(typeof query).toBe('string')
        expect(Array.isArray(kbIds)).toBe(true)
        return []
      },
    }
    expect(store).toBeDefined()
  })
})

describe('reciprocalRankFusion', () => {
  it('AC-03: fuses vector and keyword results with RRF', () => {
    const vectorResults = [
      makeCandidate('a', 0.9, 'vector'),
      makeCandidate('b', 0.8, 'vector'),
    ]
    const keywordResults = [
      makeCandidate('b', 0.85, 'keyword'),
      makeCandidate('c', 0.7, 'keyword'),
    ]

    const fused = reciprocalRankFusion([vectorResults, keywordResults], 60)
    expect(fused.length).toBe(3)
    expect(fused[0].source).toBe('hybrid')
    expect(fused[0].chunk.id).toBe('b')
  })

  it('AC-03: uses default k=60 when not provided', () => {
    const results = [[makeCandidate('a', 0.5, 'vector')]]
    const fused = reciprocalRankFusion(results)
    expect(fused.length).toBe(1)
    expect(fused[0].score).toBe(1 / (60 + 1))
  })

  it('AC-03: returns empty array for empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([])
    expect(reciprocalRankFusion([[]])).toEqual([])
  })
})

describe('DefaultRetrievalPostprocessor', () => {
  const query: Query = { original: 'test', kbIds: ['k1'] }

  it('AC-04: filters candidates below minScore', async () => {
    const processor = new DefaultRetrievalPostprocessor({ minScore: 0.5 })
    const candidates = [makeCandidate('a', 0.9), makeCandidate('b', 0.3)]
    const result = await processor.process(candidates, query)
    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].chunk.id).toBe('a')
    expect(result.trace.steps[0].operation).toBe('filter')
  })

  it('AC-04: reranks when reranker provided', async () => {
    const reranker: IReranker = {
      rerank: vi.fn().mockResolvedValue([
        makeCandidate('b', 0.99),
        makeCandidate('a', 0.1),
      ]),
    }
    const processor = new DefaultRetrievalPostprocessor({ reranker })
    const candidates = [makeCandidate('a', 0.9), makeCandidate('b', 0.8)]
    const result = await processor.process(candidates, query)
    expect(result.candidates[0].chunk.id).toBe('b')
    expect(result.trace.steps.some(s => s.operation === 'rerank')).toBe(true)
  })

  it('AC-04: trims candidates by token budget', async () => {
    const processor = new DefaultRetrievalPostprocessor({ tokenBudget: 5 })
    const candidates = [
      makeCandidate('a', 0.9, 3),
      makeCandidate('b', 0.8, 3),
    ]
    const result = await processor.process(candidates, query)
    expect(result.candidates.length).toBeLessThanOrEqual(1)
    expect(result.trace.steps.some(s => s.operation === 'budget-trim')).toBe(true)
  })

  it('AC-05: records each processing step', async () => {
    const processor = new DefaultRetrievalPostprocessor({ minScore: 0.5, maxChunks: 1 })
    const candidates = [makeCandidate('a', 0.9), makeCandidate('b', 0.8), makeCandidate('c', 0.3)]
    const result = await processor.process(candidates, query)
    expect(result.trace.initialCount).toBe(3)
    expect(result.trace.finalCount).toBe(1)
    expect(result.trace.steps.length).toBeGreaterThanOrEqual(2)
  })
})

describe('HybridRetriever', () => {
  const mockEmbedder: IEmbedder = {
    embed: vi.fn().mockResolvedValue([[0.1, 0.2]]),
    config: { provider: 'test', model: 'test', dimension: 2, apiKey: 'test' },
  }

  const mockVectorStore: IVectorStore = {
    insertVectors: vi.fn(),
    searchVectors: vi.fn().mockResolvedValue([
      { id: 'v1', chunkId: 'c1', score: 0.9 },
    ] as VectorSearchResult[]),
    deleteByIds: vi.fn(),
    ensureCollection: vi.fn(),
  }

  const mockKeywordStore: IKeywordStore = {
    search: vi.fn().mockResolvedValue([
      { chunk: { id: 'c2', documentId: 'd1', kbId: 'k1', content: 'kw', chunkIndex: 0 } as any, score: 0.8, source: 'keyword' },
    ]),
  }

  it('AC-01: returns empty for empty query', async () => {
    const retriever = new HybridRetriever({
      vectorStore: mockVectorStore,
      keywordStore: mockKeywordStore,
      embedder: mockEmbedder,
    })
    const result = await retriever.retrieve({
      original: '',
      kbIds: ['550e8400-e29b-41d4-a716-446655440001'],
    })
    expect(result).toEqual([])
  })

  it('AC-01: returns empty for empty kbIds', async () => {
    const retriever = new HybridRetriever({
      vectorStore: mockVectorStore,
      keywordStore: mockKeywordStore,
      embedder: mockEmbedder,
    })
    const result = await retriever.retrieve({
      original: 'test',
      kbIds: [],
    })
    expect(result).toEqual([])
  })

  it('AC-01: falls back to keyword on vector failure', async () => {
    const failingVectorStore: IVectorStore = {
      insertVectors: vi.fn(),
      searchVectors: vi.fn().mockRejectedValue(new Error('vector fail')),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const retriever = new HybridRetriever({
      vectorStore: failingVectorStore,
      keywordStore: mockKeywordStore,
      embedder: mockEmbedder,
    })
    const result = await retriever.retrieve({
      original: 'test',
      kbIds: ['k1'],
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].source).toBe('keyword')
  })

  it('AC-01: falls back to vector on keyword failure', async () => {
    const failingKeywordStore: IKeywordStore = {
      search: vi.fn().mockRejectedValue(new Error('keyword fail')),
    }
    const retriever = new HybridRetriever({
      vectorStore: mockVectorStore,
      keywordStore: failingKeywordStore,
      embedder: mockEmbedder,
    })
    const result = await retriever.retrieve({
      original: 'test',
      kbIds: ['k1'],
    })
    expect(result.length).toBeGreaterThan(0)
    expect(result[0].source).toBe('vector')
  })

  it('AC-01: throws RetrievalError when both fail', async () => {
    const failingVectorStore: IVectorStore = {
      insertVectors: vi.fn(),
      searchVectors: vi.fn().mockRejectedValue(new Error('vector fail')),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const failingKeywordStore: IKeywordStore = {
      search: vi.fn().mockRejectedValue(new Error('keyword fail')),
    }
    const retriever = new HybridRetriever({
      vectorStore: failingVectorStore,
      keywordStore: failingKeywordStore,
      embedder: mockEmbedder,
    })
    await expect(retriever.retrieve({
      original: 'test',
      kbIds: ['k1'],
    })).rejects.toThrow(RetrievalError)
  })
})

describe('runRetrievalPipeline', () => {
  const query: Query = { original: 'test', kbIds: ['k1'] }

  const mockRetriever: IRetriever = {
    retrieve: vi.fn().mockResolvedValue([
      { chunk: { id: 'c1', documentId: 'd1', kbId: 'k1', content: 'hello', chunkIndex: 0 } as any, score: 0.9, source: 'vector' },
    ]),
  }

  const mockGenerator: IGenerator = {
    generate: vi.fn().mockResolvedValue('generated answer'),
  }

  it('AC-06: runs retrieval pipeline and returns result with debugInfo', async () => {
    const postprocessor = new DefaultRetrievalPostprocessor()
    const result = await runRetrievalPipeline(query, mockRetriever, postprocessor, mockGenerator)
    expect(result.answer).toBe('generated answer')
    expect(result.chunks.length).toBeGreaterThan(0)
    expect(result.debugInfo.traceId).toBeDefined()
    expect(result.debugInfo.stages.length).toBe(3)
    expect(result.debugInfo.metrics.retrievalCount).toBe(1)
    expect(result.debugInfo.metrics.selectedCount).toBe(1)
    expect(result.debugInfo.metrics.latencyMs).toBeGreaterThanOrEqual(0)
  })

  it('AC-06: records stage timings in debugInfo', async () => {
    const postprocessor = new DefaultRetrievalPostprocessor()
    const result = await runRetrievalPipeline(query, mockRetriever, postprocessor, mockGenerator)
    for (const stage of result.debugInfo.stages) {
      expect(stage.endTime).toBeGreaterThanOrEqual(stage.startTime)
    }
  })
})

describe('runtime exports', () => {
  it('AC-07: exports all runtime modules from runtime/index.ts', async () => {
    const runtime = await import('../../../packages/rag-sdk/src/runtime/index.js')
    expect(runtime.HybridRetriever).toBeDefined()
    expect(runtime.reciprocalRankFusion).toBeDefined()
    expect(runtime.DefaultRetrievalPostprocessor).toBeDefined()
    expect(runtime.runRetrievalPipeline).toBeDefined()
  })

  it('AC-07: exports all runtime modules from root index.ts', async () => {
    const root = await import('../../../packages/rag-sdk/src/index.js')
    expect(root.HybridRetriever).toBeDefined()
    expect(root.reciprocalRankFusion).toBeDefined()
    expect(root.DefaultRetrievalPostprocessor).toBeDefined()
    expect(root.runRetrievalPipeline).toBeDefined()
  })
})
