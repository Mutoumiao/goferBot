---
issue_id: i-13-bullmq-service
type: api-spec
status: approved
summary: 内部 NestJS 服务接口（无 HTTP API）：QueueService 方法签名（addDocumentJob/addEmbeddingJob/getJobStatus/getQueueStats），QueueModule.forRoot() 动态模块契约，DocumentJobData/EmbeddingJobData 类型定义。
---
# API Spec: BullMQ NestJS 封装服务

> 本任务为基础设施层，主要暴露内部 NestJS 服务接口供业务模块注入调用。不直接提供 HTTP API 端点。

## 1. 内部接口

### 1.1 文件路径

```
packages/server/src/processors/queue/queue.module.ts
packages/server/src/processors/queue/queue.service.ts
packages/server/src/processors/queue/worker.service.ts
packages/server/src/processors/queue/queue.types.ts
```

---

### 1.2 类型定义

**文件**：`packages/server/src/processors/queue/queue.types.ts`

```typescript
import { Job } from 'bullmq'

// 复用并扩展 src/queue/queues.ts 中的类型
export interface DocumentJobData {
  documentId: string
  type: 'parse' | 'reindex'
}

export interface EmbeddingJobData {
  chunkIds: string[]
  kbId: string
}

export interface JobStatus {
  id: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown'
  progress: number
  attemptsMade: number
  failedReason?: string
  finishedOn?: number
  processedOn?: number
}

export interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

// 处理器类型定义
export type DocumentProcessor = (job: Job<DocumentJobData>) => Promise<void>
export type EmbeddingProcessor = (job: Job<EmbeddingJobData>) => Promise<void>

export interface QueueProcessors {
  documentProcessor?: DocumentProcessor
  embeddingProcessor?: EmbeddingProcessor
}
```

**约束**：
- 类型与 `src/queue/queues.ts`、`src/queue/jobs.ts` 保持一致，避免重复定义导致类型分裂。
- `QueueProcessors` 为可选映射，未提供时使用默认占位处理器。

---

### 1.3 QueueModule

**文件**：`packages/server/src/processors/queue/queue.module.ts`

```typescript
import { Global, Module, DynamicModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { QueueService } from './queue.service'
import { WorkerService } from './worker.service'
import { QueueProcessors } from './queue.types'

@Global()
@Module({})
export class QueueModule {
  static forRoot(processors?: QueueProcessors): DynamicModule {
    return {
      module: QueueModule,
      imports: [ConfigModule],
      providers: [
        QueueService,
        {
          provide: 'QUEUE_PROCESSORS',
          useValue: processors ?? {},
        },
        WorkerService,
      ],
      exports: [QueueService],
    }
  }
}
```

**行为**：
- `@Global()` 标记使 `QueueService` 可在任意模块中直接注入，无需显式导入 `QueueModule`。
- `forRoot()` 为静态工厂方法，返回 `DynamicModule`。
- `processors` 参数可选，未传入时 `WorkerService` 使用默认占位处理器。
- `imports: [ConfigModule]` 确保 `ConfigService` 在模块内可用。
- `exports: [QueueService]` 仅导出 `QueueService`；`WorkerService` 为内部生命周期管理，不对外暴露。

**注册示例**（`AppModule`）：

```typescript
import { Module } from '@nestjs/common'
import { QueueModule } from './processors/queue/queue.module'

@Module({
  imports: [
    QueueModule.forRoot(),
    // 后续 Phase 5 替换为：
    // QueueModule.forRoot({
    //   documentProcessor: myDocumentProcessor,
    //   embeddingProcessor: myEmbeddingProcessor,
    // }),
  ],
})
export class AppModule {}
```

---

### 1.4 QueueService

**文件**：`packages/server/src/processors/queue/queue.service.ts`

