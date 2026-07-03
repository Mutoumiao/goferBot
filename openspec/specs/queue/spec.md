# Queue - 异步任务队列

## Purpose（目的）

定义 GoferBot 基于 BullMQ 的异步任务队列系统规范。覆盖文档索引管线、Chat 消息持久化、ChatFinalizeProcessor 两步后处理、StreamFinalize 双模式调度（BullMQ → queueMicrotask 降级）、三 Redis 独立连接架构、队列生命周期管理。

## Requirements（需求）

### Requirement: BullMQ 队列架构
系统应维护三个基于 Redis 的 BullMQ 队列：`document-processing`、`embedding` 和 `chat-finalize`，每个队列具有不同的重试和并发策略。

证据来源：
- `packages/server/src/queue/queues.ts#L4-L25`
- `packages/server/src/queue/workers.ts`
- `packages/server/src/processors/queue/queue.service.ts`

#### Scenario: 启动时创建队列
- **WHEN** 服务器启动且 Redis 可用
- **THEN** 系统创建所有三个队列并启动其对应的 worker

#### Scenario: Redis 优雅降级
- **WHEN** 启动时 Redis 不可用（ping 失败）
- **THEN** 系统应记录警告并禁用所有队列功能，而不会导致应用崩溃；所有队列操作提前返回并附带描述性错误信息

#### Scenario: 健康检查
- **WHEN** 健康检查端点查询队列状态
- **THEN** 系统返回 `QueueService.isHealthy()`，该方法会 ping Redis 并报告连接状态

### Requirement: 三 Redis 独立连接架构
系统 SHALL 为 Queue、Cache、Auth 三个子系统维护独立的 Redis 连接，MUST NOT 共享连接以防止相互影响。

证据来源：
- `packages/server/src/auth/auth-redis.service.ts#L16`
- `packages/server/src/shared/cache/cache.service.ts`
- `packages/server/src/processors/queue/queue.service.ts`

#### Scenario: 独立连接隔离
- **WHEN** 系统初始化三个 Redis 子系统时
- **THEN** Queue Redis（BullMQ 队列+Worker）、Cache Redis（通用缓存 TTL=300s）、Auth Redis（Token 黑名单/用户缓存/权限缓存）各自创建独立连接，可分别配置 host/port/password

#### Scenario: 队列拥塞不影响认证
- **WHEN** BullMQ 队列因大量任务导致 Queue Redis 连接池耗尽时
- **THEN** Auth Redis 独立连接不受影响，用户仍可正常登录和鉴权

#### Scenario: 缓存击穿不影响队列
- **WHEN** Cache Redis 因大规模缓存穿透而压力骤增时
- **THEN** Queue Redis 独立连接不受影响，异步任务仍可正常调度和执行

### Requirement: 文档索引管线
系统应通过 `document-processing` 队列异步处理文档索引：从 MinIO 下载文件 → 通过 DocumentParser（按 MIME 类型的策略模式）解析 → 通过 LlamaIndexRagService 建立索引。

证据来源：
- `packages/server/src/processors/queue/indexing.worker.ts#L24-L88`
- `packages/server/src/processors/queue/queue.module.ts#L50-L59`

#### Scenario: 文档索引成功
- **WHEN** 添加一个类型为 `type='index'` 且包含有效 `documentId` 的文档任务
- **THEN** worker 从存储中下载文件，通过策略分发的解析器进行解析，调用 `ragService.indexDocument()`，并将文档状态更新为 `ready`，同时记录 chunk 数量

#### Scenario: 索引失败
- **WHEN** 索引失败（例如解析错误、嵌入失败）
- **THEN** worker 将文档状态更新为 `failed`，并附带错误消息（截断至 500 字符）；ZodError 失败应包含 schema 路径详情

#### Scenario: 文档状态状态机
- **WHEN** 索引任务执行
- **THEN** 文档经历以下状态转换：`uploaded` → `indexing` → `ready`（成功）或 `failed`（错误）；状态更新通过单次数据库写入完成，以最小化往返次数

### Requirement: 重试与并发
系统应为每个队列配置带指数退避的重试策略和并发限制。

证据来源：
- `packages/server/src/queue/queues.ts#L27-L69`
- `packages/server/src/processors/queue/worker.service.ts#L57-L59`

#### Scenario: 文档任务重试
- **WHEN** 文档处理任务失败
- **THEN** 应最多重试 3 次，从 5 秒开始采用指数退避；已完成任务保留最后 100 条记录，失败任务保留最后 50 条

#### Scenario: Chat finalize 任务重试
- **WHEN** chat finalize 任务失败
- **THEN** 应最多重试 5 次，从 5 秒开始采用指数退避；并发数固定为 1，以保证消息持久化的顺序

#### Scenario: 并发配置
- **WHEN** 设置了 `QUEUE_CONCURRENCY` 环境变量
- **THEN** 系统应使用其值（解析为整数）作为文档和嵌入 worker 的并发数；如果未设置或无效，默认为 2

#### Scenario: 3 队列拓扑对比
- **WHEN** 系统运行时
- **THEN** 三个队列的参数如下：

| 队列 | attempts | backoff | concurrency | removeOnComplete | removeOnFail |
|------|----------|---------|-------------|------------------|-------------|
| `document-processing` | 3 | 指数 5s | 2 | 100 | 50 |
| `embedding` | 3 | 指数 5s | 2 | 100 | 50 |
| `chat-finalize` | 5 | 指数 5s | 1 | 200 | 50 |

