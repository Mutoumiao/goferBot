# Server 侧 RAG SDK 集成 PRD

> 版本：v1.1
> 日期：2026-06-01
> 范围：将 `@goferbot/rag-sdk` 接入 NestJS server，替换现有 TODO 占位逻辑
>
> **v1.1 更新**：向量存储从 Milvus 迁移至 PostgreSQL pgvector（参见 ADR 0005）。本文档中所有 Milvus 相关描述已更新为 pgvector 方案。

---

## 1. 项目概述

RAG SDK（`packages/rag-sdk`）已完成核心模块开发（d-11 ~ d-15），提供分块、向量化、索引构建、混合检索、生成等完整 RAG 流水线。当前 server 侧存在以下未接入点：

- `ChatService.streamChat()` 中 `TODO(phase-5): 接入 RAG 检索` 未实现
- `DocumentService.upload()` 上传后未触发索引任务
- Worker handler 未使用 SDK 的 `runIndexing` 流水线
- Server 未声明对 `@goferbot/rag-sdk` 的依赖

本 PRD 定义 server 侧接入 SDK 的完整方案，包括接口适配、流水线集成、状态生命周期管理。

---

## 2. 现状分析

### 2.1 Server 现有能力

| 模块 | 现状 | 问题 |
|------|------|------|
| `VectorService` | 已实现 pgvector 操作（insert/search/delete/ensureCollection） | 实现的是 server 自有 `IVectorStore`，非 SDK 接口 |
| `DocumentService` | 上传文件到 MinIO，创建 PG 记录（status='uploaded'） | 未触发后续 parse/chunk/embed/index 任务 |
| `ChatService` | SSE 流式对话，直接组装历史消息调用 LLM | 未注入 RAG 检索上下文 |
| `QueueService` | BullMQ 队列管理（document + embedding） | Worker handler 为占位实现 |
| `WorkerService` | 启动 document/embedding worker | handler 通过 token 注入，未绑定实际逻辑 |

### 2.2 SDK 提供的能力

| 模块 | 导出 | 用途 |
|------|------|------|
| `runIndexing` | pipeline | DocumentSource → chunk → embed → index |
| `runRetrievalPipeline` | pipeline | Query → retrieve → postprocess → generate |
| `HybridRetriever` | runtime | 向量 + 关键词 + RRF 融合检索 |
| `DefaultRetrievalPostprocessor` | runtime | 分数过滤 / 重排序 / token 预算 / 最大块数 |
| `IVectorStore` | interface | 向量存储抽象 |
| `IKeywordStore` | interface | 关键词存储抽象 |
| `IGenerator` | interface | LLM 生成抽象 |

### 2.3 关键差距

1. **接口不匹配**：Server 的 `VectorService` 实现了 server 自有的 `IVectorStore`（`packages/server/src/interfaces/IVectorStore.ts`），与 SDK 的 `IVectorStore`（`packages/rag-sdk/src/vector-store.ts`）字段完全一致，但分属不同模块，TypeScript 视为不同类型。
2. **流式生成冲突**：SDK `IGenerator.generate()` 返回 `Promise<string>`，而 `ChatService.streamChat()` 使用 SSE 流式输出（`AsyncGenerator<ChatChunk>`）。直接接入会破坏现有流式体验。
3. **索引任务未触发**：文档上传后停留在 `uploaded` 状态，无自动化流水线推进。
4. **关键词检索缺失**：Server 无 `IKeywordStore` 实现，HybridRetriever 的关键词分支无法工作。

---

## 3. 架构设计

### 3.1 集成总览

