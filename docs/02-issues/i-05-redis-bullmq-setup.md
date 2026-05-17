---
id: i-05-redis-bullmq-setup
type: issue
status: needs-triage
track: infra
priority: p1
summary: 配置 Redis 连接和 BullMQ 队列系统，建立异步任务处理框架。异步任务框架就绪，文档上传后可加入处理队列。
blocked_by: [i-01-docker-compose-infra, i-02-drizzle-orm-setup]
blocks: []
spec: docs/03-specs/i-05-redis-bullmq-setup/
plan: docs/04-plans/i-05-redis-bullmq-setup/v1.md
tests: docs/08-test-cases/i-05-redis-bullmq-setup/
token_estimate: 1100
---

状态: needs-triage
分类: enhancement

## 要构建的内容

配置 Redis 连接和 BullMQ 队列系统，建立异步任务处理框架。

## 规格引用

- 功能规格: docs/03-specs/i-05-redis-bullmq-setup/feature-spec.md
- 行为规格: docs/03-specs/i-05-redis-bullmq-setup/behavior-spec.md
- API 规格: docs/03-specs/i-05-redis-bullmq-setup/api-spec.md

## 验收标准

- [ ] `packages/server/src/queue/redis.ts` 导出 Redis 连接实例
- [ ] `packages/server/src/queue/queues.ts` 定义 `document-processing` 队列
- [ ] `packages/server/src/queue/workers.ts` 提供 Worker 注册框架（占位实现）
- [ ] Worker 占位包含三个阶段：parse → chunk → embed（当前仅更新 status）
- [ ] 提供 `addDocumentJob(documentId, type)` 方法添加任务到队列
- [ ] 提供 `getJobStatus(jobId)` 方法查询任务状态
- [ ] 配置从环境变量读取（redis host、port）
- [ ] 启动时检查 Redis 连接，失败时给出明确错误
- [ ] 队列配置合理的重试策略（失败重试 3 次，间隔指数退避）

## 阻塞于

- i-01-docker-compose-infra（需要 Redis 服务运行）
- i-02-drizzle-orm-setup（Worker 需要更新 document status）

## 范围外

- 完整的文档解析/分块/向量化实现（Phase 5）
- 任务调度 UI
- 死信队列处理策略

## Agent 简报

**分类：** enhancement
**摘要：** 配置 Redis + BullMQ，建立异步任务处理框架

**当前行为：**
项目无队列系统，无异步任务处理能力。

**期望行为：**
异步任务框架就绪，文档上传后可加入处理队列，Worker 占位可更新文档状态。

**关键接口：**
- `packages/server/src/queue/redis.ts` — Redis 连接
- `packages/server/src/queue/queues.ts` — 队列定义
- `packages/server/src/queue/workers.ts` — Worker 框架
- `addDocumentJob(documentId, type)` — 添加任务
- `getJobStatus(jobId)` — 查询任务状态

**验收标准：**
- [ ] 导出 Redis 连接实例
- [ ] 定义 `document-processing` 队列
- [ ] 提供 Worker 注册框架（占位）
- [ ] Worker 占位包含 parse/chunk/embed 三阶段
- [ ] 提供 `addDocumentJob` 方法
- [ ] 提供 `getJobStatus` 方法
- [ ] 配置从环境变量读取
- [ ] 启动时检查 Redis 连接
- [ ] 配置合理的重试策略

**范围外：**
- 完整的解析/分块/向量化实现
- 任务调度 UI
- 死信队列处理
