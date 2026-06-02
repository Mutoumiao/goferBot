/**
 * RAG SDK 最小闭环 Demo
 *
 * 验证链路：DocumentSource → chunk → embed → index → Query → retrieve → postprocess → context
 * 使用内存 Mock 实现所有外部接口，不依赖外部服务。
 */

import {
  RecursiveCharacterChunker,
  runIndexing,
  HybridRetriever,
  DefaultRetrievalPostprocessor,
  runRetrievalPipeline,
} from '../src/index.js'
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
} from '../src/index.js'

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

async function main() {
  console.log('[Demo] RAG SDK 最小闭环验证开始')

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

  // ========== Indexing Pipeline ==========
  console.log('[Demo] 执行索引流水线...')

  // 内联 indexer：将 Chunk+向量组装为 VectorRecord 后写入 IVectorStore
  // （原 VectorIndexer 已删除，SDK 不包含存储耦合实现）
  const indexer = {
    async index(chunks: Chunk[], vectors: number[][]) {
      const records: VectorRecord[] = chunks.map((chunk, i) => ({
        id: chunk.id,
        chunkId: chunk.id,
        kbId: chunk.kbId,
        fileId: chunk.documentId,
        embedding: vectors[i],
      }))
      await vectorStore.insertVectors(records)
    },
  }

  const indexingResult = await runIndexing(document, {
    chunker: new RecursiveCharacterChunker({ chunkSize: 30, chunkOverlap: 5 }),
    embedder,
    indexer,
    onStageChange: (stages) => {
      console.log('[Demo] Indexing stages:', stages.map(s => `${s.name}=${s.status}`).join(', '))
    },
  })

  console.log(`[Demo] 分块完成: ${indexingResult.chunks.length} chunks`)
  console.log(`[Demo] 向量写入: ${indexingResult.vectorCount} vectors`)

  // Register chunks to keyword store for retrieval
  for (const chunk of indexingResult.chunks) {
    keywordStore._register(chunk)
  }

  // ========== Retrieval Pipeline ==========
  console.log('[Demo] 执行检索流水线...')
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

  console.log(`[Demo] 回答生成完成: "${result.answer}"`)
  console.log(`[Demo] 选中 chunks: ${result.chunks.length}`)
  console.log(`[Demo] 检索阶段候选数: ${result.debugInfo.metrics.retrievalCount}`)
  console.log(`[Demo] 后处理阶段选中数: ${result.debugInfo.metrics.selectedCount}`)
  console.log(`[Demo] 丢弃候选数: ${result.debugInfo.metrics.droppedCount}`)
  console.log(`[Demo] 总 token 数: ${result.debugInfo.metrics.totalTokens}`)
  console.log(`[Demo] 总延迟: ${result.debugInfo.metrics.latencyMs}ms`)
  console.log(`[Demo] Trace ID: ${result.debugInfo.traceId}`)

  // ========== Assertions ==========
  const checks = [
    { name: 'chunks.length > 0', pass: indexingResult.chunks.length > 0 },
    { name: 'vectorCount === chunks.length', pass: indexingResult.vectorCount === indexingResult.chunks.length },
    { name: 'all stages completed', pass: indexingResult.stages.every(s => s.status === 'completed') },
    { name: 'answer is truthy', pass: !!result.answer },
    { name: 'result.chunks.length > 0', pass: result.chunks.length > 0 },
    { name: 'latencyMs >= 0', pass: result.debugInfo.metrics.latencyMs >= 0 },
    { name: 'stages.length === 3', pass: result.debugInfo.stages.length === 3 },
  ]

  console.log('\n[Demo] 验证结果:')
  let allPassed = true
  for (const check of checks) {
    const status = check.pass ? '✅' : '❌'
    console.log(`  ${status} ${check.name}`)
    if (!check.pass) allPassed = false
  }

  if (allPassed) {
    console.log('\n[Demo] ✅ 所有验证通过，RAG SDK 集成验证成功！')
    process.exit(0)
  } else {
    console.log('\n[Demo] ❌ 部分验证失败')
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('[Demo] 未捕获错误:', err)
  process.exit(1)
})
