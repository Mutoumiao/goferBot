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

**关键映射：**

| VectorRecord 字段 | Milvus 字段 | 类型 |
|-------------------|-------------|------|
| `id` | `id` | VARCHAR(36)，主键 |
| `chunkId` | `chunk_id` | VARCHAR(36) |
| `kbId` | `kb_id` | VARCHAR(36) |
| `fileId` | `file_id` | VARCHAR(36) |
| `embedding` | `embedding` | FLOAT_VECTOR(dimension) |

---

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

**关键映射：**

| 概念 | PostgreSQL 实现 |
|------|-----------------|
| 中文分词 | `to_tsvector('chinese', content)`（需安装 zhparser） |
| 查询解析 | `plainto_tsquery('chinese', query)` |
| 相关性排序 | `ts_rank_cd(to_tsvector, query) DESC` |
| 知识库过滤 | `kb_id = ANY(kbIds)` |

---

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
