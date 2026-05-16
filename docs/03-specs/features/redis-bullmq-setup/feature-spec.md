# Feature Spec: Redis + BullMQ Setup

## 1. 功能概述

为 GoferBot Server 配置 Redis 连接与 BullMQ 队列系统，建立异步任务处理框架，支撑后续 RAG 文档解析与向量化流水线的异步执行。

## 2. 用户故事

作为系统，我需要异步处理耗时任务（文件解析、向量化），以免阻塞用户请求，提升上传和问答的响应体验。

## 3. 范围

### 3.1 范围内

- Redis 客户端（`ioredis`）安装、连接配置与实例导出。
- BullMQ `Queue` 初始化与命名规范：
  - `document-processing` — 文档解析流水线任务
  - `embedding-generation` — 向量化任务
- BullMQ `Worker` 框架与注册机制（占位处理器）。
- 任务数据类型安全（TypeScript 泛型）。
- 任务投递接口：`addDocumentJob(documentId, type)`。
- 任务状态查询接口：`getJobStatus(jobId)`。
- 失败重试策略（默认 3 次，指数退避）。
- 启动时 Redis 连通性检查，失败时给出明确错误。

### 3.2 范围外

- 具体的解析 / 分块 / 向量化业务逻辑（Phase 5 RAG 流水线负责）。
- 任务调度策略（如定时任务、优先级队列高级配置）。
- 死信队列（DLQ）高级配置与人工干预界面。
- 任务调度 UI（前端进度展示由对应业务模块负责）。

## 4. 涉及组件

| 组件 | 技术 | 职责 |
|------|------|------|
| Redis 客户端 | `ioredis` | 连接 Redis，供 BullMQ 使用 |
| BullMQ Queue | `bullmq` | 任务入队、状态管理、重试配置 |
| BullMQ Worker | `bullmq` | 任务消费、占位处理、进度更新 |
| 任务处理器框架 | TypeScript | 注册处理器、类型安全包装 |

## 5. 与后续 Phase 5 的关系

RAG 流水线（解析 → 分块 → 向量化 → Milvus 写入）将使用本框架提供的 `document-processing` 队列进行文档处理。Worker 占位实现中已预留 `parse → chunk → embed` 三阶段状态更新接口，Phase 5 仅需替换具体处理逻辑即可。

## 6. 文件结构

```
packages/server/
├── src/
│   └── queue/
│       ├── redis.ts       # ioredis 连接实例
│       ├── queues.ts      # Queue 定义与类型
│       ├── workers.ts     # Worker 注册框架 + 占位处理器
│       └── jobs.ts        # 任务投递与状态查询辅助函数
```

## 7. 关键设计决策

### 7.1 使用 `ioredis` 而非 Node.js Redis

BullMQ 官方推荐 `ioredis`，支持集群与 Sentinel 模式，且与 BullMQ 的 `RedisConnection` 兼容最好。

### 7.2 队列命名规范

- `document-processing`：文档解析流水线（parse → chunk → embed）。
- `embedding-generation`：独立的向量化任务（如批量重索引）。

### 7.3 Worker 并发可配置

通过环境变量 `QUEUE_CONCURRENCY` 控制，默认 `2`。MVP 阶段单实例运行，后续可水平扩展 Worker 进程。

### 7.4 重试策略

默认配置：
- `attempts: 3`
- `backoff: { type: 'exponential', delay: 2000 }`

单次任务最大重试 3 次，初始延迟 2 秒，指数退避。

### 7.5 类型安全

所有 Job 数据通过 TypeScript 泛型约束，避免运行时类型错误。定义 `QueueName → JobData` 的映射类型供调用方使用。

## 8. 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `REDIS_HOST` | Redis 服务器地址 | `localhost` |
| `REDIS_PORT` | Redis 端口 | `6379` |
| `QUEUE_CONCURRENCY` | Worker 并发数 | `2` |

## 9. 验收标准

- [ ] `packages/server/src/queue/redis.ts` 导出可复用的 Redis 连接实例。
- [ ] `packages/server/src/queue/queues.ts` 定义 `document-processing` 和 `embedding-generation` 队列。
- [ ] `packages/server/src/queue/workers.ts` 提供 Worker 注册框架，含占位处理器（parse → chunk → embed 仅更新 status）。
- [ ] `packages/server/src/queue/jobs.ts` 提供 `addDocumentJob(documentId, type)` 与 `getJobStatus(jobId)`。
- [ ] 配置从环境变量读取（`REDIS_HOST`、`REDIS_PORT`、`QUEUE_CONCURRENCY`）。
- [ ] 启动时检查 Redis 连接，失败时抛出明确错误并终止启动。
- [ ] 队列配置合理的重试策略（失败重试 3 次，指数退避）。
