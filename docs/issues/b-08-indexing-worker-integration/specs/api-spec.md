---
issue_id: b-08
type: api-spec
status: draft
summary: 定义 IndexingWorker 的接口签名、Document status 状态机、队列 job 契约、错误处理策略及测试映射。
---

# API 规格：索引 Worker 与队列集成

## 接口签名

### IndexingWorker

```typescript
// packages/server/src/processors/queue/indexing.worker.ts
import { Injectable } from '@nestjs/common'
import { Job } from 'bullmq'
import type { PrismaService } from '../../processors/database/prisma.service.js'
import type { VectorService } from '../../processors/vector/vector.service.js'
import type { StorageService } from '../../processors/storage/storage.service.js'
import type { ConfigService } from '@nestjs/config'
import type { DocumentParser } from '../../processors/parser/document.parser.js'
import { runIndexing } from '@goferbot/rag-sdk'

@Injectable()
export class IndexingWorker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaMilvusIndexer,  // 新增：注入 b-11 的 indexer
    private readonly config: ConfigService,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void>
  private async updateStatus(docId: string, status: DocumentStatus, errorMessage?: string): Promise<void>
}
```

**依赖说明**：
- `DocumentParser` 和 `PrismaMilvusIndexer` 由 b-11 提供，通过构造函数注入
- `VectorService` 由 b-10 适配为 SDK `IVectorStore` 后注入
- `IndexingWorker` 负责编排调用 `runIndexing`，将 `PrismaMilvusIndexer` 作为 `indexer` 参数传入

### DocumentJobData（队列 Job 契约）

```typescript
// packages/server/src/queue/queues.ts
export interface DocumentJobData {
  documentId: string
  type: 'index'  // 统一为单一类型，SDK runIndexing 内部处理 chunk/embed/index 三阶段
}
```

**类型变更影响范围**：
- 旧类型 `'parse' | 'chunk' | 'embed'` 已无使用方（原 Worker handler 为占位实现）
- `QueueService.addDocumentJob()` 签名同步变更
- `AppModule` 中 `QueueModule.forRoot()` 调用无需传参（handler 通过 provider 注册）

### QueueModule.forRoot() 绑定

```typescript
// packages/server/src/processors/queue/queue.module.ts
@Global()
export class QueueModule {
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [ConfigModule],
      providers: [
        QueueService,
        WorkerService,
        IndexingWorker,
        DocumentParser,       // 来自 b-11
        PrismaMilvusIndexer,  // 来自 b-11
        {
          provide: 'DOCUMENT_JOB_HANDLER',
          useFactory: (indexingWorker: IndexingWorker) => {
            return async (job: Job<DocumentJobData>) => {
              if (job.data.type === 'index') {
                return indexingWorker.handleIndexJob(job)
              }
              throw new Error(`Unknown document job type: ${job.data.type}`)
            }
          },
          inject: [IndexingWorker],
        },
      ],
      exports: [QueueService, WorkerService],
      global: true,
    }
  }
}
```

### DocumentService.upload() 触发点

```typescript
// packages/server/src/modules/knowledge-base/document.service.ts
async upload(userId: string, kbId: string, payload: UploadFilePayload) {
  await this.ensureOwnership(userId, kbId)
  const storageKey = `${kbId}/${Date.now()}-${payload.filename}`
  await this.storage.uploadFile(payload.buffer, storageKey, payload.mimeType)

  const doc = await this.prisma.document.create({
    data: {
      kbId,
      folderId: payload.folderId,
      name: payload.filename,
      ext: payload.ext,
      mimeType: payload.mimeType,
      size: BigInt(payload.size),
      storageKey,
      status: 'uploaded',
    },
  })

  // 新增：触发索引任务
  await this.queueService.addDocumentJob(doc.id, 'index')

  return { ...doc, size: doc.size !== null ? Number(doc.size) : null }
}
```

### addDocumentJob 签名变更

```typescript
// packages/server/src/processors/queue/queue.service.ts
async addDocumentJob(documentId: string, type: 'index'): Promise<Job<DocumentJobData>>
```

---

## 状态机