```
┌─────────────────────────────────────────────────────────────┐
│                        NestJS Server                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ DocumentService│  │ ChatService │  │  IndexingWorker     │  │
│  │  (触发任务)   │  │ (检索+对话)  │  │  (BullMQ Handler)   │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              @goferbot/rag-sdk                       │    │
│  │  ┌──────────────┐  ┌─────────────────────────────┐  │    │
│  │  │ runIndexing  │  │   runRetrievalPipeline      │  │    │
│  │  │ (索引流水线)  │  │   (检索+生成流水线)          │  │    │
│  │  └──────────────┘  └─────────────────────────────┘  │    │
│  │           ▲                      ▲                  │    │
│  │           │                      │                  │    │
│  │  ┌────────┴────────┐    ┌────────┴────────┐        │    │
│  │  │  IChunker       │    │  IRetriever      │        │    │
│  │  │  IEmbedder      │    │  IPostprocessor  │        │    │
│  │  │  IIndexer       │    │  IGenerator      │        │    │
│  │  └─────────────────┘    └─────────────────┘        │    │
│  └─────────────────────────────────────────────────────┘    │
│         ▲                ▲                     ▲             │
│         │                │                     │             │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐  │
│  │VectorService │  │KeywordService│  │  LLMGenerator       │  │
│  │(SDK IVectorStore)│ (SDK IKeywordStore)│  (SDK IGenerator)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│         ▲                ▲                     ▲             │
│         │                │                     │             │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────────┴──────────┐  │
│  │ PostgreSQL  │  │  PostgreSQL │  │   LLM API (SSE)     │  │
│  │  (pgvector) │  │  (FTS 检索)  │  │   (OpenAI 兼容)      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 核心决策

| 决策 | 选择 | 理由 |
|------|------|------|
| VectorService 适配方式 | 直接实现 SDK `IVectorStore` | 字段完全一致，删除 server 自有接口定义，避免重复 |
| 流式生成冲突 | **ChatService 不走 SDK `runRetrievalPipeline`** | `runRetrievalPipeline` 返回完整字符串，破坏 SSE 流式体验。改为：ChatService 自行调用 `HybridRetriever.retrieve()` + `postprocessor.process()` 获取 chunks，再注入 SSE 流式生成 |
| 关键词检索 | PostgreSQL `to_tsvector` + `plainto_tsquery` | 无需额外依赖，MVP 够用；中文支持需安装 `zhparser` |
| 索引触发时机 | `DocumentService.upload()` 成功后立即添加 BullMQ job | 保持异步流水线设计，不阻塞上传响应 |
| Document status 流转 | uploaded → parsing → chunking → indexing → ready/failed | 与 SDK `runIndexing` 的 stage 对齐 |

---

## 4. 详细设计

### 4.1 VectorService → SDK IVectorStore

**变更**：`packages/server/src/processors/vector/vector.service.ts`

- 移除 `implements IVectorStore`（server 自有接口）
- 改为 `implements import('@goferbot/rag-sdk').IVectorStore`
- 删除 `packages/server/src/interfaces/IVectorStore.ts`（冗余定义）
- `ensureCollection()` 语义调整：pgvector 下为 `CREATE EXTENSION IF NOT EXISTS vector`
- **移除 `deleteByFileId` / `deleteByKbId`**：`chunks` 表已定义 `ON DELETE CASCADE`，删除 document 自动级联删除关联 chunks（含 embedding），无需手动清理

**字段映射**（server ↔ SDK）：

| Server 字段 | SDK 字段 | 说明 |
|-------------|----------|------|
| `VectorRecord.id` | `VectorRecord.id` | 完全一致 |
| `VectorRecord.chunkId` | `VectorRecord.chunkId` | 完全一致 |
| `VectorRecord.kbId` | `VectorRecord.kbId` | 完全一致 |
| `VectorRecord.fileId` | `VectorRecord.fileId` | 完全一致 |
| `VectorRecord.embedding` | `VectorRecord.embedding` | 完全一致 |

**调用方适配**：`DocumentService.remove()` 删除文档时，利用 `ON DELETE CASCADE` 自动清理关联 chunks（含 embedding）：

```typescript
async remove(userId, kbId, docId):
  // ... 权限检查 ...
  // chunks 表有 ON DELETE CASCADE，删除 document 自动级联删除关联 chunks
  await this.prisma.document.delete({ where: { id: docId } })
