---
id: b-08
status: closed
track: backend
priority: p1
summary: 索引 Worker 与队列集成（IndexingWorker + QueueModule + DocumentService 触发）
blocked_by:
  - b-11
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

将索引流水线接入 server 运行时：
1. `IndexingWorker` — BullMQ handler，调用 `runIndexing` 驱动完整流水线
2. `QueueModule` 注册 — 将 `DOCUMENT_JOB_HANDLER` 绑定到 `IndexingWorker`
3. `DocumentService.upload()` — 上传成功后触发索引任务

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么单独拆分

本 issue 涉及"运行时编排"（BullMQ Worker、队列生命周期、状态管理），与 b-11 的"静态转换组件"有本质区别：
- 需要 Redis、BullMQ 等外部基础设施
- 有异步状态流转（uploaded → chunking → embedding → indexing → ready/failed）
- 错误处理涉及重试、降级、死信队列

### 依赖关系

**阻塞下游：**
- `q-21-rag-server-integration-e2e` — E2E 测试需要完整的索引流水线可运行

**被阻塞于：**
- `b-11-document-parser-indexer` — `IndexingWorker` 需要 `DocumentParser` + `PrismaMilvusIndexer`

### 技术要点

- `DocumentJobData.type` 统一为 `'index'`（替换旧 `'parse'|'chunk'|'embed'`）
- `runIndexing` 的 `onStageChange` 回调映射到 Document status：chunk→chunking, embed→embedding, index→indexing
- Worker 重试 3 次后标记 status='failed'
- `DocumentService.upload()` 创建记录后立即 `addDocumentJob(doc.id, 'index')`
