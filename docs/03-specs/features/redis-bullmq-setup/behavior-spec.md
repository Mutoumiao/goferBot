# Behavior Spec: Redis + BullMQ Setup

## 1. 初始化行为

### 1.1 服务启动时创建 Queue 和 Worker 实例

**触发条件**：Hono Server 启动（`src/index.ts` 或等效入口）。

**行为**：
1. 读取环境变量 `REDIS_HOST`（默认 `localhost`）、`REDIS_PORT`（默认 `6379`）。
2. 使用 `ioredis` 创建 Redis 连接实例。
3. 立即执行 `redis.ping()` 检查连通性：
   - 成功：继续初始化。
   - 失败：抛出错误 `Redis connection failed: ${err.message}`，终止启动流程。
4. 使用同一 Redis 连接实例初始化以下 BullMQ Queue：
   - `document-processing`
   - `embedding-generation`
5. 注册对应 Worker，读取环境变量 `QUEUE_CONCURRENCY`（默认 `2`）作为并发数。

**成功判定**：Server 正常启动，无 Redis 连接报错，Queue 和 Worker 实例已创建。

**失败场景**：
- Redis 服务未启动 → 明确报错提示检查 Docker Compose。
- Redis 认证失败（如后续开启 AUTH）→ 报错提示检查 Redis 配置。

---

## 2. 任务投递行为

### 2.1 添加文档处理任务

**触发条件**：文件上传完成，PostgreSQL 已创建 `documents` 记录（status = `uploaded`）。

**行为**：
1. 调用方提供 `documentId`（string）和 `type`（`'parse' | 'reindex'`）。
2. `addDocumentJob` 将数据序列化为 JSON，投递到 `document-processing` 队列。
3. BullMQ 返回 `job` 对象，提取 `job.id` 返回给调用方。
4. 可选：更新 `documents` 表的 `status` 为 `parsing`（由调用方或 Worker 决定，本规格约定由调用方在入队后立即更新）。

**成功判定**：返回有效的 `jobId`（string），队列中新增一条等待中的 job。

**失败场景**：
- Redis 不可达 → 抛出错误，由调用方捕获并标记 `status = failed`。
- 序列化失败（循环引用等）→ 抛出错误，记录 `errorMessage`。

### 2.2 任务数据结构

```typescript
interface DocumentJobData {
  documentId: string;
  type: 'parse' | 'reindex';
}
```

---

## 3. 任务处理行为

### 3.1 Worker 消费任务

**触发条件**：`document-processing` 队列中存在等待中的 job。

**行为**：
1. Worker 按 FIFO 顺序取出 job。
2. 根据 `job.data.type` 分发到对应处理分支：
   - `parse`：执行占位处理流程（见 3.2）。
   - `reindex`：执行重新索引占位流程。
3. 处理完成后，BullMQ 自动将 job 标记为 `completed`。
4. 处理失败时，BullMQ 按重试策略自动重新投递。

### 3.2 占位处理流程（parse 类型）

当前阶段不执行真实业务逻辑，仅模拟阶段推进并更新数据库状态：

1. **parse 阶段**
   - 更新 `documents.status = 'parsing'`。
   - 调用 `job.updateProgress(10)`。
   - 模拟耗时：休眠 100ms（占位）。

2. **chunk 阶段**
   - 更新 `documents.status = 'chunking'`。
   - 调用 `job.updateProgress(40)`。
   - 模拟耗时：休眠 100ms（占位）。

3. **embed 阶段**
   - 更新 `documents.status = 'indexing'`。
   - 调用 `job.updateProgress(70)`。
   - 模拟耗时：休眠 100ms（占位）。

4. **完成**
   - 更新 `documents.status = 'ready'`。
   - 调用 `job.updateProgress(100)`。

### 3.3 进度报告

Worker 在处理过程中通过 `job.updateProgress(value)` 更新进度，其中 `value` 为 `0-100` 的整数。

调用方可通过 `getJobStatus(jobId)` 查询到当前进度值。

---

## 4. 错误处理行为

### 4.1 失败重试

默认重试配置：
- `attempts: 3`（含首次执行，共最多 3 次）。
- `backoff: { type: 'exponential', delay: 2000 }`。

重试间隔计算：
| 第几次重试 | 延迟 |
|-----------|------|
| 1 | 2s |
| 2 | 4s |
| 3 | 8s |

### 4.2 死信队列

当 job 超过最大重试次数后，BullMQ 自动将其移至 `failed` 状态，可通过 `getJobStatus` 查询到失败原因。

MVP 阶段不配置独立的死信队列（DLQ）Topic，失败 job 保留在原队列的 failed 集合中。

### 4.3 失败状态同步

Worker 捕获异常时，应在抛出前更新 `documents` 表：
- `status = 'failed'`
- `errorMessage = error.message`

确保前端文件列表能正确展示失败状态。

---

## 5. 监控行为

### 5.1 任务状态查询

**接口**：`getJobStatus(jobId: string)`

**行为**：
1. 通过 BullMQ `Job.fromId(queue, jobId)` 查询 job 详情。
2. 返回标准化状态对象：

```typescript
interface JobStatus {
  id: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'unknown';
  progress: number;        // 0-100
  attemptsMade: number;
  failedReason?: string;   // 仅在 failed 状态时有值
  finishedOn?: number;     // 时间戳（ms）
  processedOn?: number;    // 时间戳（ms）
}
```

### 5.2 队列统计查询

**接口**：`getQueueStats()`

**行为**：
1. 分别查询 `document-processing` 和 `embedding-generation` 队列的统计信息。
2. 返回：

```typescript
interface QueueStats {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
```

---

## 6. 生命周期行为

### 6.1 启动时

- 创建 Redis 连接。
- 检查连通性（`ping`）。
- 创建 Queue 实例。
- 注册 Worker 实例。

### 6.2 运行时

- Worker 持续监听队列，按并发配置并行处理。
- Queue 接受新任务投递。

### 6.3 关闭时

- 收到进程终止信号（`SIGTERM`、`SIGINT`）时：
  1. 调用 `worker.close()` 优雅停止 Worker（等待当前处理中的 job 完成）。
  2. 调用 `queue.close()` 关闭 Queue。
  3. 断开 Redis 连接。

---

## 7. 环境行为矩阵

| 环境 | Redis 位置 | Worker 并发 | 重试策略 |
|------|-----------|-------------|----------|
| 开发（dev） | Docker Compose Redis | `QUEUE_CONCURRENCY` 或默认 2 | 3 次，指数退避 |
| 测试（test） | 独立 Redis 实例（或内存版） | 1（避免并发干扰） | 1 次（快速失败） |
| 生产（prod） | 外部 Redis / 集群 | 可配置 | 3 次，指数退避 |
