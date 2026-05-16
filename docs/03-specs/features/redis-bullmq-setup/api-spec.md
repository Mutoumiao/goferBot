# API Spec: Redis + BullMQ Setup

> 本任务为基础设施层，主要暴露内部 TypeScript 接口供业务模块调用。同时定义两个 HTTP API 端点用于任务状态与队列监控查询。

## 1. 内部接口

### 1.1 文件路径

```
packages/server/src/queue/redis.ts
packages/server/src/queue/queues.ts
packages/server/src/queue/workers.ts
packages/server/src/queue/jobs.ts
```

### 1.2 Redis 连接实例

**导出**：

```typescript
// packages/server/src/queue/redis.ts
import { Redis } from 'ioredis';

export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null, // BullMQ 要求
});
```

**行为**：
- 导出单一 `Redis` 实例供 BullMQ 和业务层复用。
- `maxRetriesPerRequest` 必须设为 `null`，否则 BullMQ 会抛出兼容性错误。

---

### 1.3 Queue 定义

**导出**：

```typescript
// packages/server/src/queue/queues.ts
import { Queue } from 'bullmq';
import { redis } from './redis';

export interface DocumentJobData {
  documentId: string;
  type: 'parse' | 'reindex';
}

export interface EmbeddingJobData {
  chunkIds: string[];
  kbId: string;
}

export const documentQueue = new Queue<DocumentJobData>('document-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // 保留最近 100 条完成记录
    removeOnFail: 50,      // 保留最近 50 条失败记录
  },
});

export const embeddingQueue = new Queue<EmbeddingJobData>('embedding-generation', {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

export type QueueName = 'document-processing' | 'embedding-generation';
```

**约束**：
- `removeOnComplete` / `removeOnFail` 防止 Redis 内存无限增长。
- 所有 Queue 共享同一 `redis` 连接实例。

---

### 1.4 Worker 注册框架

**导出**：

```typescript
// packages/server/src/queue/workers.ts
import { Worker, Job } from 'bullmq';
import { redis } from './redis';
import { documentQueue, embeddingQueue, DocumentJobData, EmbeddingJobData } from './queues';

const concurrency = Number(process.env.QUEUE_CONCURRENCY) || 2;

// 占位处理器：document-processing
async function processDocumentJob(job: Job<DocumentJobData>): Promise<void> {
  const { documentId, type } = job.data;

  if (type === 'parse') {
    // Phase 5 前为占位实现
    await job.updateProgress(10);
    // TODO: update documents.status = 'parsing'

    await job.updateProgress(40);
    // TODO: update documents.status = 'chunking'

    await job.updateProgress(70);
    // TODO: update documents.status = 'indexing'

    await job.updateProgress(100);
    // TODO: update documents.status = 'ready'
    return;
  }

  if (type === 'reindex') {
    // 重新索引占位
    await job.updateProgress(100);
    return;
  }

  throw new Error(`Unknown job type: ${type}`);
}

// 占位处理器：embedding-generation
async function processEmbeddingJob(job: Job<EmbeddingJobData>): Promise<void> {
  const { chunkIds, kbId } = job.data;
  // Phase 5 前为占位实现
  await job.updateProgress(100);
}

export const documentWorker = new Worker<DocumentJobData>(
  'document-processing',
  processDocumentJob,
  { connection: redis, concurrency }
);

export const embeddingWorker = new Worker<EmbeddingJobData>(
  'embedding-generation',
  processEmbeddingJob,
  { connection: redis, concurrency }
);

// 优雅关闭
function gracefulShutdown(signal: string) {
  console.log(`Received ${signal}, shutting down workers...`);
  Promise.all([
    documentWorker.close(),
    embeddingWorker.close(),
  ]).then(() => {
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

**约束**：
- Worker 必须共享同一 `redis` 连接实例。
- 占位处理器中预留 `TODO` 注释，明确 Phase 5 替换点。
- 进程信号处理确保优雅关闭，避免处理中的 job 被强制中断。

---

### 1.5 任务投递与状态查询辅助函数

**导出**：

```typescript
// packages/server/src/queue/jobs.ts
import { Job } from 'bullmq';
import { documentQueue, embeddingQueue, DocumentJobData, EmbeddingJobData } from './queues';

