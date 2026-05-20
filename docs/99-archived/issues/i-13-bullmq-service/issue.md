---
id: i-13-bullmq-service
type: issue
status: closed
track: infra
priority: p0
summary: 将现有 BullMQ 队列封装为 NestJS 模块，支持依赖注入和处理器注册。QueueModule、QueueService、WorkerService 就绪。
blocked_by: [i-08-nestjs-server-setup]
blocks: []
spec: docs/03-specs/i-13-bullmq-service/
plan: docs/04-plans/i-13-bullmq-service/v1.md
tests: docs/08-test-cases/i-13-bullmq-service/
token_estimate: 800
---

状态: completed
分类: enhancement

## 要构建的内容

将现有 BullMQ 队列封装为 NestJS 模块，支持依赖注入。

## 背景

i-05-redis-bullmq-setup 已完成 BullMQ 队列实现，需在 NestJS 中封装为模块，支持依赖注入和处理器注册。

## 验收标准

- [ ] `src/processors/queue/queue.module.ts` — QueueModule（@Global()）
- [ ] `src/processors/queue/queue.service.ts` — QueueService（@Injectable()）
  - `addDocumentJob(documentId, type)` — 添加文档处理任务
  - `addEmbeddingJob(chunkIds)` — 添加向量化任务
  - `getJobStatus(jobId)` — 查询任务状态
  - `getQueueStats()` — 队列统计
- [ ] `src/processors/queue/worker.service.ts` — WorkerService（OnModuleInit/OnModuleDestroy）
  - 启动 Worker 监听
  - 优雅关闭
- [ ] 支持通过 `QueueModule.forRoot()` 注册处理器
- [ ] 配置从 `ConfigService` 读取（REDIS_HOST, REDIS_PORT, QUEUE_CONCURRENCY）
- [ ] 复用现有 `src/queue/` 核心逻辑
- [ ] `pnpm type-check` 通过

## 阻塞于

- i-08-nestjs-server-setup（需要 NestJS 模块结构）

## 范围外

- 具体业务处理器（解析/向量化逻辑由 Phase 5 负责）
- 任务调度策略

## Agent 简报

**分类：** enhancement
**摘要：** BullMQ 队列封装为 NestJS QueueModule/QueueService

**当前行为：**
BullMQ 队列已实现，但为独立模块。

**期望行为：**
BullMQ 队列封装为 NestJS 模块，支持依赖注入和处理器注册。

**关键接口：**
- `QueueService` — 队列服务
- `WorkerService` — Worker 管理

**验收标准：**
- [ ] QueueModule/QueueService
- [ ] WorkerService
- [ ] 处理器注册机制
- [ ] ConfigService 配置
- [ ] type-check 通过

**范围外：**
- 业务处理器
- 调度策略