### Requirement: StreamFinalize 双模式调度
系统 SHALL 在 SSE 流结束后通过 StreamFinalizeService 调度后处理任务，支持 BullMQ 入队和 queueMicrotask 降级两种模式，MUST 确保两种模式互斥执行。

证据来源：
- `packages/server/src/common/services/stream-finalize.service.ts`

#### Scenario: BullMQ 入队模式（正常）
- **WHEN** SSE 流结束且 BullMQ 队列可用时
- **THEN** 系统将后处理任务（消息持久化 + 标题生成）入队到 `chat-finalize` 队列，携带完整上下文（sessionId, messageId, userId, fullReply, input, traceId, requestId）

#### Scenario: queueMicrotask 降级模式（队列不可用）
- **WHEN** SSE 流结束但 BullMQ 队列不可用时
- **THEN** 系统降级为 `queueMicrotask`，在微任务中恢复 RequestContext 后逐个执行 steps，fire-and-forget（异常被 catch 并 log，不传播）

#### Scenario: 双模式互斥
- **WHEN** StreamFinalizeService 调度后处理任务时
- **THEN** 入队成功后不再执行微任务降级，两种模式是互斥的，MUST NOT 重复执行

#### Scenario: 上下文恢复
- **WHEN** 后处理任务执行时（无论哪种模式）
- **THEN** 系统在入队前捕获 RequestContext（traceId/requestId/userId），执行时通过 `RequestContextStorage.run()` 恢复，确保日志和追踪链路完整

### Requirement: ChatFinalizeProcessor 两步后处理
系统 SHALL 通过 ChatFinalizeProcessor 实现两步后处理，第一步（消息持久化）失败时触发 BullMQ 重试，第二步（标题生成）失败时仅记录日志不阻塞。

证据来源：
- `packages/server/src/processors/chat/chat-finalize.processor.ts`

#### Scenario: 消息持久化（关键操作）
- **WHEN** ChatFinalizeProcessor 处理任务时
- **THEN** Step 1 执行 `saveAssistantMessage(sessionId, messageId, fullReply)` → 失败抛异常 → BullMQ 按 attempts=5 自动重试

#### Scenario: 标题生成（非关键操作）
- **WHEN** 消息持久化成功完成
- **THEN** Step 2 执行 `generateTitle(sessionId, input, fullReply, provider)` → 失败仅 log 警告，不抛异常，不触发 BullMQ 重试

#### Scenario: 标题生成 Provider 选择
- **WHEN** 标题生成需要选择 LLM Provider 时
- **THEN** 优先使用 `config.chat.defaultProvider`（如在 enabledProviders 中）→ 降级使用 enabledProviders 中其他 enabled 的 llm provider → 无可用 provider 时跳过标题生成

### Requirement: 带自定义处理器的动态模块
系统应通过 `forRoot()` 将 QueueModule 暴露为 @Global DynamicModule，支持可选的自定义嵌入处理器注入。

证据来源：
- `packages/server/src/processors/queue/queue.module.ts#L36-L92`

#### Scenario: 默认处理器
- **WHEN** 调用 QueueModule.forRoot() 时未提供选项
- **THEN** 系统注册 DocumentJobHandler（通过 IndexingWorker）和 ChatFinalizeJobHandler（通过 ChatFinalizeProcessor）；除非明确提供，否则不注册 EmbeddingJobHandler

#### Scenario: 自定义嵌入处理器
- **WHEN** 调用 QueueModule.forRoot({ embeddingHandler: customHandler })
- **THEN** 系统将自定义处理器注册为 EMBEDDING_JOB_HANDLER，允许使用替代的嵌入服务提供商

### Requirement: Worker 生命周期
系统应通过 NestJS 生命周期钩子管理 Worker 的启动和关闭。

证据来源：
- `packages/server/src/processors/queue/worker.service.ts#L16-L54`
- `packages/server/src/processors/queue/queue.service.ts#L37-L88`

#### Scenario: Worker 启动
- **WHEN** QueueService 建立 Redis 连接
- **THEN** 应调用 `WorkerService.startWorkers(redis)`，创建 DocumentWorker、EmbeddingWorker（如果已注册处理器）和 ChatFinalizeWorker

#### Scenario: Worker 关闭
- **WHEN** 模块被销毁
- **THEN** 所有 worker 应通过 `worker.close()` 优雅关闭；QueueService 关闭所有队列并断开 Redis 连接

### Requirement: Chat Finalize 队列
系统应使用专用的 `chat-finalize` 队列，在 SSE 流完成后异步处理消息持久化和标题生成。

证据来源：
- `packages/server/src/queue/queues.ts#L17-L25`
- `packages/server/src/processors/queue/queue.service.ts#L100-L103`

#### Scenario: Chat finalize 任务数据
- **WHEN** 添加一个 chat finalize 任务
- **THEN** 任务应包含 `{ sessionId, messageId, userId, fullReply, input, traceId, requestId }`，以支持消息持久化、标题生成和分布式追踪

#### Scenario: 顺序处理
- **WHEN** 多个 chat finalize 任务被加入队列
- **THEN** 应按顺序处理（concurrency=1），以防止会话状态的竞争条件

#### Scenario: 分布式追踪支持
- **WHEN** chat finalize 任务携带 traceId/requestId 时
- **THEN** 系统 SHALL 在任务执行时通过 RequestContextStorage.run() 恢复追踪上下文，确保跨 SSE 流和队列的完整追踪链路