### Document Status 生命周期

| 状态 | 触发条件 | 下一步 | 数据库字段 |
|------|----------|--------|-----------|
| `uploaded` | `DocumentService.upload()` 创建记录 | BullMQ 添加 index job | `status='uploaded'` |
| `chunking` | `onStageChange` 收到 `chunk` stage `running` | 自动推进 | `status='chunking'` |
| `embedding` | `onStageChange` 收到 `embed` stage `running` | 自动推进 | `status='embedding'` |
| `indexing` | `onStageChange` 收到 `index` stage `running` | 自动推进 | `status='indexing'` |
| `ready` | `runIndexing` 完成且无异常 | 结束 | `status='ready'` |
| `failed` | `runIndexing` 抛出异常，或 BullMQ 重试耗尽 | 人工处理/后续重试 | `status='failed'`, `errorMessage` 写入异常信息 |

### SDK Stage 到 Server Status 映射

| SDK stage name | Server status | 映射方向 |
|----------------|---------------|----------|
| `chunk` | `chunking` | SDK → Server |
| `embed` | `embedding` | SDK → Server |
| `index` | `indexing` | SDK → Server |

### 状态流转图

```
                    +-----------+
                    |  uploaded |
                    +-----+-----+
                          |
                          v
                    +-----------+
         +--------->|  chunking |<----------+
         |          +-----+-----+           |
         |                |                 |
         |                v                 |
         |          +-----------+           |
         |          | embedding |           |
         |          +-----+-----+           |
         |                |                 |
         |                v                 |
         |          +-----------+           |
         |          |  indexing |           |
         |          +-----+-----+           |
         |                |                 |
         |                v                 |
         |          +-----------+           |
         +--------->|   ready   |           |
         |          +-----------+           |
         |                                  |
         |          +-----------+           |
         +--------->|  failed   |<----------+
                    +-----------+
```

**说明**：
- 正常路径：uploaded → chunking → embedding → indexing → ready
- 失败路径：任一 stage 抛出异常 → failed
- BullMQ 重试：异常时 BullMQ 自动重试（exponential backoff，最多 3 次），重试期间 status 保持当前值，不额外标记
- 重试耗尽：BullMQ 将 job 移入 failed 集合，Worker 的 `failed` 事件监听器将 document status 更新为 `failed`

---

## 错误处理

### 错误分类与响应策略

| 场景 | 触发点 | Worker 行为 | Document 状态 | 用户感知 |
|------|--------|-------------|---------------|----------|
| 文档记录不存在 | `handleIndexJob` 开头查询 | 立即抛出，BullMQ 重试 | 保持原状态 | 无（记录被删除属异常） |
| MinIO 下载失败 | `storage.downloadFile()` | 抛出，BullMQ 重试 3 次 | 重试中保持原状态，耗尽后 `failed` | 文档列表显示"索引失败" |
| 解析失败（不支持的格式） | `parser.parse()` | 抛出，BullMQ 重试 3 次 | 同上 | 同上 |
| Embedding API 失败 | `embedder.embed()` | 抛出，BullMQ 重试 3 次 | 同上 | 同上 |
| Milvus 插入失败 | `indexer.index()` | 抛出，BullMQ 重试 3 次 | 同上 | 同上 |
| 重试 3 次后仍失败 | BullMQ `failed` 事件 | 不再重试 | `status='failed'`, `errorMessage=最后一次异常消息` | 同上 |

### 错误记录格式

```typescript
// 重试耗尽后，通过 failed 事件更新
await this.prisma.document.update({
  where: { id: documentId },
  data: {
    status: 'failed',
    errorMessage: err.message.slice(0, 500), // 防御性限制：避免异常堆栈过长导致数据库存储开销
  },
})
```

### Worker 事件监听