```

### 4.2 KeywordService → SDK IKeywordStore

**新增**：`packages/server/src/processors/keyword/keyword.service.ts`

基于 PostgreSQL 全文检索实现：

```typescript
@Injectable()
export class KeywordService implements IKeywordStore {
  constructor(private prisma: PrismaService) {}

  async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]>
}
```

**SQL 策略**：
- 中文分词：`to_tsvector('chinese', content)`（依赖 zhparser）
- 查询解析：`plainto_tsquery('chinese', query)`
- 相关性排序：`ts_rank_cd(to_tsvector, query) DESC`
- 知识库过滤：`kb_id = ANY(kbIds::uuid[])`

**降级方案**：若 zhparser 未安装，降级为 `to_tsvector('simple', content)` + `plainto_tsquery('simple', query)`（仅支持空格分词，中文效果差但可用）。

### 4.3 ChatService RAG 集成

**变更**：`packages/server/src/modules/chat/chat.service.ts`

**方案**：不走 `runRetrievalPipeline`（非流式），改为手动编排：

```
streamChat(userId, dto):
  1. 确保会话归属
  2. 保存用户消息
  3. 若 dto.knowledgeBaseIds 存在且非空：
     a. 调用 HybridRetriever.retrieve(query, topK)
     b. 调用 DefaultRetrievalPostprocessor.process(candidates, query)
     c. 将筛选后的 chunks 内容拼接为 context
     d. 在 system message 中注入 context
  4. 组装历史消息 + system context → SSE 流式调用 LLM
  5. 保存 assistant 消息
  6. yield done
```

**关键代码变更**：

```typescript
// 替换现有的 TODO(phase-5) 段落
let systemContext = ''
if (dto.knowledgeBaseIds && dto.knowledgeBaseIds.length > 0) {
  const query: Query = {
    original: message,
    kbIds: dto.knowledgeBaseIds,
  }
  const candidates = await this.retriever.retrieve(query, 10)
  const { candidates: processed } = await this.postprocessor.process(candidates, query)
  if (processed.length > 0) {
    systemContext = processed.map(c => c.chunk.content).join('\n---\n')
  }
}

const llmMessages: Array<{ role: string; content: string }> = []
if (systemContext) {
  llmMessages.push({
    role: 'system',
    content: `基于以下上下文回答问题：\n${systemContext}`,
  })
}
llmMessages.push(...historyMessages.map(m => ({ role: m.role, content: m.content })))
```

**注入依赖**：
- `HybridRetriever`：需 `VectorService`（IVectorStore）、`KeywordService`（IKeywordStore）、`Embedder`（IEmbedder）
- `DefaultRetrievalPostprocessor`：使用默认配置（minScore=0, maxChunks=10, tokenBudget=3000）
- `Embedder`：需新增 `OpenAIEmbedder` 实例（复用 SDK 实现）

**Token 计数策略**：
- `IEmbedder` 接口扩展 `embedWithUsage()` 方法，返回逐条 `TokenUsage`
- `OpenAIEmbedder` 解析 API 响应中的 `usage.prompt_tokens`，按文本长度比例分配到各 chunk
- `PrismaVectorIndexer` 优先写入 embedder 提供的精确 tokenCount，无 usage 时才回退到 chunker 估算值
- 这是唯一能让 token 计数与模型实际 tokenizer 保持一致的方案，估算仅作为降级路径

### 4.4 索引流水线集成

**变更**：`DocumentService.upload()` + 新增 `IndexingWorker` + 新增 `DocumentParser` + SDK `IEmbedder` 接口扩展

**Document status 与 SDK stage 映射**：

| SDK stage | Server status | 说明 |
|-----------|---------------|------|
| — | `uploaded` | 初始状态，等待 Worker 处理 |
| `chunk` | `chunking` | 分块阶段 |
| `embed` | `embedding` | 向量化阶段 |
| `index` | `indexing` | 向量入库阶段 |
| 完成 | `ready` | 索引完成，可检索 |
| 异常 | `failed` | 任一步骤失败 |

**新增 DocumentParser**：

```typescript
// packages/server/src/processors/parser/document.parser.ts
@Injectable()
export class DocumentParser {
  async parse(buffer: Buffer, mimeType: string): Promise<string> {
    if (mimeType === 'text/plain') {
      return buffer.toString('utf-8')
    }
    if (mimeType === 'application/pdf') {
      // MVP 阶段：使用 pdf-parse 或类似库
      // TODO: 接入具体 PDF 解析库
      throw new Error('PDF parsing not yet implemented')
    }
    if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') {
      return buffer.toString('utf-8')
    }
    // 默认尝试按文本读取
    return buffer.toString('utf-8')
  }
}
```

**DocumentService.upload() 变更**：

```typescript
async upload(userId, kbId, payload):
  // ... 现有上传逻辑 ...
  const doc = await this.prisma.document.create({...})

  // 新增：触发索引任务
  await this.queueService.addDocumentJob(doc.id, 'index')

  return doc
