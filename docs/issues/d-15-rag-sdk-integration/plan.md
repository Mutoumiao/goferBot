---
id: d-15
issue: issue.md
version: 1
---

# RAG SDK 集成验证实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 完成 RAG SDK 端到端集成验证，包括最小闭环 demo、server 集成点文档、覆盖率补全与构建验证。

**架构：** 使用内存 Mock 实现所有外部接口（IVectorStore / IKeywordStore / IGenerator），在不依赖外部服务的情况下验证完整链路。集成文档以 Markdown 形式输出到 `packages/rag-sdk/docs/`。

**技术栈：** TypeScript + Vitest + @goferbot/rag-sdk

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) · [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

### 新建文件
- `tests/issues/d-15-rag-sdk-integration/integration.spec.ts` — 端到端闭环测试
- `tests/issues/d-15-rag-sdk-integration/coverage.spec.ts` — 覆盖率阈值断言
- `packages/rag-sdk/docs/integration.md` — server 集成点文档
- `packages/rag-sdk/docs/` — 文档目录

### 修改文件
- `packages/rag-sdk/package.json` — 如有需要调整 build 脚本

---

## 任务 1: 编写端到端集成测试

**文件：**
- 创建：`tests/issues/d-15-rag-sdk-integration/integration.spec.ts`
- 测试：`tests/issues/d-15-rag-sdk-integration/integration.spec.ts`

**规格引用：**
- 功能规格：[Demo 闭环契约]
- API 规格：[IVectorStore / IKeywordStore / IGenerator 实现指南]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-15-rag-sdk-integration/integration.spec.ts
import { describe, it, expect } from 'vitest'
import {
  RecursiveCharacterChunker,
  OpenAIEmbedder,
  MilvusIndexer,
  runIndexing,
  HybridRetriever,
  DefaultRetrievalPostprocessor,
  runRetrievalPipeline,
  RAGTracer,
  consoleObserver,
} from '@goferbot/rag-sdk'
import type { DocumentSource, Query, Chunk, IVectorStore, VectorRecord, VectorSearchResult, IKeywordStore, RetrievalCandidate, IGenerator } from '@goferbot/rag-sdk'

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
        // 简单点积模拟
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
function createMockKeywordStore(): IKeywordStore {
  const chunks = new Map<string, Chunk>()
  return {
    async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
      const results: RetrievalCandidate[] = []
      for (const [id, chunk] of chunks) {
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
    config: { provider: 'mock', model: 'mock', dimension, apiKey: 'mock', baseUrl: 'http://mock' } as const,
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
      ;(keywordStore as any)._register(chunk)
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
    expect(result.debugInfo.metrics.latencyMs).toBeGreaterThan(0)
    expect(result.debugInfo.metrics.retrievalCount).toBeGreaterThanOrEqual(0)
    expect(result.debugInfo.metrics.selectedCount).toBeGreaterThanOrEqual(0)
    expect(result.debugInfo.stages.length).toBe(3)
  })

  it('AC-01: runs with in-memory mock implementations', async () => {
    // 验证所有 Mock 实现不依赖外部服务即可运行
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
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-15-rag-sdk-integration/integration.spec.ts`
预期：FAIL — 文件不存在或导入失败

- [ ] **步骤 3: 创建测试文件并运行**

创建 `tests/issues/d-15-rag-sdk-integration/integration.spec.ts`，填入上述代码。

运行：`npx vitest run tests/issues/d-15-rag-sdk-integration/integration.spec.ts`
预期：FAIL — `createMockKeywordStore` 返回的 Mock 可能有类型不匹配

- [ ] **步骤 4: 修复类型并验证通过**

调整 Mock 类型使其完全对齐 `IKeywordStore` 接口（移除 `_register` 方法或转为独立 Map）。

运行：`npx vitest run tests/issues/d-15-rag-sdk-integration/integration.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/d-15-rag-sdk-integration/integration.spec.ts
git commit -m "test(d-15): add end-to-end integration test with mock implementations"
```

---

## 任务 2: 编写覆盖率阈值测试

**文件：**
- 创建：`tests/issues/d-15-rag-sdk-integration/coverage.spec.ts`
- 测试：`tests/issues/d-15-rag-sdk-integration/coverage.spec.ts`

**规格引用：**
- 功能规格：[覆盖率 ≥ 80%]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-15-rag-sdk-integration/coverage.spec.ts
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('RAG SDK Coverage', () => {
  it('AC-03: core logic coverage meets threshold', () => {
    // 读取 vitest coverage json-summary 输出
    const coveragePath = path.resolve('coverage/coverage-summary.json')
    if (!fs.existsSync(coveragePath)) {
      throw new Error('Coverage report not found. Run: npx vitest run --coverage')
    }

    const summary = JSON.parse(fs.readFileSync(coveragePath, 'utf-8'))
    const ragSdkPath = 'packages/rag-sdk/src/'

    let totalLines = 0
    let coveredLines = 0

    for (const [file, data] of Object.entries(summary)) {
      if (file.startsWith(ragSdkPath) && !file.includes('index.ts')) {
        const d = data as { lines: { total: number; covered: number } }
        totalLines += d.lines.total
        coveredLines += d.lines.covered
      }
    }

    const coverage = totalLines === 0 ? 0 : (coveredLines / totalLines) * 100
    expect(coverage).toBeGreaterThanOrEqual(80)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-15-rag-sdk-integration/coverage.spec.ts`
预期：FAIL — coverage-summary.json 不存在

- [ ] **步骤 3: 生成覆盖率报告**

运行：`npx vitest run --coverage tests/issues/d-12-rag-sdk-indexing-module/ tests/issues/d-13-rag-sdk-runtime-module/ tests/issues/d-14-rag-sdk-observability/ tests/issues/d-15-rag-sdk-integration/`
预期：生成 coverage/coverage-summary.json

- [ ] **步骤 4: 运行覆盖率测试验证通过**

运行：`npx vitest run tests/issues/d-15-rag-sdk-integration/coverage.spec.ts`
预期：PASS（覆盖率 ≥ 80%）

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/d-15-rag-sdk-integration/coverage.spec.ts
git commit -m "test(d-15): add coverage threshold test for rag-sdk core logic"
```

---

## 任务 3: 编写 Server 集成点文档

**文件：**
- 创建：`packages/rag-sdk/docs/integration.md`
- 创建：`packages/rag-sdk/docs/` 目录

**规格引用：**
- API 规格：[IVectorStore / IKeywordStore / IGenerator 实现指南]

- [ ] **步骤 1: 创建文档目录**

```bash
mkdir -p packages/rag-sdk/docs
```

- [ ] **步骤 2: 编写集成文档**

```markdown
# RAG SDK Server 集成指南

本文档描述如何在 NestJS server 中集成 `@goferbot/rag-sdk`。

## 概述

RAG SDK 采用**接口注入**模式：SDK 定义抽象接口，server 提供具体实现并通过构造函数注入。

```
┌─────────────┐     实现      ┌─────────────────┐
│   Server    │ ─────────────→│  IVectorStore   │
│  (NestJS)   │     实现      ├─────────────────┤
│             │ ─────────────→│  IKeywordStore  │
│             │     实现      ├─────────────────┤
│             │ ─────────────→│   IGenerator    │
│             │               └─────────────────┘
│             │                      ↑
│             │         注入         │
│             │──────────────────────┘
│             │         @goferbot/rag-sdk
└─────────────┘
```

## IVectorStore 实现（Milvus）

由 `VectorService` 实现，负责向量数据的插入与 ANN 搜索。

```typescript
import { Injectable } from '@nestjs/common'
import { MilvusClient } from '@zilliz/milvus2-sdk-node'
import type { IVectorStore, VectorRecord, VectorSearchResult } from '@goferbot/rag-sdk'

@Injectable()
export class VectorService implements IVectorStore {
  private client: MilvusClient

  constructor() {
    this.client = new MilvusClient({ address: process.env.MILVUS_URI })
  }

  async insertVectors(records: VectorRecord[]): Promise<void> {
    await this.client.insert({
      collection_name: 'chunks',
      fields_data: records.map(r => ({
        id: r.id,
        chunk_id: r.chunkId,
        kb_id: r.kbId,
        file_id: r.fileId,
        embedding: r.embedding,
      })),
    })
  }

  async searchVectors(
    queryVector: number[],
    options?: { topK?: number; filter?: { kbId?: string } },
  ): Promise<VectorSearchResult[]> {
    const result = await this.client.search({
      collection_name: 'chunks',
      vector: queryVector,
      topk: options?.topK ?? 5,
      filter: options?.filter?.kbId ? `kb_id == "${options.filter.kbId}"` : undefined,
    })
    return result.results.map(r => ({
      id: r.id as string,
      chunkId: r.chunk_id as string,
      score: r.score as number,
    }))
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await this.client.delete({
      collection_name: 'chunks',
      ids,
    })
  }

  async ensureCollection(): Promise<void> {
    // 检查并创建 collection
  }
}
```

## IKeywordStore 实现（PostgreSQL FTS）

由 `KeywordService` 实现，基于 PostgreSQL 全文检索。

```typescript
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { IKeywordStore, RetrievalCandidate } from '@goferbot/rag-sdk'

@Injectable()
export class KeywordService implements IKeywordStore {
  constructor(private prisma: PrismaService) {}

  async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
    const results = await this.prisma.$queryRaw<Array<{
      id: string
      document_id: string
      kb_id: string
      content: string
      chunk_index: number
      rank: number
    }>>`
      SELECT id, document_id, kb_id, content, chunk_index, ts_rank_cd(to_tsvector('chinese', content), plainto_tsquery('chinese', ${query})) as rank
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND to_tsvector('chinese', content) @@ plainto_tsquery('chinese', ${query})
      ORDER BY rank DESC
      LIMIT ${topK ?? 10}
    `

    return results.map(r => ({
      chunk: {
        id: r.id,
        documentId: r.document_id,
        kbId: r.kb_id,
        content: r.content,
        chunkIndex: r.chunk_index,
      },
      score: Math.min(1, r.rank),
      source: 'keyword' as const,
    }))
  }
}
```

## IGenerator 实现（LLM）

由 `ChatService` 或 `LLMService` 实现。

```typescript
import { Injectable } from '@nestjs/common'
import { OpenAI } from 'openai'
import type { IGenerator, Query, Chunk } from '@goferbot/rag-sdk'

@Injectable()
export class LLMService implements IGenerator {
  private openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

  async generate(input: { query: Query; chunks: Chunk[] }): Promise<string> {
    const context = input.chunks.map(c => c.content).join('\n---\n')
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: `基于以下上下文回答问题：\n${context}` },
        { role: 'user', content: input.query.original },
      ],
    })
    return response.choices[0].message.content ?? ''
  }
}
```

## BullMQ Worker 集成

在 Worker 中使用 `runIndexing` 执行异步索引任务：

```typescript
import { runIndexing } from '@goferbot/rag-sdk'

async function handleIndexJob(job: Job) {
  const { document } = job.data
  const result = await runIndexing(document, {
    chunker: new RecursiveCharacterChunker(),
    embedder: new OpenAIEmbedder(config),
    indexer: new MilvusIndexer(vectorService),
    onStageChange: async (stages) => {
      await job.updateProgress({ stages })
    },
  })
  return result
}
```

## ChatService 集成

在问答接口中使用 `runRetrievalPipeline`：

```typescript
import { runRetrievalPipeline, HybridRetriever, DefaultRetrievalPostprocessor } from '@goferbot/rag-sdk'

async function chat(query: Query) {
  const retriever = new HybridRetriever({
    vectorStore: this.vectorService,
    keywordStore: this.keywordService,
    embedder: this.embedder,
  })

  const result = await runRetrievalPipeline(
    query,
    retriever,
    new DefaultRetrievalPostprocessor(),
    this.llmService,
  )

  return {
    answer: result.answer,
    chunks: result.chunks,
    debugInfo: result.debugInfo,
  }
}
```

## 错误处理建议

| 场景 | SDK 行为 | Server 建议 |
|------|----------|-------------|
| Embedding API 失败 | 抛出 `EmbeddingError` | Worker 重试 3 次后标记失败 |
| Milvus 连接断开 | 抛出 `IndexingError` / `RetrievalError` | 检查健康状态，自动重连 |
| 关键词检索失败 | 抛出 `RetrievalError` | 降级为纯向量检索 |
| 生成超时 | 抛出 `RAGError` | 返回友好提示 |
```

- [ ] **步骤 3: 验证文档**

确认文档路径：`packages/rag-sdk/docs/integration.md`
确认文档包含：IVectorStore / IKeywordStore / IGenerator / Worker / ChatService / 错误处理

- [ ] **步骤 4: 提交**

```bash
git add packages/rag-sdk/docs/integration.md
git commit -m "docs(d-15): add server integration guide for rag-sdk"
```

---

## 任务 4: 验证 pnpm test 与 pnpm build

**文件：**
- 修改：无（纯验证任务）

**规格引用：**
- 功能规格：[pnpm test / pnpm build 验证]

- [ ] **步骤 1: 运行全部 RAG SDK 相关测试**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/ tests/issues/d-13-rag-sdk-runtime-module/ tests/issues/d-14-rag-sdk-observability/ tests/issues/d-15-rag-sdk-integration/`
预期：全部通过，0 失败

- [ ] **步骤 2: 运行类型检查**

运行：`pnpm --filter @goferbot/rag-sdk type-check`
预期：0 错误

- [ ] **步骤 3: 运行构建**

运行：`pnpm --filter @goferbot/rag-sdk build`
预期：dist/ 目录生成，包含 index.js / index.d.ts

- [ ] **步骤 4: 验证产物路径**

确认：`packages/rag-sdk/dist/index.js` 存在
确认：`packages/rag-sdk/dist/index.d.ts` 存在

- [ ] **步骤 5: 提交**

```bash
git add packages/rag-sdk/dist/
git commit -m "chore(d-15): verify build output and test pass"
```

---

## 自检

1. **规格覆盖**：
   - [x] AC-01: demo 可运行 → 任务 1 覆盖
   - [x] AC-02: server 集成点文档 → 任务 3 覆盖
   - [x] AC-03: 覆盖率 ≥ 80% → 任务 2 覆盖
   - [x] AC-04: pnpm test 通过 → 任务 4 覆盖
   - [x] AC-05: pnpm build 通过 → 任务 4 覆盖

2. **占位符扫描**：无 TBD / TODO / 稍后实现

3. **类型一致性**：所有 Mock 类型与 SDK 接口一致
