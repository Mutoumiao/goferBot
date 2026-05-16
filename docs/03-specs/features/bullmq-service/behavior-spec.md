# Behavior Spec: BullMQ NestJS 封装服务

## 1. 模块注册行为

### 1.1 QueueModule.forRoot() 注册

**触发条件**：`AppModule` 导入 `QueueModule.forRoot()` 或 `QueueModule.forRoot(processors)`。

**行为**：
1. NestJS 解析 `DynamicModule`，注册 `QueueService` 和 `WorkerService` 到全局 provider 容器。
2. `QUEUE_PROCESSORS` token 被绑定为值提供者：
   - 若传入 `processors`，使用该对象。
   - 若未传入，使用空对象 `{}`。
3. `ConfigModule` 被导入，确保 `ConfigService` 在模块内可用。

**成功判定**：应用启动时 `QueueModule` 无报错，`QueueService` 可在任意模块中注入。

**失败场景**：
- `forRoot()` 被调用多次 — NestJS 允许同一模块多次导入，但 `@Global()` 仅生效一次，不报错。

---

## 2. Worker 生命周期行为

### 2.1 启动时创建 Worker（OnModuleInit）

**触发条件**：NestJS 应用启动，`WorkerService` 的生命周期钩子 `onModuleInit` 被调用。

**行为**：
1. `WorkerService` 从 `ConfigService` 读取配置：
   - `QUEUE_CONCURRENCY` → 默认 `2`
2. 检查 `QUEUE_PROCESSORS` token：
   - 若提供了 `documentProcessor`，使用该处理器。
   - 否则使用默认占位处理器。
   - 对 `embeddingProcessor` 同理。
3. 使用 `bullmq.Worker` 创建两个 Worker 实例：
   - `document-processing` Worker
   - `embedding-generation` Worker
4. 两个 Worker 共享同一 `redis` 连接实例（来自 `src/queue/redis.ts`）。

**成功判定**：应用启动日志中无 BullMQ Worker 创建错误，Redis 连接正常。

**失败场景**：
- Redis 不可达 — `Worker` 构造函数不立即报错，但后续任务消费会失败。建议在 `main.ts` 启动时主动调用 `checkRedisConnection()`。

### 2.2 关闭时优雅停止 Worker（OnModuleDestroy）

**触发条件**：NestJS 应用收到关闭信号（`SIGTERM`、`SIGINT`）或调用 `app.close()`。

**行为**：
1. NestJS 调用 `WorkerService.onModuleDestroy()`。
2. 并行调用 `documentWorker.close()` 和 `embeddingWorker.close()`。
3. `close()` 等待当前处理中的 job 完成后返回。
4. 所有 Promise resolve 后，NestJS 继续关闭其他模块。

**成功判定**：关闭日志中显示 Worker 已关闭，无未完成的 job 被强制中断。

**失败场景**：
- job 处理超时 — `close()` 默认等待无限长时间，可通过 `timeout` 参数限制（MVP 阶段不配置）。

---

## 3. 任务投递行为

### 3.1 添加文档处理任务

**触发条件**：业务模块调用 `queueService.addDocumentJob(documentId, type)`。

**行为**：
1. `QueueService` 代理调用 `src/queue/jobs.ts` 中的 `addDocumentJob()`。
2. 数据序列化为 JSON，投递到 `document-processing` 队列。
3. 返回 `job.id`（string）。

**成功判定**：返回有效的 `jobId`，队列中新增一条等待中的 job。

**失败场景**：
- Redis 不可达 — 抛出错误，由调用方或全局异常过滤器处理。

### 3.2 添加向量化任务

**触发条件**：业务模块调用 `queueService.addEmbeddingJob(chunkIds, kbId)`。

**行为**：与 3.1 类似，投递到 `embedding-generation` 队列。

### 3.3 查询任务状态

**触发条件**：业务模块调用 `queueService.getJobStatus(jobId)`。

**行为**：
1. 依次从 `document-processing`、`embedding-generation` 队列查询。
2. 返回标准化 `JobStatus` 对象。
3. 若 job 不存在，返回 `null`。

### 3.4 查询队列统计

**触发条件**：业务模块调用 `queueService.getQueueStats()`。

**行为**：
1. 分别查询两个队列的 `waiting`、`active`、`completed`、`failed`、`delayed` 计数。
2. 返回 `QueueStats[]` 数组。

---

## 4. 处理器替换行为

### 4.1 使用自定义处理器

**触发条件**：`QueueModule.forRoot({ documentProcessor: myProcessor })` 被调用。

**行为**：
1. `WorkerService` 在 `onModuleInit` 中读取 `QUEUE_PROCESSORS` token。
2. 使用传入的 `documentProcessor` 替代默认占位处理器。
3. 自定义处理器需符合类型签名 `(job: Job<DocumentJobData>) => Promise<void>`。

**约束**：
- 自定义处理器中抛出的异常由 BullMQ 捕获并按队列重试策略处理。
- 自定义处理器可通过 `job.updateProgress()` 更新进度。

---

## 5. 配置行为矩阵

| 环境 | Redis 位置 | Worker 并发 | 重试策略 | 处理器 |
|------|-----------|-------------|----------|--------|
| 开发（dev） | Docker Compose Redis | `QUEUE_CONCURRENCY` 或默认 2 | 3 次，指数退避 | 占位处理器 |
| 测试（test） | 独立 Redis 实例 | 1（避免并发干扰） | 1 次（快速失败） | 占位处理器 |
| 生产（prod） | 外部 Redis / 集群 | 可配置 | 3 次，指数退避 | Phase 5 自定义处理器 |

---

## 6. 错误处理行为

### 6.1 任务投递失败

- Redis 不可达 — 抛出异常，由 NestJS 全局异常过滤器返回 500。
- `job.id` 未定义 — 抛出 `Error('Failed to add document job: job.id is undefined')`。

### 6.2 Worker 处理失败

- 处理器抛出异常 — BullMQ 自动重试（默认 3 次，指数退避）。
- 超过最大重试次数 — job 状态变为 `failed`，`failedReason` 记录异常信息。

### 6.3 配置缺失

- `REDIS_HOST`、`REDIS_PORT` 缺失 — 使用默认值 `localhost:6379`。
- `QUEUE_CONCURRENCY` 缺失 — 使用默认值 `2`。
