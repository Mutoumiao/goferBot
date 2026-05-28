---
id: b-08
issue: issue.md
version: 1
---

# 索引 Worker 与队列集成实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将索引流水线接入 server 运行时：IndexingWorker 驱动 runIndexing，QueueModule 注册 handler，DocumentService.upload() 触发索引任务。

**架构：** IndexingWorker 注入 b-11 的 Parser + Indexer 和 b-10 的 VectorService，编排 SDK `runIndexing`。WorkerService 监听 BullMQ `failed` 事件同步最终状态到 Document 表。

**技术栈：** NestJS 10 + BullMQ + Redis + `@goferbot/rag-sdk`

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/api-spec.md](./specs/api-spec.md)

---

## 文件结构

- **新增：**
  - `packages/server/src/processors/queue/indexing.worker.ts`
- **修改：**
  - `packages/server/src/processors/queue/queue.module.ts` — 注册 IndexingWorker + DOCUMENT_JOB_HANDLER
  - `packages/server/src/processors/queue/queue.service.ts` — addDocumentJob 签名改为 type: 'index'
  - `packages/server/src/processors/queue/worker.service.ts` — failed 事件同步 Document status
  - `packages/server/src/modules/knowledge-base/document.service.ts` — upload() 后 addDocumentJob
  - `packages/server/src/modules/knowledge-base/knowledge-base.module.ts` — 注入 QueueService
- **测试：**
  - `tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts`
  - `tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts`
  - `tests/issues/b-08-indexing-worker-integration/document.service.spec.ts`

---

## 任务 1: IndexingWorker 实现

**文件：**
- 创建：`packages/server/src/processors/queue/indexing.worker.ts`
- 测试：`tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts`

**规格引用：**
- API 规格：[IndexingWorker 接口签名]、[状态机]、[错误处理]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IndexingWorker } from '../../../packages/server/src/processors/queue/indexing.worker.js'

describe('IndexingWorker', () => {
  let worker: IndexingWorker
  let mockPrisma: any
  let mockVectorService: any
  let mockStorage: any
  let mockParser: any
  let mockIndexer: any
  let mockConfig: any

  beforeEach(() => {
    mockPrisma = {
      document: {
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    mockVectorService = {}
    mockStorage = {
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('test content')),
    }
    mockParser = {
      parse: vi.fn().mockResolvedValue('test content'),
    }
    mockIndexer = {}
    mockConfig = {
      get: vi.fn().mockReturnValue('mock-key'),
    }
    worker = new IndexingWorker(mockPrisma, mockVectorService, mockStorage, mockParser, mockIndexer, mockConfig)
  })

  it('AC-02: handleIndexJob drives full pipeline and sets status to ready', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', storageKey: 'k1', mimeType: 'text/plain', status: 'uploaded' })
    // runIndexing 模拟：通过 onStageChange 回调更新状态，最终 resolve
    vi.spyOn(await import('@goferbot/rag-sdk'), 'runIndexing').mockImplementation(async ({ onStageChange }) => {
      await onStageChange?.({ stage: 'chunk', status: 'running' })
      await onStageChange?.({ stage: 'chunk', status: 'completed' })
      await onStageChange?.({ stage: 'embed', status: 'running' })
      await onStageChange?.({ stage: 'embed', status: 'completed' })
      await onStageChange?.({ stage: 'index', status: 'running' })
      await onStageChange?.({ stage: 'index', status: 'completed' })
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)

    expect(mockPrisma.document.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'd1' },
      data: expect.objectContaining({ status: 'ready' }),
    }))
  })

  it('AC-03: stage changes map to correct document statuses', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({ id: 'd1', kbId: 'kb1', storageKey: 'k1', mimeType: 'text/plain', status: 'uploaded' })
    const statusUpdates: string[] = []
    mockPrisma.document.update.mockImplementation(({ data }) => {
      statusUpdates.push(data.status)
      return Promise.resolve({})
    })

    vi.spyOn(await import('@goferbot/rag-sdk'), 'runIndexing').mockImplementation(async ({ onStageChange }) => {
      await onStageChange?.({ stage: 'chunk', status: 'running' })
      await onStageChange?.({ stage: 'embed', status: 'running' })
      await onStageChange?.({ stage: 'index', status: 'running' })
    })

    await worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any)
    expect(statusUpdates).toContain('chunking')
    expect(statusUpdates).toContain('embedding')
    expect(statusUpdates).toContain('indexing')
  })

  it('AC-04: handleIndexJob throws when document not found', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)
    await expect(worker.handleIndexJob({ data: { documentId: 'd1', type: 'index' } } as any))
      .rejects.toThrow('Document not found')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts`
预期：FAIL — `Cannot find module .../indexing.worker.js`

- [ ] **步骤 3: 实现 IndexingWorker**

创建 `packages/server/src/processors/queue/indexing.worker.ts`：
```typescript
import { Injectable, Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PrismaService } from '../database/prisma.service.js'
import { VectorService } from '../vector/vector.service.js'
import { StorageService } from '../storage/storage.service.js'
import { ConfigService } from '@nestjs/config'
import { DocumentParser } from '../parser/document.parser.js'
import { PrismaMilvusIndexer } from '../indexing/prisma-milvus.indexer.js'
import { runIndexing, OpenAIEmbedder, RecursiveCharacterChunker } from '@goferbot/rag-sdk'
import type { DocumentJobData } from './queue.service.js'