```

**Queue job type 调整**：

现有 `DocumentJobData.type: 'parse' | 'chunk' | 'embed'` 为旧设计，SDK `runIndexing` 已内聚 chunk+embed+index 三阶段。统一替换为 `'index'`，由 `IndexingWorker` 驱动完整流水线。

```typescript
export interface DocumentJobData {
  documentId: string
  type: 'index'  // 替换旧类型：'parse'|'chunk'|'embed'
}
```

**新增 IndexingWorker**：

```typescript
// packages/server/src/processors/queue/indexing.worker.ts
@Injectable()
export class IndexingWorker {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private parser: DocumentParser,
    private config: ConfigService,
  ) {}

  async handleIndexJob(job: Job<{ documentId: string }>): Promise<void> {
    const { documentId } = job.data

    // 1. 读取文档
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc) throw new Error(`Document ${documentId} not found`)

    // 2. 从 MinIO 下载并解析
    const buffer = await this.storage.downloadFile(doc.storageKey)
    const text = await this.parser.parse(buffer, doc.mimeType)

    // 3. 构建 DocumentSource
    const documentSource: DocumentSource = {
      id: doc.id,
      content: text,
      metadata: { kbId: doc.kbId, fileName: doc.name },
    }

    // 4. 调用 runIndexing（SDK 内部执行 chunk → embed → index）
    // 注意：SDK IEmbedder 已扩展 embedWithUsage()，runIndexing 内部优先使用
    // 以获取精确 tokenCount 传入 PrismaVectorIndexer
    const stageToStatus: Record<string, DocumentStatus> = {
      chunk: 'chunking',
      embed: 'embedding',
      index: 'indexing',
    }

    const result = await runIndexing(documentSource, {
      chunker: new RecursiveCharacterChunker({ chunkSize: 500, chunkOverlap: 50 }),
      embedder: new OpenAIEmbedder({
        apiKey: this.config.getOrThrow('EMBEDDING_API_KEY'),
        baseUrl: this.config.get('EMBEDDING_BASE_URL'),
        model: this.config.get('EMBEDDING_MODEL', 'text-embedding-3-small'),
        dimensions: this.config.get('EMBEDDING_DIMENSIONS', 1536),
      }),
      indexer: new PrismaVectorIndexer(this.prisma),
      onStageChange: async (stages) => {
        const current = stages.find(s => s.status === 'running')
        if (current && stageToStatus[current.name]) {
          await this.updateStatus(doc.id, stageToStatus[current.name])
        }
      },
    })

    // 5. 最终状态
    await this.updateStatus(doc.id, 'ready')
  }

  private async updateStatus(docId: string, status: DocumentStatus) {
    await this.prisma.document.update({ where: { id: docId }, data: { status } })
  }
}
```

**新增 PrismaVectorIndexer**（原 `PrismaMilvusIndexer`，pgvector 迁移后重命名）：

```typescript
// packages/server/src/processors/indexing/prisma-vector.indexer.ts
export interface TokenUsage {
  promptTokens: number
  totalTokens: number
}

