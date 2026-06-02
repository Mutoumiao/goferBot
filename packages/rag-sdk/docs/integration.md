# RAG SDK Server 集成指南

本文档描述如何在 NestJS server 中集成 `@goferbot/rag-sdk`。

---

## 概述

RAG SDK 采用**接口注入**模式：SDK 定义抽象接口，server 提供具体实现并通过构造函数注入。

```
┌─────────────┐     实现      ┌─────────────────┐
│   Server    │ ─────────────→│  IVectorStore   │
│  (NestJS)   │     实现      ├─────────────────┤
│             │ ─────────────→│  IKeywordStore  │
│             │     实现      ├─────────────────┤
│             │ ─────────────→│   IIndexer      │
│             │     实现      ├─────────────────┤
│             │ ─────────────→│   IGenerator    │
│             │               └─────────────────┘
│             │                      ↑
│             │         注入         │
│             │──────────────────────┘
│             │         @goferbot/rag-sdk
└─────────────┘
```

### 接口实现映射

| SDK 接口 | Server 实现 | 存储后端 | 文件 |
|----------|------------|----------|------|
| `IVectorStore` | `PgVectorStore` | PostgreSQL pgvector | `server/src/vector/pgvector.ts` |
| `IIndexer` | `PrismaVectorIndexer` | PostgreSQL（单事务写入） | `server/src/processors/indexing/prisma-vector.indexer.ts` |
| `IKeywordStore` | `KeywordService` | PostgreSQL FTS（zhparser） | `server/src/processors/keyword/keyword.service.ts` |
| `IGenerator` | `ChatService` | OpenAI 兼容 LLM API | `server/src/modules/chat/chat.service.ts` |

> **架构变更（ADR 0005）**：向量存储从 Milvus 独立服务迁移至 PostgreSQL pgvector 扩展。
> 元数据与向量同库同表，利用 PostgreSQL 原生 ACID 事务消除双写不一致。

---

## IVectorStore 实现 — PgVectorStore

`PgVectorStore` 在 PostgreSQL 上封装 pgvector 扩展的向量操作，通过 `PrismaService.$queryRaw` / `$executeRaw` 执行原始 SQL。

```typescript
// packages/server/src/vector/pgvector.ts
import type { IVectorStore, VectorRecord, VectorSearchOptions, VectorSearchResult } from '@goferbot/rag-sdk'
import type { PrismaService } from '../processors/database/prisma.service.js'
import { VectorStoreError } from '../interfaces/errors.js'

export class PgVectorStore implements IVectorStore {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCollection(): Promise<void> {
    // 确保 pgvector 扩展已安装（幂等）
    await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
  }

  /**
   * @deprecated ADR 0005 后，向量插入由 PrismaVectorIndexer 处理（单事务写入元数据+向量）。
   * 本方法保留仅用于 IVectorStore 接口完整性，直接调用会丢失 content/tokenCount/chunkIndex。
   */
  async insertVectors(_records: VectorRecord[]): Promise<void> {
    throw new VectorStoreError(
      'insertVectors 已废弃。请使用 PrismaVectorIndexer.index() 进行单事务写入。'
    )
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    const topK = options?.topK ?? 5
    const kbId = options?.filter?.kbId

    // cosine similarity: 1 - (embedding <=> query)
    // 使用 <=> (cosine distance operator)，embeddings 已归一化时等价于 1 - cosine_distance
    const results = await this.prisma.$queryRaw<Array<{ id: string; score: number }>>`
      SELECT
        id::text,
        1 - (embedding <=> ${queryVector}::vector) as score
      FROM chunks
      WHERE ${kbId ? `kb_id = ${kbId}::uuid AND` : ''} embedding IS NOT NULL
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT ${topK}
    `

    return results.map(r => ({
      id: r.id,
      chunkId: r.id,
      score: Number(r.score),
    }))
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM chunks WHERE id = ANY(${ids}::uuid[])
    `
  }
}
```

**关键点**：
- `insertVectors` 已废弃 — 向量写入由 `PrismaVectorIndexer.index()` 在单事务中完成
- `searchVectors` 使用 pgvector `<=>` 余弦距离操作符
- `deleteByIds` 通过 `ANY(array)` 批量删除
- 不再需要独立的 Milvus Docker 服务

---

## IIndexer 实现 — PrismaVectorIndexer

**这是 ADR 0005 后的核心变更**：索引写入不再通过 `IVectorStore.insertVectors`，而是由 `PrismaVectorIndexer` 在单一 PostgreSQL 事务中同时写入 chunks 元数据和 embedding 向量。

```typescript
// packages/server/src/processors/indexing/prisma-vector.indexer.ts
import type { IIndexer, Chunk, TokenUsage } from '@goferbot/rag-sdk'
import { ValidationError } from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'

