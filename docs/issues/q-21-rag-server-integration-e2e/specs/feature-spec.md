---
issue_id: q-21
type: feature-spec
status: draft
summary: 验证 RAG Server 集成的完整端到端链路，覆盖文档上传、异步索引状态流转、对话检索上下文注入及无检索对话回归测试。使用真实数据库与 Docker 基础设施，不依赖 mock。
---

# 功能规格：RAG Server 集成端到端验证

## 用户故事

作为系统质量保障人员，我希望通过自动化测试验证 RAG 完整链路（文档上传 -> 异步索引 -> 对话检索注入），以便在 b-08、b-09、f-16 完成后确认各组件集成正确、无回归。

## 边界

### 范围内
- 文档上传后通过 BullMQ 触发异步索引，状态从 `uploaded` 流转至 `ready`
- 对话请求携带 `knowledgeBaseIds` 时，检索上下文注入 system message，SSE 流式输出正常
- 对话请求不携带 `knowledgeBaseIds` 时，对话行为与现有逻辑完全一致
- 索引失败场景：Worker 重试后标记 `failed`
- 使用真实 PostgreSQL、MinIO、Milvus、Redis（Docker 基础设施）

### 范围外
- 前端 UI 交互验证（由 f-16 的 E2E 测试覆盖）
- RAG SDK 内部单元测试（由 d-11 ~ d-15 覆盖）
- 性能基准测试（吞吐量、延迟百分位）
- 多租户隔离验证（超出当前 issue 范围）

## 涉及模块/组件

- `tests/integration/sidecar/rag-flow.spec.ts` — 现有 E2E 测试（需对齐到新架构）
- `tests/integration/sidecar/index-sync.spec.ts` — 现有索引同步测试
- `tests/issues/q-21-rag-server-integration-e2e/` — 新增集成测试目录
- `packages/server/src/modules/knowledge-base/document.service.ts` — 上传触发索引任务
- `packages/server/src/modules/chat/chat.service.ts` — 检索上下文注入
- `packages/server/src/processors/queue/indexing.worker.ts` — 索引流水线 Worker
- `packages/server/src/processors/vector/vector.service.ts` — Milvus 向量操作
- `packages/server/src/processors/keyword/keyword.service.ts` — PostgreSQL FTS 关键词检索

## 相关功能

- `b-08-indexing-worker-integration` — 提供索引流水线 Worker 实现
- `b-09-chat-rag-retrieval` — 提供对话检索 API 实现
- `f-16-chat-kb-selector` — 提供前端知识库选择器（本测试仅验证 API 层）
- `d-11 ~ d-15` — RAG SDK 核心模块（分块、向量化、索引、检索）

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| 集成测试使用真实数据库，不 mock Prisma | 验证 SQL 执行计划、事务行为、FTS 索引效果 | 否（测试已写定） |
| Embedding API 使用 mock server（非真实调用） | 避免测试依赖外部网络与密钥，保证稳定性 | 是（可替换为真实 API） |
| 测试基础设施通过 Docker Compose 启动 | 与生产环境一致，覆盖 PG + MinIO + Milvus + Redis | 否 |
| 状态流转断言采用轮询而非事件监听 | BullMQ 事件在测试环境不可靠，轮询更稳定 | 是 |
| 索引超时阈值设为 30 秒 | 测试环境资源有限，需给足 Worker 处理时间 | 是 |
| 测试文件放在 `tests/issues/q-21-rag-server-integration-e2e/` | 符合项目“按 issue 组织测试”规范 | 否 |
| 不验证中间状态（chunking/embedding/indexing） | 中间状态依赖 Worker 实现细节，易碎；只验证终态 | 是 |

## 关键术语定义

| 术语 | 定义 |
|------|------|
| `uploaded` | 文档刚创建，已存入 MinIO，等待 Worker 处理 |
| `chunking` | Worker 正在执行文本分块 |
| `embedding` | Worker 正在调用 Embedding API 生成向量 |
| `indexing` | Worker 正在将向量写入 Milvus、chunk 写入 PostgreSQL |
| `ready` | 索引完成，文档可被检索 |
| `failed` | 索引过程中发生不可恢复错误（重试 3 次后） |
| `system context` | 注入到 LLM system message 中的检索结果文本 |
