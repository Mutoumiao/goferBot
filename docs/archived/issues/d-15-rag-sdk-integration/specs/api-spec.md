# API 规格：d-15 RAG SDK 集成验证

## 模块导出

RAG SDK 所有能力通过 `@goferbot/rag-sdk` 统一导出。

```typescript
import {
  // Core types & schema
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  DocumentSource, Query, Chunk, ChunkWithScore,
  RetrievalCandidate, EmbeddingConfig, HybridSearchOptions,
  // Interfaces
  IChunker, IEmbedder, IIndexer, IRetriever, IReranker, IGenerator, IKeywordStore,
  IVectorStore, VectorRecord, VectorSearchOptions, VectorSearchResult,
  // Errors
  RAGError, EmbeddingError, RetrievalError, ValidationError, IndexingError,
  // Indexing
  RecursiveCharacterChunker, OpenAIEmbedder, MilvusIndexer, runIndexing,
  // Runtime
  HybridRetriever, reciprocalRankFusion,
  DefaultRetrievalPostprocessor, runRetrievalPipeline,
  // Observability
  RAGTracer, consoleObserver,
} from '@goferbot/rag-sdk'
```

---

## Demo 闭环契约

### 输入

```typescript
const document: DocumentSource = {
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  kbId: '550e8400-e29b-41d4-a716-446655440001',
  content: 'RAG（Retrieval-Augmented Generation）是一种将检索与生成结合的 NLP 技术。',
  mimeType: 'text/plain',
}

const query: Query = {
  original: '什么是 RAG 技术？',
  kbIds: ['550e8400-e29b-41d4-a716-446655440001'],
}
```

### 执行链路

```
document
  → RecursiveCharacterChunker.chunk() → Chunk[]
  → OpenAIEmbedder.embed() → number[][]
  → MilvusIndexer.index() → void (写入 IVectorStore)

query
  → HybridRetriever.retrieve() → RetrievalCandidate[]
  → DefaultRetrievalPostprocessor.process() → { candidates, trace }
  → IGenerator.generate({ query, chunks }) → string (answer)
```

### 期望输出

- `IndexingResult.chunks.length > 0`
- `IndexingResult.vectorCount === chunks.length`
- `RuntimePipelineResult.answer` 为非空字符串
- `RuntimePipelineResult.chunks.length > 0`
- `RuntimePipelineResult.debugInfo.metrics.latencyMs > 0`

---

## Server 集成点文档

### IVectorStore 实现指南

**由 server 的 `VectorService` 实现。**

```typescript
class VectorService implements IVectorStore {
  async insertVectors(records: VectorRecord[]): Promise<void> {
    // 调用 Milvus SDK 的 upsert 或 insert 方法
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    // 调用 Milvus SDK 的 search 方法
    // 注意：options.filter.kbId 需映射到 Milvus 的表达式过滤
  }

  async deleteByIds(ids: string[]): Promise<void> {
    // 调用 Milvus SDK 的 delete 方法
  }

  async ensureCollection(): Promise<void> {
    // 检查 collection 是否存在，不存在则创建
    // 字段：id (VARCHAR), chunkId (VARCHAR), kbId (VARCHAR), fileId (VARCHAR), embedding (FLOAT_VECTOR)
  }
}
```

**关键映射：**

| VectorRecord 字段 | Milvus 字段 | 类型 |
|-------------------|-------------|------|
| `id` | `id` | VARCHAR(36)，主键 |
| `chunkId` | `chunk_id` | VARCHAR(36) |
| `kbId` | `kb_id` | VARCHAR(36) |
| `fileId` | `file_id` | VARCHAR(36) |
| `embedding` | `embedding` | FLOAT_VECTOR(dimension) |

---

### IKeywordStore 实现指南

**由 server 的 `KeywordService` 实现，基于 PostgreSQL FTS。**

```typescript
class KeywordService implements IKeywordStore {
  async search(
    query: string,
    kbIds: string[],
    topK?: number,
  ): Promise<RetrievalCandidate[]> {
    // 使用 Prisma $queryRaw 执行 PostgreSQL 全文检索
    // SELECT ... FROM chunks
    // WHERE kb_id = ANY(${kbIds})
    // AND to_tsvector('chinese', content) @@ plainto_tsquery('chinese', ${query})
    // ORDER BY ts_rank DESC
    // LIMIT ${topK ?? 10}
  }
}
```

**关键映射：**

| 概念 | PostgreSQL 实现 |
|------|-----------------|
| 中文分词 | `to_tsvector('chinese', content)`（需安装 zhparser） |
| 查询解析 | `plainto_tsquery('chinese', query)` |
| 相关性排序 | `ts_rank_cd(to_tsvector, query) DESC` |
| 知识库过滤 | `kb_id = ANY(kbIds)` |

---

### IGenerator 实现指南

**由 server 的 `ChatService` 或 `LLMService` 实现。**

```typescript
class LLMService implements IGenerator {
  async generate(input: { query: Query; chunks: Chunk[] }): Promise<string> {
    // 1. 构建 system prompt（基于 chunks 拼接上下文）
    const context = input.chunks.map(c => c.content).join('\n---\n')
    const systemPrompt = `基于以下上下文回答问题：\n${context}`

    // 2. 调用 OpenAI / Claude / 本地模型 API
    // 3. 返回生成的回答文本
  }
}
```

**上下文拼接格式：**

```
基于以下上下文回答问题：
---
[chunk 1 content]
---
[chunk 2 content]
---

问题：[query.original]
```

---

## 错误处理建议

| 场景 | SDK 行为 | Server 建议 |
|------|----------|-------------|
| Embedding API 失败 | 抛出 `EmbeddingError` | Worker 重试 3 次后标记任务失败 |
| Milvus 连接断开 | 抛出 `IndexingError` / `RetrievalError` | 检查 Milvus 健康状态，自动重连 |
| 关键词检索失败 | 抛出 `RetrievalError` | 降级为纯向量检索 |
| 生成模型超时 | 抛出 `RAGError` | 返回友好提示，记录日志 |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Demo 最小闭环 | `tests/issues/d-15-rag-sdk-integration/integration.spec.ts` | `AC-01: completes full pipeline from document to answer` |
| Demo 使用 Mock 接口 | `tests/issues/d-15-rag-sdk-integration/integration.spec.ts` | `AC-01: runs with in-memory mock implementations` |
| 覆盖率 ≥ 80% | `tests/issues/d-15-rag-sdk-integration/coverage.spec.ts` | `AC-03: core logic coverage meets threshold` |
| pnpm test 通过 | （命令行验证） | `AC-04: pnpm test exits with 0` |
| pnpm build 通过 | （命令行验证） | `AC-05: pnpm build produces correct output` |
