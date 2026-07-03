# 队列系统开发指南

> **REFERENCE_ONLY**: 此文件记录开发指南（HOW）。业务规范权威源为 [openspec/specs/queue/spec.md](../../../../openspec/specs/queue/spec.md)（WHAT）。三队列架构 / 重试配置 / IndexingWorker 管线 / Job Data 契约 / Worker 生命周期 应以 OpenSpec 为准。

---

## Purpose

帮助开发者在 BullMQ 队列系统中高效工作。提供 Redis 连接管理、Worker 调优、Job 调试、失败排查的实操路径，避免在开发过程中重复踩坑。架构定义、契约字段、重试参数等业务规范不在本文展开，请直接查阅 OpenSpec。

## Primary OpenSpec

- [openspec/specs/queue/spec.md](../../../../openspec/specs/queue/spec.md) — 队列系统级规范

## Related OpenSpec

- [openspec/specs/document/spec.md](../../../../openspec/specs/document/spec.md) — 文档索引触发
- [openspec/specs/chat/spec.md](../../../../openspec/specs/chat/spec.md) — ChatFinalize 触发

## Module Dependencies

- BullMQ 5.x（队列库）
- Redis 7（队列后端）
- Prisma（Job 数据持久化）

## Development Entry

- `packages/server/src/processors/queue/queue.service.ts` — 队列管理（Redis 生命周期、入队 API）
- `packages/server/src/processors/queue/worker.service.ts` — Worker 管理（创建、并发、失败监听）
- `packages/server/src/processors/queue/indexing.worker.ts` — 索引 Worker（解析、RAG、状态机）
- `packages/server/src/processors/chat/chat-finalize.processor.ts` — Chat Finalize 处理器

## Implementation Notes

### Redis 连接配置

- BullMQ 强制要求 `maxRetriesPerRequest: null`，否则队列会抛出连接配置错误
- 启动时执行 `redis.ping()` 探活，失败则 `redis.quit()` 并将引用置空，所有队列操作提前返回描述性错误，避免应用崩溃
- 关闭顺序：`queue.close()` → `redis.quit()`，先关闭队列再关闭连接，防止在途任务丢失

### Worker 并发调优

- 通用 worker 并发数通过 `QUEUE_CONCURRENCY` 环境变量控制（默认 2），按机器 CPU 与 Redis 负载线性调整
- `chat-finalize` worker 并发固定为 1，避免并发写入会话状态产生竞态
- 并发数越高，对下游（MinIO、嵌入服务、数据库）压力越大，调优时同步观察下游 RT

### 重试与退避调试

- 重试次数、退避策略、保留条数等参数集中在 `queues.ts` 定义，不要在调用点散落配置
- 调试单个 Job 重试时，可在 BullMQ Admin UI 或 Redis CLI 查看 `bull:<queueName>:<jobId>` 状态
- 退避策略为 exponential，手动验证时注意每次重试间隔会翻倍

### Failed Jobs 排查

- `worker.on('failed', ...)` 钩子是统一排查入口，可在此写日志、更新业务状态、触发告警
- 文档索引失败时，`errorMessage` 截断至 500 字符后再写入 Prisma，避免长错误撑爆数据库字段
- `ZodError` 失败时额外记录 `issues[].path` 详情，便于定位 schema 校验失败的字段

### StreamFinalize 双模式调度

- 正常路径走 BullMQ `chat-finalize` 队列，保证持久化与重试
- Redis 不可用时降级为 `queueMicrotask`，仅保证当次响应可用，不保证最终一致
- 调试双模式时，可通过临时断开 Redis 验证降级分支是否触发

### 文档状态单次写入

- 索引过程中文档状态转换通过单次 `prisma.document.update` 完成，减少 DB 往返
- 不要在管线中途插入额外状态更新，会破坏状态机一致性

## Testing Checklist

- [ ] 队列任务正确入队（Job Data 字段完整）
- [ ] Worker 正确消费任务（处理器被触发）
- [ ] 重试策略正确执行（失败后按退避间隔重新入队）
- [ ] 失败任务正确记录（errorMessage 截断、ZodError 详情）
- [ ] 并发数限制正确（超限任务进入等待）
- [ ] Redis 不可用时优雅降级（应用不崩溃、操作返回错误）
- [ ] 模块销毁时连接正确关闭（先队列后 Redis）

## Review Checklist

- [ ] 新增队列是否同步更新 OpenSpec
- [ ] Job Data 契约变更是否同步更新 OpenSpec
- [ ] 重试配置变更是否同步更新 OpenSpec
- [ ] 并发数变更是否影响下游容量评估
- [ ] 错误处理钩子是否覆盖新增 worker

## Common Pitfalls

- `maxRetriesPerRequest` 未设为 `null`，BullMQ 直接拒绝启动
- 在 `worker.on('failed')` 中抛出异常会导致 BullMQ 内部状态紊乱，钩子内必须 catch 所有错误
- `errorMessage` 未截断直接写库，可能超出字段长度限制
- 关闭顺序颠倒（先 `redis.quit()` 再 `queue.close()`）会导致在途任务无法落盘
- 修改 `QUEUE_CONCURRENCY` 未评估下游容量，引发 MinIO/嵌入服务雪崩
- StreamFinalize 降级路径未测试，线上 Redis 抖动时静默丢失任务

## Reusable Patterns

### QueueService 连接生命周期管理模式

启动 ping 探活 → 成功则创建队列并启动 worker → 失败则优雅降级；销毁时先关队列再关连接。该模式可复用于任何依赖外部连接的 Service。

### Worker 失败钩子统一处理模式

在 `worker.service.ts` 集中注册 `on('failed')`，统一负责业务状态更新、错误截断、日志记录。新增 worker 时复用此模式，避免在处理器内部散落错误处理逻辑。

### 动态模块可选 Provider 模式

`QueueModule.forRoot({ embeddingHandler })` 通过可选 provider 控制是否注册嵌入 worker。当外部不需要某个 worker 时，传入 undefined 即可跳过注册，模块对扩展开放、对缺省封闭。