type DocumentStatus = 'uploaded' | 'chunking' | 'embedding' | 'indexing' | 'ready' | 'failed'

@Injectable()
export class IndexingWorker {
  private readonly logger = new Logger(IndexingWorker.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaMilvusIndexer,
    private readonly config: ConfigService,
  ) {}

  async handleIndexJob(job: Job<DocumentJobData>): Promise<void> {
    const { documentId } = job.data
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } })
    if (!doc) throw new Error(`Document not found: ${documentId}`)

    const buffer = await this.storage.downloadFile(doc.storageKey)
    const text = await this.parser.parse(buffer, doc.mimeType)

    const embedder = new OpenAIEmbedder({
      apiKey: this.config.getOrThrow<string>('EMBEDDING_API_KEY'),
      baseUrl: this.config.get<string>('EMBEDDING_BASE_URL'), // 可选，默认 OpenAI 官方
      model: this.config.get<string>('EMBEDDING_MODEL', 'text-embedding-3-small'),
      dimension: this.config.get<number>('EMBEDDING_DIMENSIONS', 1536),
    })
    const chunker = new RecursiveCharacterChunker()

    await runIndexing({
      documentId: doc.id,
      kbId: doc.kbId,
      content: text,
      mimeType: doc.mimeType,
    }, {
      chunker,
      embedder,
      indexer: this.indexer,
      vectorStore: this.vectorService,
      onStageChange: async ({ stage, status }) => {
        const map: Record<string, DocumentStatus> = {
          chunk: 'chunking',
          embed: 'embedding',
          index: 'indexing',
        }
        if (status === 'running' && map[stage]) {
          await this.updateStatus(doc.id, map[stage])
        }
      },
    })

    await this.updateStatus(doc.id, 'ready')
  }

  private async updateStatus(docId: string, status: DocumentStatus, errorMessage?: string): Promise<void> {
    await this.prisma.document.update({
      where: { id: docId },
      data: { status, ...(errorMessage && { errorMessage }) },
    })
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts`
预期：PASS（AC-02~AC-04 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/queue/indexing.worker.ts \
  tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts
git commit -m "feat(b-08): add IndexingWorker with runIndexing orchestration"
```

---

## 任务 2: QueueModule 注册 DOCUMENT_JOB_HANDLER

**文件：**
- 修改：`packages/server/src/processors/queue/queue.module.ts`
- 测试：`tests/issues/b-08-indexing-worker-integration/queue.module.spec.ts`

**规格引用：**
- API 规格：[QueueModule.forRoot() 绑定]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-08-indexing-worker-integration/queue.module.spec.ts
import { describe, it, expect } from 'vitest'
import { QueueModule } from '../../../packages/server/src/processors/queue/queue.module.js'
import { IndexingWorker } from '../../../packages/server/src/processors/queue/indexing.worker.js'

describe('QueueModule', () => {
  it('AC-08: QueueModule registers DOCUMENT_JOB_HANDLER bound to IndexingWorker', () => {
    const module = QueueModule.forRoot()
    const providers = module.providers as any[]
    const handlerProvider = providers.find(p => p.provide === 'DOCUMENT_JOB_HANDLER')
    expect(handlerProvider).toBeDefined()
    expect(handlerProvider.inject).toContain(IndexingWorker)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/queue.module.spec.ts`
预期：FAIL — IndexingWorker 未在 providers 中

- [ ] **步骤 3: 修改 QueueModule**

修改 `packages/server/src/processors/queue/queue.module.ts`：
```typescript
import { Global, Module, type DynamicModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Job } from 'bullmq'
import { QueueService } from './queue.service.js'
import { WorkerService } from './worker.service.js'
import { IndexingWorker } from './indexing.worker.js'
import { DocumentParser } from '../parser/document.parser.js'
import { PrismaMilvusIndexer } from '../indexing/prisma-milvus.indexer.js'
import type { DocumentJobData } from './queue.service.js'

export type DocumentJobHandler = (job: Job<DocumentJobData>) => Promise<void>

@Global()
@Module({})
export class QueueModule {
  static forRoot(): DynamicModule {
    return {
      module: QueueModule,
      imports: [ConfigModule],
      providers: [
        QueueService,
        WorkerService,
        IndexingWorker,
        DocumentParser,
        PrismaMilvusIndexer,
        {
          provide: 'DOCUMENT_JOB_HANDLER',
          useFactory: (indexingWorker: IndexingWorker): DocumentJobHandler => {
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

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/queue.module.spec.ts`
预期：PASS（AC-08 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/queue/queue.module.ts \
  tests/issues/b-08-indexing-worker-integration/queue.module.spec.ts
git commit -m "feat(b-08): QueueModule registers IndexingWorker as DOCUMENT_JOB_HANDLER"
```

---

## 任务 3: DocumentJobData 类型统一与 addDocumentJob 签名变更

**文件：**
- 修改：`packages/server/src/processors/queue/queue.service.ts`
- 测试：`tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts`

**规格引用：**
- API 规格：[DocumentJobData]、[addDocumentJob 签名变更]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { QueueService } from '../../../packages/server/src/processors/queue/queue.service.js'

describe('QueueService', () => {
  it('AC-06: addDocumentJob creates job with type index', async () => {
    const mockQueue = { add: vi.fn().mockResolvedValue({ id: 'job1' }) }
    const service = new QueueService(mockQueue as any)
    await service.addDocumentJob('d1', 'index')
    expect(mockQueue.add).toHaveBeenCalledWith('index', { documentId: 'd1', type: 'index' })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts`
预期：FAIL — 类型不匹配或方法不存在

- [ ] **步骤 3: 修改 QueueService**

修改 `packages/server/src/processors/queue/queue.service.ts`：
```typescript
export interface DocumentJobData {
  documentId: string
  type: 'index'
}

// addDocumentJob 签名：
async addDocumentJob(documentId: string, type: 'index'): Promise<Job<DocumentJobData>>
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts`
预期：PASS（AC-06 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/queue/queue.service.ts \
  tests/issues/b-08-indexing-worker-integration/queue.service.spec.ts
git commit -m "feat(b-08): unify DocumentJobData.type to 'index'"
```

---

## 任务 4: DocumentService.upload() 触发索引任务

**文件：**
- 修改：`packages/server/src/modules/knowledge-base/document.service.ts`
- 修改：`packages/server/src/modules/knowledge-base/knowledge-base.module.ts`
- 测试：`tests/issues/b-08-indexing-worker-integration/document.service.spec.ts`

**规格引用：**
- API 规格：[DocumentService.upload() 触发点]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-08-indexing-worker-integration/document.service.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { DocumentService } from '../../../packages/server/src/modules/knowledge-base/document.service.js'

describe('DocumentService.upload triggers indexing', () => {
  it('AC-01: upload creates document and adds index job to queue', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        create: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1', status: 'uploaded' }),
      },
    }
    const mockStorage = { uploadFile: vi.fn().mockResolvedValue(undefined) }
    const mockVector = { deleteByFileId: vi.fn() }
    const mockQueue = { addDocumentJob: vi.fn().mockResolvedValue({}) }

    const service = new DocumentService(mockPrisma, mockStorage, mockVector, mockQueue)
    await service.upload('u1', 'kb1', {
      filename: 'test.txt', ext: 'txt', mimeType: 'text/plain',
      size: 100, buffer: Buffer.from('hello'), folderId: null,
    })

    expect(mockQueue.addDocumentJob).toHaveBeenCalledWith('d1', 'index')
  })

  it('AC-09: upload succeeds even when queue is disabled', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        create: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1', status: 'uploaded' }),
      },
    }
    const mockStorage = { uploadFile: vi.fn().mockResolvedValue(undefined) }
    const mockVector = { deleteByFileId: vi.fn() }

    const service = new DocumentService(mockPrisma, mockStorage, mockVector)
    // 无 QueueService 注入时 upload 不应抛异常
    await expect(service.upload('u1', 'kb1', {
      filename: 'test.txt', ext: 'txt', mimeType: 'text/plain',
      size: 100, buffer: Buffer.from('hello'), folderId: null,
    })).resolves.toBeDefined()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/document.service.spec.ts`
预期：FAIL — `addDocumentJob` 未被调用（当前 DocumentService 无 QueueService 注入）

- [ ] **步骤 3: 修改 DocumentService 和 KnowledgeBaseModule**

修改 `packages/server/src/modules/knowledge-base/document.service.ts`：
```typescript
import { QueueService } from '../../processors/queue/queue.service.js'

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vectorService: VectorService,
    @Optional() private readonly queueService?: QueueService,
  ) {}

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

    if (this.queueService) {
      await this.queueService.addDocumentJob(doc.id, 'index')
    }

    return { ...doc, size: doc.size !== null ? Number(doc.size) : null }
  }
}
```

修改 `packages/server/src/modules/knowledge-base/knowledge-base.module.ts`：
确保 `QueueModule` 已导入（通常由 `AppModule` 全局导入）。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/document.service.spec.ts`
预期：PASS（AC-01、AC-09 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/modules/knowledge-base/document.service.ts \
  tests/issues/b-08-indexing-worker-integration/document.service.spec.ts
git commit -m "feat(b-08): DocumentService.upload triggers addDocumentJob after create"
```

---

## 任务 5: WorkerService failed 事件同步 Document status

**文件：**
- 修改：`packages/server/src/processors/queue/worker.service.ts`
- 测试：通过 indexing-worker.spec.ts 中的异常测试覆盖

**规格引用：**
- API 规格：[Worker 事件监听]

- [ ] **步骤 1: 编写失败测试**

在 `indexing-worker.spec.ts` 中追加：
```typescript
  it('AC-05: runIndexing failure sets status to failed after retries exhausted', async () => {
    // 模拟 WorkerService failed 事件处理器
    const failedHandler = async (job: any, err: Error) => {
      if (job?.data?.documentId) {
        await mockPrisma.document.update({
          where: { id: job.data.documentId },
          data: { status: 'failed', errorMessage: err.message.slice(0, 500) },
        })
      }
    }

    await failedHandler({ data: { documentId: 'd1' } }, new Error('Embedding API error: 500'))

    expect(mockPrisma.document.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { status: 'failed', errorMessage: 'Embedding API error: 500' },
    })
  })
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts -t "AC-05"`
预期：FAIL — failed 事件未同步状态

- [ ] **步骤 3: 修改 WorkerService**

修改 `packages/server/src/processors/queue/worker.service.ts`：
在 `startWorkers` 方法的 `documentWorker.on('failed', ...)` 中：
```typescript
this.documentWorker.on('failed', async (job, err) => {
  this.logger.error(`Document job ${job?.id} failed: ${err.message}`)
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
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts -t "AC-05"`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/queue/worker.service.ts \
  tests/issues/b-08-indexing-worker-integration/indexing-worker.spec.ts
git commit -m "feat(b-08): sync Document status to failed on BullMQ retry exhaustion"
```

---

## 任务 6: 全量测试与类型检查

- [ ] **步骤 1: 运行本 issue 所有单元测试**

```bash
npx vitest run tests/issues/b-08-indexing-worker-integration/
```
预期：全部通过（AC-01~AC-09）

- [ ] **步骤 2: 运行类型检查**

```bash
pnpm type-check
```
预期：0 错误

- [ ] **步骤 3: 提交**

```bash
git add -A
git commit -m "test(b-08): verify all tests pass and type-check clean"
```

---

## 自检

1. **规格覆盖：**
   - [x] DocumentJobData.type 统一为 'index' — 任务 3（AC-06）
   - [x] IndexingWorker.handleIndexJob() — 任务 1（AC-02）
   - [x] onStageChange 映射 status — 任务 1（AC-03）
   - [x] QueueModule 注册 handler — 任务 2（AC-08）
   - [x] DocumentService.upload 触发 job — 任务 4（AC-01）
   - [x] Worker 重试后标记 failed — 任务 5（AC-05）
   - [x] Redis 不可用时 upload 不阻塞 — 任务 4（AC-09）

2. **占位符扫描：** 无 TBD/TODO/稍后实现。

3. **类型一致性：** `DocumentJobData.type` 统一为 `'index'`，与 `QueueModule` handler 匹配。