export class PrismaVectorIndexer implements IIndexer {
  constructor(private readonly prisma: PrismaService) {}

  async index(
    chunks: Chunk[],
    vectors: number[][],
    usage?: TokenUsage[],
  ): Promise<void> {
    // 1. 计算精确的 tokenCount（优先使用 embedder 提供的 usage）
    const tokenCounts = this.computeTokenCounts(chunks, usage)

    // 2. 单事务：同时写入 chunks 元数据 + 向量到 PostgreSQL
    // ON CONFLICT 用于 Worker 重试场景，避免重复插入报错
    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRaw`
          INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
          VALUES (${chunks[i].id}, ${chunks[i].documentId}, ${chunks[i].kbId},
                  ${chunks[i].content}, ${tokenCounts[i]}, ${chunks[i].chunkIndex},
                  ${vectors[i]}::vector)
          ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            token_count = EXCLUDED.token_count,
            embedding = EXCLUDED.embedding
        `
      }
    })
  }

  private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
    // 方案 A：embedder 提供了逐条 usage，直接使用
    if (usage && usage.length === chunks.length) {
      return usage.map(u => u.promptTokens)
    }

    // 方案 B：embedder 提供了总量，按文本长度比例分配
    if (usage && usage.length === 1) {
      const totalTokens = usage[0].promptTokens
      const totalLength = chunks.reduce((sum, c) => sum + c.content.length, 0)
      return chunks.map(c =>
        Math.round((c.content.length / totalLength) * totalTokens)
      )
    }

    // 方案 C（回退）：使用 chunker 的估算值
    return chunks.map(c =>
      c.tokenCount ?? Math.ceil(c.content.length / 4)
    )
  }
}
```

**关键改进**：元数据与向量在同一 PostgreSQL 事务中写入，彻底消除双写不一致。无需 milvusId 回写，chunk.id 即为主键。

**IEmbedder 接口扩展**：

```typescript
// packages/rag-sdk/src/interfaces.ts
export interface IEmbedder {
  embed(texts: string[]): Promise<number[][]>
  embedWithUsage(texts: string[]): Promise<{ vectors: number[][]; usage: TokenUsage[] }>
  readonly config: Readonly<EmbeddingConfig>
}

export interface TokenUsage {
  promptTokens: number
  totalTokens: number
}
```

**OpenAIEmbedder 实现**：

```typescript
// packages/rag-sdk/src/indexing/openai-embedder.ts
async embedWithUsage(texts: string[]): Promise<{ vectors: number[][]; usage: TokenUsage[] }> {
  const response = await this.client.embeddings.create({
    model: this.config.model,
    input: texts,
  })

  const vectors = response.data.map(d => d.embedding)

  // OpenAI Embedding API 返回整个请求的 usage，需要按文本长度比例分配到各 chunk
  const totalTokens = response.usage?.prompt_tokens ?? 0
  const totalLength = texts.reduce((sum, t) => sum + t.length, 0)

  const usage: TokenUsage[] = texts.map(text => ({
    promptTokens: Math.round((text.length / totalLength) * totalTokens),
    totalTokens: Math.round((text.length / totalLength) * totalTokens),
  }))

  return { vectors, usage }
}
```

**runIndexing 流水线调整**：

```typescript
// packages/rag-sdk/src/pipelines/run-indexing.ts
// Stage 2: embed — 改为调用 embedWithUsage，将 usage 传递到 index stage
const embedResult = await embedder.embedWithUsage(chunks.map(c => c.content))
vectors = embedResult.vectors