export class PrismaVectorIndexer implements IIndexer {
  constructor(private readonly prisma: PrismaService) {}

  async index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(`chunks length ${chunks.length} != vectors length ${vectors.length}`)
    }
    if (chunks.length === 0) return

    const tokenCounts = this.computeTokenCounts(chunks, usage)

    // 单事务：元数据 + 向量同时写入，支持重试
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRaw`
          INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
          VALUES (
            ${chunks[i].id}::uuid,
            ${chunks[i].documentId}::uuid,
            ${chunks[i].kbId}::uuid,
            ${chunks[i].content},
            ${tokenCounts[i]},
            ${chunks[i].chunkIndex},
            ${vectors[i]}::vector
          )
          ON CONFLICT (id) DO UPDATE SET
            document_id = EXCLUDED.document_id,
            kb_id = EXCLUDED.kb_id,
            content = EXCLUDED.content,
            token_count = EXCLUDED.token_count,
            chunk_index = EXCLUDED.chunk_index,
            embedding = EXCLUDED.embedding
        `
      }
    })
  }

  private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
    // 方案 A：embedder 提供了逐条 usage → 直接使用
    if (usage && usage.length === chunks.length) {
      return usage.map(u => u.promptTokens)
    }
    // 方案 B：embedder 提供了总量 → 按文本长度比例分配
    if (usage && usage.length === 1) {
      const totalTokens = usage[0].promptTokens
      const totalLength = chunks.reduce((sum, c) => sum + c.content.length, 0)
      return chunks.map(c => Math.round((c.content.length / totalLength) * totalTokens))
    }
    // 方案 C（回退）：chunker 估算值
    return chunks.map(c => c.tokenCount ?? Math.ceil(c.content.length / 4))
  }
}
```

**关键点**：
- `$transaction` 保证元数据与向量的原子性写入
- `ON CONFLICT ... DO UPDATE` 支持重试（幂等），重复索引同一文档不会报错
- `computeTokenCounts` 三级策略：精确 usage → 按比例分配 → 估算回退
- Prisma 的 `Unsupported("vector(1536)")` 类型不支持通过 Prisma Client `create`，因此使用 `$executeRaw` 直接操作

### Prisma Schema 变更

```prisma
model Chunk {
  id         String                      @id @default(uuid())
  documentId String                      @map("document_id")
  kbId       String                      @map("kb_id")
  content    String
  tokenCount Int?                        @map("token_count")
  chunkIndex Int                         @map("chunk_index")
  embedding  Unsupported("vector(1536)")?  // ← pgvector 向量列
  createdAt  DateTime                    @default(now()) @map("created_at")

  document      Document      @relation(fields: [documentId], references: [id], onDelete: Cascade)
  knowledgeBase KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)

  @@map("chunks")
}
```

> `ON DELETE CASCADE` 外键使得删除 document/knowledge_base 时 chunks（含 embedding）自动级联删除，无需 `deleteByFileId`/`deleteByKbId` 方法。

---

## IKeywordStore 实现 — PostgreSQL FTS

`KeywordService` 基于 PostgreSQL 全文检索，优先使用 `zhparser` 中文分词扩展。

```typescript
// packages/server/src/processors/keyword/keyword.service.ts
import type { IKeywordStore, RetrievalCandidate } from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'