```typescript
import { Injectable } from '@nestjs/common'
import { addDocumentJob, addEmbeddingJob, getJobStatus, getQueueStats } from '../../queue/jobs.js'
import { DocumentJobData, EmbeddingJobData, JobStatus, QueueStats } from './queue.types'

@Injectable()
export class QueueService {
  /**
   * 添加文档处理任务
   * @param documentId 文档 ID
   * @param type 任务类型：parse（首次解析）或 reindex（重新索引）
   * @returns jobId 任务 ID
   */
  async addDocumentJob(documentId: string, type: DocumentJobData['type']): Promise<string> {
    return addDocumentJob(documentId, type)
  }

  /**
   * 添加向量化任务
   * @param chunkIds 分块 ID 列表
   * @param kbId 知识库 ID
   * @returns jobId 任务 ID
   */
  async addEmbeddingJob(chunkIds: string[], kbId: string): Promise<string> {
    return addEmbeddingJob(chunkIds, kbId)
  }

  /**
   * 查询任务状态
   * @param jobId 任务 ID
   * @returns 任务状态，若不存在返回 null
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    return getJobStatus(jobId)
  }

  /**
   * 获取队列统计
   * @returns 所有队列的统计信息
   */
  async getQueueStats(): Promise<QueueStats[]> {
    return getQueueStats()
  }
}
```

**约束**：
- 所有方法代理到 `src/queue/jobs.ts` 的现有辅助函数，不重复实现队列操作逻辑。
- 方法签名保持与底层函数一致，确保调用方无感知迁移。
- 异常直接透传，由 NestJS 全局异常过滤器统一处理。

---

### 1.5 WorkerService

**文件**：`packages/server/src/processors/queue/worker.service.ts`

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Worker, Job } from 'bullmq'
import { redis } from '../../queue/redis.js'
import { DocumentJobData, EmbeddingJobData, QueueProcessors } from './queue.types'

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private documentWorker?: Worker<DocumentJobData>
  private embeddingWorker?: Worker<EmbeddingJobData>

  constructor(
    private readonly configService: ConfigService,
    @Inject('QUEUE_PROCESSORS')
    private readonly processors: QueueProcessors,
  ) {}

  onModuleInit(): void {
    const concurrency = this.configService.get<number>('QUEUE_CONCURRENCY', 2)

    const documentProcessor = this.processors.documentProcessor ?? this.defaultDocumentProcessor.bind(this)
    const embeddingProcessor = this.processors.embeddingProcessor ?? this.defaultEmbeddingProcessor.bind(this)

    this.documentWorker = new Worker<DocumentJobData>(
      'document-processing',
      documentProcessor,
      { connection: redis, concurrency },
    )

    this.embeddingWorker = new Worker<EmbeddingJobData>(
      'embedding-generation',
      embeddingProcessor,
      { connection: redis, concurrency },
    )
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all([
      this.documentWorker?.close(),
      this.embeddingWorker?.close(),
    ])
  }

  // 默认占位处理器：document-processing
  private async defaultDocumentProcessor(job: Job<DocumentJobData>): Promise<void> {
    const { documentId, type } = job.data

    if (type === 'parse') {
      await job.updateProgress(10)
      // Phase 5: update documents.status = 'parsing'
      await new Promise((r) => setTimeout(r, 100))

      await job.updateProgress(40)
      // Phase 5: update documents.status = 'chunking'
      await new Promise((r) => setTimeout(r, 100))

      await job.updateProgress(70)
      // Phase 5: update documents.status = 'indexing'
      await new Promise((r) => setTimeout(r, 100))

      await job.updateProgress(100)
      // Phase 5: update documents.status = 'ready'
      return
    }

    if (type === 'reindex') {
      await job.updateProgress(100)
      return
    }

    throw new Error(`Unknown job type: ${type}`)
  }

  // 默认占位处理器：embedding-generation
  private async defaultEmbeddingProcessor(job: Job<EmbeddingJobData>): Promise<void> {
    const { chunkIds, kbId } = job.data
    // Phase 5 前为占位实现
    await job.updateProgress(100)
  }
}
```

**行为**：
- `onModuleInit`：应用启动时创建 `document-processing` 和 `embedding-generation` 两个 Worker 实例。
  - 并发数从 `ConfigService` 读取 `QUEUE_CONCURRENCY`，默认 `2`。
  - 若 `forRoot()` 传入了自定义处理器，则使用自定义处理器；否则使用默认占位处理器。
- `onModuleDestroy`：应用关闭时调用 `worker.close()` 优雅停止 Worker，等待当前处理中的 job 完成。
- 默认占位处理器与现有 `src/queue/workers.ts` 逻辑一致，保留 Phase 5 替换注释。

**约束**：
- Worker 复用同一 `redis` 连接实例（来自 `src/queue/redis.ts`）。
- 不再监听进程信号（`SIGTERM` / `SIGINT`），优雅关闭完全由 NestJS 生命周期管理。
- 若自定义处理器抛出异常，BullMQ 按队列默认重试策略自动重试。

---

## 2. 配置参数

| 配置项 | 环境变量 | 默认值 | 说明 |
|--------|----------|--------|------|
| Redis 主机 | `REDIS_HOST` | `localhost` | Redis 服务器地址 |
| Redis 端口 | `REDIS_PORT` | `6379` | Redis 端口 |
| Worker 并发数 | `QUEUE_CONCURRENCY` | `2` | 每个 Worker 实例的并发处理数 |

**读取方式**：

```typescript
this.configService.get<string>('REDIS_HOST', 'localhost')
this.configService.get<number>('REDIS_PORT', 6379)
this.configService.get<number>('QUEUE_CONCURRENCY', 2)
```

> 注：`src/queue/redis.ts` 中的 `process.env` 读取在 NestJS 封装层中不再直接使用，但保留作为底层兼容。推荐在 `main.ts` 或 `bootstrap.ts` 中通过 `ConfigModule.forRoot()` 加载 `.env` 文件。

---

## 3. 使用示例

### 3.1 在业务 Service 中注入 QueueService

```typescript
import { Injectable } from '@nestjs/common'
import { QueueService } from '../processors/queue/queue.service'