// Stage 3: index — 传入 usage
await indexer.index(chunks, vectors, embedResult.usage)
```

### 4.5 Worker 注册

**变更**：`packages/server/src/processors/queue/queue.module.ts`

```typescript
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      providers: [
        QueueService,
        WorkerService,
        // 新增：提供 handler
        {
          provide: 'DOCUMENT_JOB_HANDLER',
          useFactory: (indexingWorker: IndexingWorker) => {
            return async (job: Job<DocumentJobData>) => {
              if (job.data.type === 'index') {
                return indexingWorker.handleIndexJob(job)
              }
              // 保留其他 type 的扩展空间
              throw new Error(`Unknown document job type: ${job.data.type}`)
            }
          },
          inject: [IndexingWorker],
        },
      ],
      exports: [QueueService],
    }
  }
}
```

### 4.6 Document Status 生命周期

| 状态 | 触发条件 | 下一步 |
|------|----------|--------|
| `uploaded` | `DocumentService.upload()` 创建记录 | BullMQ 添加 index job |
| `chunking` | `onStageChange` 收到 `chunk` stage running | 自动推进 |
| `embedding` | `onStageChange` 收到 `embed` stage running | 自动推进 |
| `indexing` | `onStageChange` 收到 `index` stage running | 自动推进 |
| `ready` | `runIndexing` 完成 | 结束 |
| `failed` | `runIndexing` 抛出异常 | 人工处理/重试 |

---

## 5. 依赖变更

### 5.1 package.json

**文件**：`packages/server/package.json`

```json
{
  "dependencies": {
    "@goferbot/rag-sdk": "workspace:*"
  }
}
```

### 5.2 环境变量

| 变量 | 用途 | 默认值 |
|------|------|--------|
| `EMBEDDING_API_KEY` | OpenAI 兼容 Embedding API 密钥 | 必填 |
| `EMBEDDING_BASE_URL` | Embedding API 基础 URL | `https://api.openai.com/v1` |
| `EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-3-small` |
| `EMBEDDING_DIMENSIONS` | 向量维度 | `1536` |

---

## 6. API 变更

### 6.1 ChatDto 扩展

**文件**：`packages/server/src/modules/chat/dto/chat.dto.ts`

ChatDto 为 Zod Schema 推导类型，扩展 `knowledgeBaseIds` 字段：

```typescript
export const ChatSchema = z.object({
  message: z.string().min(1),
  sessionId: z.string().uuid(),
  config: LLMConfigSchema,
  knowledgeBaseIds: z.array(z.string().uuid()).optional(),  // 新增
})

export type ChatDto = z.infer<typeof ChatSchema>
```

### 6.2 响应格式

RAG 集成不改变现有 SSE 响应格式，但需在消息持久化时记录检索上下文（可选 Phase 2）：

```typescript
// 可选：在 Message 表扩展 metadata JSONB 字段存储检索信息
interface MessageMetadata {
  rag?: {
    query: string
    chunkCount: number
    sources: Array<{ documentId: string; chunkIndex: number }>
  }
}
```

---

## 7. 错误处理

| 场景 | 行为 | 用户感知 |
|------|------|----------|
| Embedding API 失败 | Worker 重试 3 次后标记 document status='failed' | 文档状态显示"索引失败" |
| pgvector 扩展未安装 | 启动时 `ensureCollection()` 自动创建扩展，失败则日志警告 | 向量检索不可用，关键词检索仍可用 |
| 关键词检索失败（zhparser 未安装） | 降级为 `to_tsvector('simple')`，日志警告 | 检索质量下降，功能可用 |
| 检索无结果 | ChatService 正常调用 LLM（无 system context） | 对话继续，回答基于模型知识 |
| LLM 超时 | 现有逻辑：抛出 `LLM_TIMEOUT` | SSE 中断，前端显示超时提示 |

---

## 8. 测试策略

### 8.1 单元测试

按项目规范，测试放在 `tests/issues/{issue-dir}/` 下：

| 测试对象 | 路径 | 覆盖点 |
|----------|------|--------|
| `KeywordService.search` | `tests/issues/{dir}/keyword-service.spec.ts` | FTS 查询构造、kbIds 过滤、空结果 |
| `PrismaVectorIndexer.index` | `tests/issues/{dir}/prisma-vector-indexer.spec.ts` | chunk 保存、向量插入（单事务） |
| `IndexingWorker.handleIndexJob` | `tests/issues/{dir}/indexing-worker.spec.ts` | 状态流转、异常处理、重试 |
| `DocumentParser.parse` | `tests/issues/{dir}/document-parser.spec.ts` | 文本/Markdown/PDF 解析、未知类型降级 |
| `OpenAIEmbedder.embedWithUsage` | `tests/issues/{dir}/openai-embedder-usage.spec.ts` | usage 解析、比例分配、总量校验 |

