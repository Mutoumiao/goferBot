# q-22 实现计划：RAG 真实集成测试

## 目标

在真实基础设施（PostgreSQL + Milvus + Redis + MinIO）上验证 RAG 端到端链路，消除 Mock 过重导致的"假集成"风险。

## 执行步骤

### 阶段 1：基础设施检测（AC-01）

**文件**: `tests/integration/helpers/infra-check.ts`

- 实现四服务 TCP 端口检测（PG 5432 / Milvus 19530 / Redis 6379 / MinIO 9000）
- 返回统一结果对象 `{ postgres, milvus, redis, minio, allAvailable, details }`
- 提供 `formatInfraSkipReason()` 格式化跳过原因

### 阶段 2：TestAppFactory 扩展（AC-02）

**文件**: `tests/integration/helpers/test-app.factory.ts`

- 新增 `CreateAppOptions` 接口：`{ realMode?: boolean }`
- `realMode=true` 时不覆盖 QueueService/VectorService/StorageService
- `realMode=false`（默认）保持现有 Mock 行为，向后兼容

### 阶段 3：索引链路测试（AC-03）

**文件**: `tests/integration/rag-real.spec.ts`

- 使用 `FormData` 上传文本文件到 `/api/knowledge-bases/:kbId/documents/upload`
- Mock Embedding API（避免外部费用）
- 轮询等待 Worker 处理完成（`status = ready`）
- 断言：
  - `prisma.chunk.findMany()` 返回非空数组
  - `chunk.content` 和 `chunk.tokenCount` 有效
  - `vectorService.searchVectors()` 返回非空结果

### 阶段 4：检索链路测试（AC-04）

**文件**: `tests/integration/rag-real.spec.ts`

- 复用 AC-03 的索引文档
- 创建会话并调用 Chat API（`POST /api/chat`）
- Mock LLM API（SSE 流式响应）
- 断言：
  - HTTP 200 + `content-type: text/event-stream`
  - SSE 内容包含预期文本

### 阶段 5：失败降级测试（AC-05）

**文件**: `tests/integration/rag-real.spec.ts`

- 临时移除 Embedding API mock
- 上传文件并等待 Worker 处理
- 断言：
  - `document.status = 'failed'`
  - `document.errorMessage` 非空
  - 系统未崩溃

### 阶段 6：验证（AC-06 / AC-07）

- `pnpm type-check` — 0 错误
- `npx vitest run --config vitest.integration.config.ts` — 全部通过
- 基础设施不可用时测试优雅跳过（不报错）

## 关键决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 新建 `rag-real.spec.ts` | 是 | 避免污染 q-21 骨架和旧版 SQLite 测试 |
| 继续 Mock Embedding API | 是 | 避免外部网络和费用 |
| TCP 端口检测（非 SDK 客户端） | 是 | 避免根目录依赖 `@zilliz/milvus2-sdk-node` 和 `ioredis` |
| `realMode` 参数（非新类） | 是 | 向后兼容，减少代码重复 |

## 文件变更

```
tests/integration/helpers/infra-check.ts          # 新增
tests/integration/helpers/test-app.factory.ts     # 修改（扩展 realMode）
tests/integration/rag-real.spec.ts                # 新增
```

## 测试运行

```bash
# 集成测试（包含 rag-real.spec.ts）
npx vitest run --config vitest.integration.config.ts

# 全部测试
pnpm test:all
```

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Docker 未启动时测试失败 | `infra-check.ts` 检测 + 条件跳过 |
| Worker 处理超时 | 60 秒超时 + 失败时抛出清晰错误 |
| Milvus 集合不存在 | `VectorService.onModuleInit` 自动 `ensureCollection()` |
| 端口冲突 | 使用 `TestDatabaseManager` 动态创建隔离数据库 |
