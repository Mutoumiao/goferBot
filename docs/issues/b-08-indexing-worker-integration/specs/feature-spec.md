---
issue_id: b-08
type: feature-spec
status: draft
summary: 将 RAG 索引流水线接入 NestJS 运行时，通过 BullMQ Worker 驱动文档从 uploaded 到 ready/failed 的完整状态流转。
---

# 功能规格：索引 Worker 与队列集成

## 用户故事

作为 GoferBot 用户，我希望上传文档后系统自动完成分块、向量化、索引入库，以便在后续对话中基于知识库内容获得精准回答。

作为后端开发者，我希望索引任务由 BullMQ Worker 异步处理，具备自动重试和失败标记能力，以便在生产环境中稳定运行。

## 边界

- **范围内**：
  - `IndexingWorker` 的实现与注册，作为 BullMQ document job 的 handler
  - `QueueModule.forRoot()` 将 `DOCUMENT_JOB_HANDLER` 绑定到 `IndexingWorker`
  - `DocumentService.upload()` 上传成功后触发索引任务
  - `DocumentJobData.type` 统一为 `'index'`（替换旧 `'parse'|'chunk'|'embed'`）
  - Document status 状态机：uploaded → chunking → embedding → indexing → ready/failed
  - Worker 重试 3 次后标记 status='failed'，并记录 errorMessage
  - `runIndexing` 的 `onStageChange` 回调映射到 Document status
- **范围外**：
  - `DocumentParser` 的具体实现（属于 b-11）
  - `PrismaMilvusIndexer` 的具体实现（属于 b-11）
  - `VectorService` 适配 SDK `IVectorStore`（属于 b-10）
  - `KeywordService` 实现（属于 b-10）
  - ChatService RAG 检索集成（属于 b-09）
  - 前端文档状态 UI 展示
  - 手动重试/重索引功能

## 涉及模块

- `packages/server/src/processors/queue/indexing.worker.ts` — 新增
- `packages/server/src/processors/queue/queue.module.ts` — 修改
- `packages/server/src/processors/queue/queue.service.ts` — 修改（job type 调整）
- `packages/server/src/modules/knowledge-base/document.service.ts` — 修改（上传后触发）
- `packages/server/src/queue/queues.ts` — 修改（DocumentJobData.type）

## 相关功能

- **上游**：
  - b-10（server-vector-keyword-adapters）— 提供 `VectorService`（SDK IVectorStore）和 `KeywordService`
  - b-11（document-parser-indexer）— 提供 `DocumentParser` 和 `PrismaMilvusIndexer`，`runIndexing` 依赖这些组件
  - d-15（rag-sdk-integration）— 提供 `runIndexing` 流水线、SDK 接口定义
- **下游**：
  - b-09（chat-rag-retrieval）— 消费已索引文档，在对话中检索 chunks
  - q-21（rag-server-integration-e2e）— E2E 测试需要完整索引流水线可运行

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| `DocumentJobData.type` 统一为 `'index'` | SDK `runIndexing` 已内聚 chunk+embed+index 三阶段，旧拆分设计失效 | 否（旧类型无使用方） |
| Worker 重试 3 次后标记 failed | BullMQ 默认 attempts=3，与现有队列配置一致，不引入额外重试逻辑 | 是（可通过环境变量调整） |
| `onStageChange` 仅映射 `running` 状态 | `pending`/`completed` 对前端无意义，减少数据库写入次数 | 是 |
| 上传后立即触发 job，不等待事务提交 | `prisma.document.create()` 为同步调用，返回后即可安全添加 job | 否 |
| `IndexingWorker` 通过 NestJS DI 注入依赖 | 便于 mock 和测试，与现有 service 风格一致 | 否 |