### 8.2 集成测试

| 测试对象 | 路径 | 覆盖点 |
|----------|------|--------|
| Chat RAG 全流程 | `tests/integration/chat-rag.spec.ts` | 上传 → 索引 → 对话检索 → SSE 响应 |
| 索引流水线 | `tests/integration/indexing-pipeline.spec.ts` | upload → worker → ready status |

### 8.3 验收标准

- [ ] `pnpm type-check` 0 错误
- [ ] `pnpm test` 全部通过
- [ ] 文档上传后 30 秒内状态变为 `ready`（测试环境）
- [ ] 对话时传入 `knowledgeBaseIds`，回答包含检索上下文
- [ ] 不传入 `knowledgeBaseIds`，对话行为与现有完全一致

---

## 9. 实施顺序

按依赖关系排序：

1. **SDK 侧：扩展 `IEmbedder` 接口** → 添加 `embedWithUsage()` + `TokenUsage` 类型
2. **SDK 侧：更新 `OpenAIEmbedder`** → 实现 `embedWithUsage()`，解析 API usage 并按比例分配
3. **SDK 侧：更新 `runIndexing`** → embed stage 调用 `embedWithUsage()`，将 usage 传入 indexer
4. **添加 `@goferbot/rag-sdk` 依赖** → `packages/server/package.json`
5. **VectorService 适配 SDK 接口** → 删除 server 自有 `IVectorStore`，直接 import SDK 接口
6. **实现 `KeywordService`** → PostgreSQL FTS 实现 `IKeywordStore`
7. **实现 `PrismaVectorIndexer`** → 接收 usage 参数，优先使用精确 tokenCount，单事务写入 PostgreSQL
8. **实现 `DocumentParser`** → 文本/Markdown 解析，PDF 占位
9. **实现 `IndexingWorker`** → 使用 `runIndexing` 流水线
10. **修改 `DocumentService.upload()`** → 上传后触发索引任务
11. **修改 `ChatService.streamChat()`** → 接入检索上下文注入
12. **简化 `DocumentService.remove()`** → 移除 `vectorService.deleteByFileId()` 调用，依赖 `ON DELETE CASCADE`
13. **注册 Worker handler** → `QueueModule.forRoot()` 绑定 `IndexingWorker`
14. **集成测试** → 验证端到端流水线

---

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| zhparser 未安装导致中文 FTS 失效 | 关键词检索质量差 | 降级为 `simple` 配置，文档说明安装步骤 |
| Embedding API 密钥未配置 | 索引任务全部失败 | 启动时检查环境变量，缺失则日志警告并禁用索引队列 |
| 流式生成与 SDK 非流式接口冲突 | 破坏现有 SSE 体验 | **已决策**：ChatService 不走 `runRetrievalPipeline`，仅使用 retrieve + postprocess |
| 向量维度与 Embedding 模型不匹配 | 向量插入失败 | `VectorService.ensureCollection()` 启动时校验维度；pgvector 下维度由 `vectors[i]::vector` 隐式校验，不匹配时报错 |
| 非归一化 Embedding 模型 | `1 - L2_distance` 不等价于 cosine similarity，分数偏差 | 当前使用 OpenAI text-embedding-3（已归一化）；未来切换模型时需评估是否改用 `<=>` 余弦操作符 |
| 大文件索引阻塞 Worker | 队列积压 | 单文件 chunk 数上限（如 1000），超限则拒绝并标记 failed |
| Token 计数与模型实际不一致 | postprocessor 预算过滤偏差 | `IEmbedder.embedWithUsage()` 优先使用 API 返回的 usage，估算仅作为降级 |