export class KeywordService implements IKeywordStore {
  private useChineseConfig = false

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // 检测 zhparser 是否安装
    const result = await this.prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'zhparser'
    `
    this.useChineseConfig = result.length > 0
  }

  async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
    if (!query?.trim() || !kbIds?.length) return []

    const config = this.useChineseConfig ? 'chinese' : 'simple'
    const limit = topK ?? 10

    const results = await this.prisma.$queryRaw<Array<{
      id: string; document_id: string; kb_id: string
      content: string; chunk_index: number; rank: number
    }>>`
      SELECT id, document_id, kb_id, content, chunk_index,
        ts_rank_cd(to_tsvector(${config}, content), plainto_tsquery(${config}, ${query.trim()})) as rank
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND to_tsvector(${config}, content) @@ plainto_tsquery(${config}, ${query.trim()})
      ORDER BY rank DESC
      LIMIT ${limit}
    `

    return results.map(r => ({
      chunk: { id: r.id, documentId: r.document_id, kbId: r.kb_id, content: r.content, chunkIndex: r.chunk_index },
      score: Math.min(1, Number(r.rank)),
      source: 'keyword' as const,
    }))
  }
}
```

**关键点**：
- 自动检测 `zhparser` 扩展，未安装时回退到 `simple` 配置
- 使用 `ts_rank_cd` 计算相关性分数，归一化到 [0, 1]

---

## IGenerator 实现 — ChatService（SSE 流式）

`ChatService` 通过 OpenAI 兼容 API 进行流式对话，同时承担 `IGenerator` 角色。

```typescript
// packages/server/src/modules/chat/chat.service.ts (检索部分)
async *streamChat(userId: string, dto: ChatDto): AsyncGenerator<ChatChunk> {
  // ...

  // RAG 检索：当 knowledgeBaseIds 存在时注入 system message
  if (dto.knowledgeBaseIds?.length > 0) {
    try {
      const query = { original: message, kbIds: dto.knowledgeBaseIds }
      const candidates = await this.retriever.retrieve(query, 10)
      const processed = await this.postprocessor.process(candidates, query)
      const validCandidates = processed.candidates.filter(
        c => c.chunk.content?.trim().length > 0
      )
      if (validCandidates.length > 0) {
        const context = validCandidates.map(c => c.chunk.content).join('\n---\n')
        llmMessages.push({ role: 'system', content: `基于以下上下文回答问题：\n${context}` })
      }
    } catch (err) {
      this.logger.warn(`Retrieval failed, continuing without RAG: ${err}`)
    }
  }

  // ... 发送 LLM 请求并流式返回
}
```

**上下文拼接格式**：
```
基于以下上下文回答问题：
---
[chunk 1 content]
---
[chunk 2 content]
---
```

---

## BullMQ Worker 集成 — IndexingWorker

在 Worker 中使用 `runIndexing` 执行异步索引任务：

```typescript
// packages/server/src/processors/queue/indexing.worker.ts
import { runIndexing, OpenAIEmbedder, RecursiveCharacterChunker } from '@goferbot/rag-sdk'
import { PrismaVectorIndexer } from '../indexing/prisma-vector.indexer.js'

export class IndexingWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaVectorIndexer,  // ← 注入
    private readonly config: ConfigService,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId } = job.data
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })

    // 下载 + 解析
    const buffer = await this.storage.downloadFile(doc.storageKey)
    const text = await this.parser.parse(buffer, doc.mimeType ?? 'text/plain')

    // 配置 Embedder
    const embedder = new OpenAIEmbedder({
      provider: 'openai',
      apiKey: this.config.getOrThrow('EMBEDDING_API_KEY'),
      baseUrl: this.config.get('EMBEDDING_BASE_URL') ?? undefined,
      model: this.config.get('EMBEDDING_MODEL', 'text-embedding-3-small'),
      dimension: this.config.get('EMBEDDING_DIMENSIONS', 1536),
    })

    try {
      await runIndexing(
        { documentId: doc.id, kbId: doc.kbId, content: text, mimeType: doc.mimeType ?? 'text/plain' },
        {
          chunker: new RecursiveCharacterChunker(),
          embedder,
          indexer: this.indexer,  // ← PrismaVectorIndexer 单事务写入
          onStageChange: async (stages) => {
            const running = stages.find(s => s.status === 'running')
            if (running) {
              const statusMap: Record<string, string> = {
                chunk: 'chunking', embed: 'embedding', index: 'indexing',
              }
              await this.prisma.document.update({
                where: { id: doc.id },
                data: { status: statusMap[running.name] ?? 'indexing' },
              })
            }
          },
        },
      )
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'ready' },
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      await this.prisma.document.update({
        where: { id: doc.id },
        data: { status: 'failed', errorMessage: message },
      })
      throw err
    }
  }
}
```

**文档状态流转**：
```
uploaded → chunking → embedding → indexing → ready
                                             ↘ failed (error)
```

---

## 检索链路集成

在 `ChatModule` 中组装检索流水线：

```typescript
// packages/server/src/processors/queue/queue.module.ts (检索组件注册)
import { HybridRetriever, DefaultRetrievalPostprocessor } from '@goferbot/rag-sdk'

// 注册 HybridRetriever
{
  provide: HybridRetriever,
  useFactory: (vectorService: VectorService, keywordService: KeywordService, embedder: OpenAIEmbedder) => {
    return new HybridRetriever({
      vectorStore: vectorService,
      keywordStore: keywordService,
      embedder,
      vectorWeight: 0.7,
      keywordWeight: 0.3,
    })
  },
  inject: [VectorService, KeywordService, 'OPENAI_EMBEDDER'],
}

// 注册 DefaultRetrievalPostprocessor
{
  provide: DefaultRetrievalPostprocessor,
  useFactory: () => new DefaultRetrievalPostprocessor({
    minScore: 0.3,
    maxChunks: 10,
    tokenBudget: 3000,
  }),
}
```

---

## 错误处理

| 场景 | SDK 行为 | Server 建议 |
|------|----------|-------------|
| Embedding API 失败 | 抛出 `EmbeddingError` | Worker 重试 3 次后标记 `failed` |
| pgvector 查询失败 | 抛出 `VectorStoreError` | `HybridRetriever` 捕获后降级为关键词检索 |
| 关键词检索失败 | 返回 `[]`（不抛异常） | `HybridRetriever` 捕获后降级为纯向量检索 |
| 双路检索均失败 | 抛出 `RetrievalError` | `ChatService` 捕获后不带 RAG 上下文继续对话 |
| 索引事务失败 | 抛出异常 | Worker 标记 `failed` 并记录 `errorMessage` |
| ON CONFLICT 重复写入 | 幂等更新（`DO UPDATE`） | 无需处理 |

---

## 数据流总览

```
上传文档
  │
  ▼
DocumentController.upload()
  │  保存文件到 MinIO
  │  创建 document 记录（status = 'uploaded'）
  │  入队 BullMQ job
  ▼
IndexingWorker.handleIndexJob()
  │  downloadFile (MinIO)
  │  DocumentParser.parse (txt/md)
  │  runIndexing({
  │    chunker: RecursiveCharacterChunker
  │    embedder: OpenAIEmbedder
  │    indexer: PrismaVectorIndexer  ← 单事务写入 PG
  │  })
  │  status → 'ready'
  ▼
ChatService.streamChat()
  │  HybridRetriever.retrieve()
  │    ├── vectorStore.searchVectors()  → pgvector <=>
  │    └── keywordStore.search()       → PostgreSQL FTS
  │  RRF 融合 → Postprocessor → LLM
  │  流式返回 SSE
  ▼
  用户看到 AI 回复
```

---

## 从 Milvus 迁移到 pgvector 的变更摘要

| 维度 | 旧方案 (Milvus) | 新方案 (pgvector) |
|------|-----------------|-------------------|
| 向量写入 | `IVectorStore.insertVectors` | `PrismaVectorIndexer.index()`（单事务） |
| 元数据+向量 | 双写：PG chunks + Milvus collection | 单写：PG chunks 表（含 embedding 列） |
| 事务保证 | 无（应用层协调） | PostgreSQL 原生 ACID |
| Docker 服务 | 4 个（PG + MinIO + Milvus + Redis） | 3 个（PG + MinIO + Redis） |
| 检索查询 | Milvus 搜索 → 回查 PG 获取 content | 单表 SQL：直接查 chunks |
| 依赖包 | `@zilliz/milvus2-sdk-node` | 仅 Prisma |
| 删除级联 | 手动 `deleteByFileId` / `deleteByKbId` | `ON DELETE CASCADE` 自动 |
