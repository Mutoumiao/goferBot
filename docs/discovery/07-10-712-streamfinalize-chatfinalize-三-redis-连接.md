# GoferBot Discovery Report

## 7. 复杂模块

### 7.12 StreamFinalize + ChatFinalize + 三 Redis 连接

**数据来源**：[stream-finalize.service.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/common/services/stream-finalize.service.ts)、[chat-finalize.processor.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/processors/chat/chat-finalize.processor.ts)、[queues.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/queue/queues.ts)、[workers.ts](file:///d:/projects/ai-stared-project/knowledge-base/packages/server/src/queue/workers.ts)

#### StreamFinalize — SSE 流后处理双模式

```
SSE 流结束
  → StreamFinalizeService.schedule(context, steps)
    → tryEnqueue: 尝试入队 chat-finalize
      → 成功: 异步队列消费
      → 失败/队列不可用: 降级为 queueMicrotask
        → RequestContextStorage.run() 恢复上下文
        → 逐个执行 steps (fire-and-forget, 错误不传播)
```

- **双模式互斥**: 入队和微任务是互斥的，不会重复执行
- **上下文恢复**: 入队前捕获 RequestContext，执行时恢复
- **Fire-and-forget**: 每个 step 的异常被 catch 并 log，不传播到主流程

#### ChatFinalizeProcessor — 两步后处理

```
ChatFinalizeProcessor.process(job):
  RequestContextStorage.run(context, async () => {
    Step 1: saveAssistantMessage(sessionId, messageId, fullReply)
      → 失败抛出异常，BullMQ 重试 (attempts=5)
    Step 2: generateTitle(sessionId, input, fullReply, provider)
      → 失败仅 log，不阻塞（标题缺失可接受）
  })
```

**标题生成 Provider 优先级**: config.chat.defaultProvider（如在 enabledProviders 中）→ enabledProviders 降级链 → 无可用 provider 时跳过。

#### BullMQ 3 队列完整拓扑

| 队列 | attempts | backoff | concurrency | removeOnComplete | removeOnFail | Job Data |
|------|----------|---------|-------------|------------------|-------------|----------|
| `document-processing` | 3 | 指数 5s | 2 | 100 | 50 | { documentId, type:'index' } |
| `embedding` | 3 | 指数 5s | 2 | 100 | 50 | { chunkIds[] } |
| `chat-finalize` | 5 | 指数 5s | 1 | 200 | 50 | { sessionId, messageId, userId, fullReply, input, traceId, requestId } |

关键差异:
- chat-finalize 重试次数最高（5次），消息持久化是关键操作
- chat-finalize concurrency=1，避免并发标题生成导致 LLM 调用雪崩
- chat-finalize Job Data 携带 traceId/requestId 用于分布式追踪

#### 三 Redis 独立连接架构（重要修正）

| 连接 | 使用者 | 用途 | 环境变量配置 |
|------|-------|------|------------|
| Queue Redis | BullMQ (queues + workers) | 任务队列 | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| Cache Redis | CacheService | 通用缓存 (TTL=300s) | `CACHE_REDIS_HOST`, `CACHE_REDIS_PORT`, `CACHE_REDIS_PASSWORD` |
| Auth Redis | AuthRedisService | Token 黑名单/用户缓存/权限缓存 | 复用 Queue Redis 配置 |

**设计目的**: 防止队列拥塞影响认证（Auth 独立），防止缓存击穿影响队列（Cache 独立）。