@Injectable()
export class DocumentService {
  constructor(private readonly queueService: QueueService) {}

  async uploadComplete(documentId: string) {
    const jobId = await this.queueService.addDocumentJob(documentId, 'parse')
    return { jobId }
  }

  async checkJob(jobId: string) {
    return this.queueService.getJobStatus(jobId)
  }
}
```

### 3.2 注册自定义处理器（Phase 5）

```typescript
import { Module } from '@nestjs/common'
import { QueueModule } from './processors/queue/queue.module'
import { RagDocumentProcessor } from './rag/document.processor'
import { RagEmbeddingProcessor } from './rag/embedding.processor'

@Module({
  imports: [
    QueueModule.forRoot({
      documentProcessor: (job) => new RagDocumentProcessor().process(job),
      embeddingProcessor: (job) => new RagEmbeddingProcessor().process(job),
    }),
  ],
})
export class AppModule {}
```

---

## 4. 依赖

- `@nestjs/common` — NestJS 核心模块与装饰器。
- `@nestjs/config` — `ConfigService` 配置读取。
- `bullmq` — BullMQ `Queue`、`Worker`、`Job`。
- `ioredis` — Redis 连接实例。
- `src/queue/redis.ts` — 现有 Redis 连接。
- `src/queue/queues.ts` — 现有 Queue 定义。
- `src/queue/jobs.ts` — 现有任务投递与查询辅助函数。

---

## 5. 类型汇总

```typescript
// packages/server/src/processors/queue/queue.types.ts

export interface DocumentJobData {
  documentId: string
  type: 'parse' | 'reindex'
}

export interface EmbeddingJobData {
  chunkIds: string[]
  kbId: string
}

export interface JobStatus {
  id: string
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown'
  progress: number
  attemptsMade: number
  failedReason?: string
  finishedOn?: number
  processedOn?: number
}

export interface QueueStats {
  name: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

export type DocumentProcessor = (job: Job<DocumentJobData>) => Promise<void>
export type EmbeddingProcessor = (job: Job<EmbeddingJobData>) => Promise<void>

export interface QueueProcessors {
  documentProcessor?: DocumentProcessor
  embeddingProcessor?: EmbeddingProcessor
}
```
