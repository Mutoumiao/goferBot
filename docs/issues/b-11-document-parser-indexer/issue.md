---
id: b-11
status: closed
track: backend
priority: p1
summary: 文档解析与索引写入（DocumentParser + PrismaMilvusIndexer）
blocked_by:
  - d-20
  - b-10
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

实现文档索引流水线的"转换层"组件：
1. `DocumentParser` — 从 MinIO 下载文件并解析为纯文本
2. `PrismaMilvusIndexer` — 实现 SDK `IIndexer`，将 chunks 写入 PostgreSQL、向量写入 Milvus

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么这两个组件放一起

`DocumentParser` 和 `PrismaMilvusIndexer` 都是"无状态转换函数"：
- 输入确定 → 输出确定
- 无副作用（不操作队列、不管理生命周期）
- 可独立单元测试，不依赖 BullMQ、Worker 等运行时基础设施

它们共同构成 `runIndexing` 流水线的"输入端"（Parser 产 DocumentSource）和"输出端"（Indexer 持久化结果）。

### 依赖关系

**阻塞下游：**
- `b-08-indexing-worker-integration` — `IndexingWorker` 需要 `DocumentParser` + `PrismaMilvusIndexer`

**被阻塞于：**
- `d-20-rag-sdk-embedder-token-usage` — `PrismaMilvusIndexer` 需要 `TokenUsage` 来写入精确的 `tokenCount`
- `b-10-server-vector-keyword-adapters` — `PrismaMilvusIndexer` 需要 `VectorService`（SDK IVectorStore）

### 技术要点

- `DocumentParser` MVP 支持 text/plain、text/markdown，PDF 占位抛错
- `PrismaMilvusIndexer` 优先使用 `TokenUsage` 写入精确 tokenCount，无 usage 时回退到 chunker 估算
- 向量写入 Milvus 后回写 `milvusId` 到 PostgreSQL Chunk 表
- 使用 `$transaction` 保证 chunk 创建与 milvusId 回写的原子性
