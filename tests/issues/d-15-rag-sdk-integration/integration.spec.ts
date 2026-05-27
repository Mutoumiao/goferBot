import { describe, it, expect } from 'vitest'
import {
  RecursiveCharacterChunker,
  MilvusIndexer,
  runIndexing,
  HybridRetriever,
  DefaultRetrievalPostprocessor,
  runRetrievalPipeline,
} from '@goferbot/rag-sdk'
import type {
  DocumentSource,
  Query,
  Chunk,
  IVectorStore,
  VectorRecord,
  VectorSearchResult,
  IKeywordStore,
  RetrievalCandidate,
  IGenerator,
  EmbeddingConfig,
} from '@goferbot/rag-sdk'

// 内存 Mock IVectorStore
function createMockVectorStore(): IVectorStore {
  const store = new Map<string, VectorRecord>()
  return {
    async insertVectors(records: VectorRecord[]) {
      for (const r of records) store.set(r.id, r)
    },
    async searchVectors(queryVector: number[], options?) {
      const results: VectorSearchResult[] = []
      for (const r of store.values()) {
        if (options?.filter?.kbId && r.kbId !== options.filter.kbId) continue
        const score = queryVector.reduce((sum, v, i) => sum + v * (r.embedding[i] ?? 0), 0)
        results.push({ id: r.id, chunkId: r.chunkId, score: Math.min(1, Math.max(0, score)) })
      }
      return results.sort((a, b) => b.score - a.score).slice(0, options?.topK ?? 5)
    },
    async deleteByIds(ids: string[]) {
      for (const id of ids) store.delete(id)
    },
    async ensureCollection() {},
  }
}

// 内存 Mock IKeywordStore
function createMockKeywordStore(): IKeywordStore & { _register(chunk: Chunk): void } {
  const chunks = new Map<string, Chunk>()
  return {
    async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
      const results: RetrievalCandidate[] = []
      for (const [, chunk] of chunks) {
        if (!kbIds.includes(chunk.kbId)) continue
        if (chunk.content.includes(query)) {
          results.push({ chunk, score: 0.8, source: 'keyword' })
        }
      }
      return results.slice(0, topK ?? 10)
    },
    _register(chunk: Chunk) { chunks.set(chunk.id, chunk) },
  }
}

// 内存 Mock IGenerator
function createMockGenerator(): IGenerator {
  return {
    async generate({ query, chunks }) {
      return `Answer based on ${chunks.length} chunks for: ${query.original}`
    },
  }
}

// 内存 Mock IEmbedder（固定维度，确定性输出）
function createMockEmbedder(dimension = 4) {
  return {
    config: { provider: 'mock', model: 'mock', dimension, apiKey: 'mock', baseUrl: 'http://mock' } as Readonly<EmbeddingConfig>,
    async embed(texts: string[]) {
      return texts.map((_, i) => Array.from({ length: dimension }, (_, j) => (i + 1) * 0.1 + j * 0.01))
    },
  }
}

describe('RAG SDK Integration', () => {
  it('AC-01: completes full pipeline from document to answer', async () => {
    const document: DocumentSource = {
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'RAG（Retrieval-Augmented Generation）是一种将检索与生成结合的 NLP 技术。它通过从外部知识库检索相关文档，增强生成模型的回答能力。',
      mimeType: 'text/plain',
    }

    const query: Query = {
      original: 'RAG 技术',
      kbIds: ['550e8400-e29b-41d4-a716-446655440001'],
    }

    const vectorStore = createMockVectorStore()
    const keywordStore = createMockKeywordStore()
    const embedder = createMockEmbedder(4)
    const generator = createMockGenerator()

    // Indexing pipeline
    const indexingResult = await runIndexing(document, {
      chunker: new RecursiveCharacterChunker({ chunkSize: 30, chunkOverlap: 5 }),
      embedder,
      indexer: new MilvusIndexer(vectorStore),
    })

    expect(indexingResult.chunks.length).toBeGreaterThan(0)
    expect(indexingResult.vectorCount).toBe(indexingResult.chunks.length)
    expect(indexingResult.stages.every(s => s.status === 'completed')).toBe(true)

    // Register chunks to keyword store for retrieval
    for (const chunk of indexingResult.chunks) {
      keywordStore._register(chunk)
    }

    // Retrieval pipeline
    const retriever = new HybridRetriever({
      vectorStore,
      keywordStore,
      embedder,
      vectorWeight: 0.7,
      keywordWeight: 0.3,
      rrfK: 60,
    })

    const postprocessor = new DefaultRetrievalPostprocessor({
      minScore: 0.0,
      maxChunks: 10,
      tokenBudget: 3000,
    })

    const result = await runRetrievalPipeline(
      query,
      retriever,
      postprocessor,
      generator,
    )

    expect(result.answer).toBeTruthy()
    expect(result.chunks.length).toBeGreaterThan(0)
    expect(result.debugInfo.metrics.latencyMs).toBeGreaterThanOrEqual(0)
    expect(result.debugInfo.metrics.retrievalCount).toBeGreaterThanOrEqual(0)
    expect(result.debugInfo.metrics.selectedCount).toBeGreaterThanOrEqual(0)
    expect(result.debugInfo.stages.length).toBe(3)
  })

  it('AC-01: runs with in-memory mock implementations', async () => {
    const vectorStore = createMockVectorStore()
    const keywordStore = createMockKeywordStore()
    const embedder = createMockEmbedder()
    const generator = createMockGenerator()

    const chunker = new RecursiveCharacterChunker({ chunkSize: 20, chunkOverlap: 5 })
    const chunks = await chunker.chunk({
      documentId: crypto.randomUUID(),
      kbId: crypto.randomUUID(),
      content: 'Hello world. This is a test document.',
      mimeType: 'text/plain',
    })

    const vectors = await embedder.embed(chunks.map(c => c.content))
    const indexer = new MilvusIndexer(vectorStore)
    await indexer.index(chunks, vectors)

    const retriever = new HybridRetriever({ vectorStore, keywordStore, embedder })
    const candidates = await retriever.retrieve({
      original: 'test',
      kbIds: [chunks[0].kbId],
    })

    expect(Array.isArray(candidates)).toBe(true)
  })
})
