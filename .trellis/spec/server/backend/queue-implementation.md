# 队列实现指南

> BullMQ 异步任务队列架构与文档索引管线实现细节
>
> **REFERENCE_ONLY**: 此文件记录实现细节（HOW）。功能规范权威源为 [openspec/specs/queue/spec.md](../../../../openspec/specs/queue/spec.md)（WHAT）。三队列架构/重试策略/并发配置应以 OpenSpec 为准。

---

## 三队列架构

```
┌─────────────────────────┐
│      QueueService       │  管理 Redis 连接生命周期
│  - documentQueue        │
│  - embeddingQueue       │
│  - chatFinalizeQueue    │
└────────┬────────────────┘
         │ startWorkers(redis)
         ▼
┌─────────────────────────┐
│      WorkerService      │  创建并管理 workers
│  - documentWorker       │  并发数: QUEUE_CONCURRENCY（默认值 2）
│  - embeddingWorker      │  并发数: QUEUE_CONCURRENCY（默认值 2）
│  - chatFinalizeWorker   │  并发数: 1（固定）
└─────────────────────────┘
```

## 队列定义

```typescript
// queues.ts
DOCUMENT_PROCESSING_QUEUE = 'document-processing'
EMBEDDING_QUEUE = 'embedding'
CHAT_FINALIZE_QUEUE = 'chat-finalize'

interface DocumentJobData { documentId: string; type: 'index' }
interface EmbeddingJobData { chunkIds: string[] }
interface ChatFinalizeJobData {
  sessionId: string; messageId: string; userId?: string
  fullReply: string; input: string; traceId: string; requestId: string
}
```

## 重试配置

| 队列 | 尝试次数 | 退避策略 | 延迟 | 完成后删除 | 失败后删除 |
|-------|----------|---------|-------|------------------|--------------|
| document-processing | 3 | exponential | 5s | 100 | 50 |
| embedding | 3 | exponential | 5s | 100 | 50 |
| chat-finalize | 5 | exponential | 5s | 200 | 50 |

## Redis 生命周期

```
onModuleInit:
  createRedisConnection(host, port, password)
    → redis.ping()
      ├─ success → create 3 queues → workerService.startWorkers(redis)
      └─ fail    → log warning → redis.quit() → redis=undefined (all ops disabled)

onModuleDestroy:
  documentQueue.close() → embeddingQueue.close() → chatFinalizeQueue.close() → redis.quit()
```

Redis 连接要求 `maxRetriesPerRequest: null`（BullMQ 要求）。

## IndexingWorker 管线

```
IndexingWorker.handleIndexJob(job)
  │
  ├─ prisma.document.findUnique({ id: documentId })
  ├─ prisma.knowledgeBase.findUnique({ id: doc.kbId }) → extract ownerUserId
  │
  ├─ storage.downloadFile(doc.storageKey) → Buffer
  │
  ├─ parser.parse({ buffer, mimeType, filename })
  │    → ParseResult { content, title, hierarchyPath, sections, codeBlocks, metadata }
  │
  ├─ prisma.document.update({ status: 'indexing' })  ← H10: single DB write
  │
  ├─ ragService.indexDocument(
  │      docId, kbId, content, chunkSize?, overlap?,
  │      metadata { source_mime, parser_name },
  │      context { documentTitle, sectionPath, userId, allowedUserIds }
  │   )
  │
  ├─ success → prisma.document.update({ status: 'ready' })
  │
  └─ error   → prisma.document.update({ status: 'failed', errorMessage: msg.slice(0,500) })
               → throw err (triggers BullMQ retry)
```

## 错误处理模式

### 失败时更新文档状态
```typescript
// worker.service.ts#L67-L80
this.documentWorker.on('failed', async (job, err) => {
  if (job?.data?.documentId) {
    await this.prisma.document.update({
      where: { id: job.data.documentId },
      data: { status: 'failed', errorMessage: err.message.slice(0, 500) },
    })
  }
})
```

### ZodError 特殊处理
```typescript
// indexing.worker.ts#L77-L86
if (err instanceof ZodError) {
  const details = err.issues.map(i => `${i.path.join('.')}:${i.message}`).join(';')
  // 记录 schema 路径详情用于调试
}
```

## 动态模块：可选的 embeddingHandler

```typescript
// 在 AppModule 中使用
QueueModule.forRoot({
  embeddingHandler: myCustomEmbeddingHandler,  // optional
})
```

如果未提供 `embeddingHandler`，则不会注册 `EMBEDDING_JOB_HANDLER` 提供者，且 `WorkerService` 会跳过创建 embedding worker。

## 上下文嵌入元数据流程

`IndexingWorker` 向 `ragService.indexDocument()` 传递结构化元数据：
- `documentTitle`: 来自 `ParseResult.title`
- `sectionPath`: 来自 `resolveSectionPath()` → 第一个标题或 `hierarchyPath.join(' / ')`
- `userId`: 来自 `knowledgeBase.userId`（用于 ACL）
- `allowedUserIds`: `[ownerUserId]`