export async function addDocumentJob(
  documentId: string,
  type: DocumentJobData['type']
): Promise<string> {
  const job = await documentQueue.add('process-document', { documentId, type });
  if (!job.id) {
    throw new Error('Failed to add document job: job.id is undefined');
  }
  return job.id;
}

export async function addEmbeddingJob(
  chunkIds: string[],
  kbId: string
): Promise<string> {
  const job = await embeddingQueue.add('generate-embedding', { chunkIds, kbId });
  if (!job.id) {
    throw new Error('Failed to add embedding job: job.id is undefined');
  }
  return job.id;
}

export interface JobStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
}

export async function getJobStatus(jobId: string): Promise<JobStatus | null> {
  // 优先从 document-processing 查询
  let job = await Job.fromId(documentQueue, jobId);
  let queueName = 'document-processing';

  if (!job) {
    job = await Job.fromId(embeddingQueue, jobId);
    queueName = 'embedding-generation';
  }

  if (!job) return null;

  const state = await job.getState();

  return {
    id: job.id!,
    state: state as JobStatus['state'],
    progress: job.progress as number,
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn ?? undefined,
    processedOn: job.processedOn ?? undefined,
  };
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export async function getQueueStats(): Promise<QueueStats[]> {
  const queues = [
    { name: 'document-processing', queue: documentQueue },
    { name: 'embedding-generation', queue: embeddingQueue },
  ];

  return Promise.all(
    queues.map(async ({ name, queue }) => {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
      ]);

      return { name, waiting, active, completed, failed, delayed };
    })
  );
}
```

---

## 2. HTTP API

### 2.1 获取任务状态

```
GET /api/jobs/:jobId/status
```

**请求参数**：

| 参数 | 类型 | 位置 | 说明 |
|------|------|------|------|
| `jobId` | string | path | BullMQ 分配的 job ID |

**响应**（200 OK）：

```json
{
  "id": "job-id-string",
  "state": "active",
  "progress": 40,
  "attemptsMade": 1,
  "failedReason": null,
  "finishedOn": null,
  "processedOn": 1715904000000
}
```

**响应**（404 Not Found）：

```json
{
  "error": "Job not found"
}
```

**错误码**：

| 状态码 | 场景 |
|--------|------|
| 200 | 查询成功 |
| 404 | jobId 不存在 |
| 500 | 内部错误（Redis 不可达等） |

---

### 2.2 获取队列统计

```
GET /api/jobs/stats
```

**响应**（200 OK）：

```json
{
  "queues": [
    {
      "name": "document-processing",
      "waiting": 3,
      "active": 1,
      "completed": 42,
      "failed": 2,
      "delayed": 0
    },
    {
      "name": "embedding-generation",
      "waiting": 0,
      "active": 0,
      "completed": 10,
      "failed": 0,
      "delayed": 0
    }
  ]
}
```

**错误码**：

| 状态码 | 场景 |
|--------|------|
| 200 | 查询成功 |
| 500 | 内部错误（Redis 不可达等） |

---

## 3. 类型汇总

```typescript
// packages/server/src/queue/types.ts（可选，若需集中管理）
export interface DocumentJobData {
  documentId: string;
  type: 'parse' | 'reindex';
}

export interface EmbeddingJobData {
  chunkIds: string[];
  kbId: string;
}

export interface JobStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress: number;
  attemptsMade: number;
  failedReason?: string;
  finishedOn?: number;
  processedOn?: number;
}

export interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
```

---

## 4. 依赖

- `bullmq` — BullMQ 队列与 Worker。
- `ioredis` — Redis 客户端。
- `packages/server/src/db/index.ts` — Worker 占位实现中更新 `documents` 状态需使用 Drizzle ORM（阻塞依赖：`i-02-drizzle-orm-setup`）。