```typescript
// packages/server/src/processors/queue/worker.service.ts
@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService, // b-08 新增：用于同步 failed 状态
    @Optional() @Inject('DOCUMENT_JOB_HANDLER') private readonly documentHandler?: DocumentJobHandler,
    @Optional() @Inject('EMBEDDING_JOB_HANDLER') private readonly embeddingHandler?: EmbeddingJobHandler,
  ) {}

  // ...

  startWorkers(redis: Redis): void {
    // ...
    if (this.documentHandler) {
      this.documentWorker = createDocumentWorker(redis, this.documentHandler, concurrency)
      this.documentWorker.on('completed', (job) => {
        this.logger.log(`Document job ${job.id} completed`)
      })
      this.documentWorker.on('failed', async (job, err) => {
        this.logger.error(`Document job ${job?.id} failed: ${err.message}`)
        // b-08 新增：重试耗尽后将最终失败状态同步到 Document 表
        if (job?.data?.documentId) {
          await this.prisma.document.update({
            where: { id: job.data.documentId },
            data: {
              status: 'failed',
              errorMessage: err.message.slice(0, 500),
            },
          }).catch((e) => {
            this.logger.error(`Failed to update document status: ${e.message}`)
          })
        }
      })
      this.logger.log('Document worker started')
    }
    // ...
  }
}
```

**说明**：
- `failed` 事件在 BullMQ 重试耗尽后触发，此时 job 不再重试
- `PrismaService` 注入 `WorkerService`，用于将最终失败状态写入 Document 表
- 更新操作包裹 `try/catch`，防止状态同步失败导致 Worker 进程异常

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| `upload()` 成功后触发 index job | `tests/issues/b-08-indexing-worker-integration/document.service.spec.ts` | `AC-01: upload creates document and adds index job to queue` |
| `handleIndexJob` 正常完成，status 变为 ready | `tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts` | `AC-02: handleIndexJob drives full pipeline and sets status to ready` |
| `onStageChange` 正确映射 chunk/embedding/indexing | `tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts` | `AC-03: stage changes map to correct document statuses` |
| 文档不存在时抛出错误 | `tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts` | `AC-04: handleIndexJob throws when document not found` |
| `runIndexing` 异常导致 failed 状态 | `tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts` | `AC-05: runIndexing failure sets status to failed after retries exhausted` |
| BullMQ job type 为 `'index'` | `tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts` | `AC-06: addDocumentJob creates job with type index` |
| 未知 job type 抛出错误 | `tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts` | `AC-07: unknown job type throws error` |
| `QueueModule.forRoot()` 正确注册 handler | `tests/issues/b-08-indexing-worker-integration/queue.module.spec.ts` | `AC-08: QueueModule registers DOCUMENT_JOB_HANDLER bound to IndexingWorker` |
| Redis 不可用时 `upload()` 不阻塞 | `tests/issues/b-08-indexing-worker-integration/document.service.spec.ts` | `AC-09: upload succeeds even when queue is disabled` |

---

## 环境变量

| 变量 | 用途 | 默认值 | 必填 |
|------|------|--------|------|
| `EMBEDDING_API_KEY` | OpenAI 兼容 Embedding API 密钥 | — | 是 |
| `EMBEDDING_BASE_URL` | Embedding API 基础 URL | `https://api.openai.com/v1` | 否 |
| `EMBEDDING_MODEL` | Embedding 模型 | `text-embedding-3-small` | 否 |
| `EMBEDDING_DIMENSIONS` | 向量维度 | `1536` | 否 |
| `QUEUE_CONCURRENCY` | Worker 并发数 | `2` | 否 |

---

## 依赖声明

### package.json

```json
{
  "dependencies": {
    "@goferbot/rag-sdk": "workspace:*"
  }
}
```

### 模块导入关系

```
QueueModule
  ├── QueueService
  ├── WorkerService
  └── IndexingWorker
        ├── PrismaService
        ├── VectorService        (b-10 适配后)
        ├── StorageService
        ├── ConfigService
        ├── DocumentParser       (b-11)
        ├── PrismaMilvusIndexer  (b-11)
        ├── OpenAIEmbedder       (SDK，通过 ConfigService 创建)
        └── RecursiveCharacterChunker  (SDK，直接 new)

KnowledgeBaseModule
  ├── DocumentService
  │     └── QueueService (注入后调用 addDocumentJob)
  └── ...
```
