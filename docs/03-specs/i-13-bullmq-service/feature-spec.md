---
issue_id: i-13-bullmq-service
type: feature-spec
status: approved
summary: 将 BullMQ 队列封装为 NestJS @Global QueueModule，提供 QueueService（任务投递与状态查询）和 WorkerService（OnModuleInit/OnModuleDestroy 生命周期管理），通过 ConfigService 读取 Redis 配置。
---
# Feature Spec: BullMQ NestJS 封装服务

## 1. 功能概述

将现有独立 BullMQ 队列实现（`src/queue/`）封装为 NestJS 模块，支持依赖注入、处理器注册和生命周期管理。该模块为全局模块，供所有业务模块注入使用。

## 2. 用户故事

- 作为后端开发者，我希望通过 NestJS 依赖注入使用 BullMQ 队列服务，以便在 Controller/Service 中直接调用 `QueueService` 投递任务，无需手动 import 底层文件。
- 作为后端开发者，我希望 Worker 的生命周期由 NestJS 管理（`OnModuleInit` / `OnModuleDestroy`），以便在应用启动/关闭时自动完成初始化和优雅关闭。
- 作为后端开发者，我希望通过 `QueueModule.forRoot()` 注册自定义任务处理器，以便 Phase 5 RAG 流水线替换占位实现。
- 作为系统，我希望队列配置从 `ConfigService` 统一读取，以便集中管理环境变量。

## 3. 范围

### 3.1 范围内

- `QueueModule`（`@Global()`）— 全局模块，注册 `QueueService` 和 `WorkerService`。
- `QueueService`（`@Injectable()`）— 封装任务投递与状态查询：
  - `addDocumentJob(documentId, type)`
  - `addEmbeddingJob(chunkIds, kbId)`
  - `getJobStatus(jobId)`
  - `getQueueStats()`
- `WorkerService`（`OnModuleInit` / `OnModuleDestroy`）— 管理 Worker 启动与优雅关闭。
- 处理器注册机制 — 通过 `QueueModule.forRoot(processors)` 传入自定义处理器映射。
- 配置读取 — 从 `ConfigService` 读取 `REDIS_HOST`、`REDIS_PORT`、`QUEUE_CONCURRENCY`。
- 复用现有 `src/queue/` 核心逻辑（`redis.ts`、`queues.ts`、`jobs.ts` 中的类型与辅助函数）。
- `pnpm type-check` 通过。

### 3.2 范围外

- 具体业务处理器（解析 / 分块 / 向量化逻辑由 Phase 5 RAG 流水线负责）。
- 任务调度策略（定时任务、优先级队列高级配置）。
- 死信队列（DLQ）高级配置与人工干预界面。
- 前端任务进度 UI（由对应业务模块负责）。
- HTTP API 端点（任务状态/队列统计的 HTTP 接口由后续业务模块按需暴露）。

## 4. 涉及模块/文件

| 文件路径 | 说明 |
|---------|------|
| `packages/server/src/processors/queue/queue.module.ts` | `QueueModule`，`@Global()`，提供 `forRoot()` 静态方法 |
| `packages/server/src/processors/queue/queue.service.ts` | `QueueService`，封装任务投递与查询 |
| `packages/server/src/processors/queue/worker.service.ts` | `WorkerService`，管理 Worker 生命周期 |
| `packages/server/src/processors/queue/queue.types.ts` | 类型定义（复用并扩展 `src/queue/` 类型） |
| `packages/server/src/queue/redis.ts` | 现有 Redis 连接实例（复用） |
| `packages/server/src/queue/queues.ts` | 现有 Queue 定义（复用） |
| `packages/server/src/queue/jobs.ts` | 现有辅助函数（复用） |
| `packages/server/src/app.module.ts` | 根模块中导入 `QueueModule.forRoot()` |

## 5. 相关功能

- 上游：
  - `i-05-redis-bullmq-setup` — 提供底层 `src/queue/` 实现。
  - `i-08-nestjs-server-setup` — 提供 NestJS 模块结构、`ConfigModule`、全局异常处理。
- 下游：
  - Phase 5 RAG 流水线 — 通过 `QueueModule.forRoot()` 注册真实业务处理器。
  - 文档上传模块 — 注入 `QueueService` 投递 `document-processing` 任务。

## 6. 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| `QueueModule` 标记为 `@Global()` | 队列服务被多个业务模块共用，全局注册避免每个模块重复 import | 是（可改为局部模块） |
| 处理器通过 `forRoot(processors)` 注册 | NestJS 模块标准模式，支持依赖注入替换占位处理器 | 否（模块契约） |
| `WorkerService` 实现 `OnModuleInit` / `OnModuleDestroy` | 利用 NestJS 生命周期钩子管理 Worker 启动和优雅关闭，替代进程信号处理 | 否 |
| 复用现有 `src/queue/` 核心逻辑 | 避免重复实现；底层 Queue/Redis 实例不变，仅增加 NestJS 包装层 | 是（可内聚到模块内） |
| 配置从 `ConfigService` 读取 | 与 NestJS 配置体系一致，支持 `.env` / 配置对象多来源 | 否 |
| 保留 `src/queue/` 目录不变 | 底层逻辑独立存在，NestJS 封装层仅做依赖注入适配，降低耦合 | 是 |
