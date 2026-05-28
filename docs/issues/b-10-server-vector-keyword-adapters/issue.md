---
id: b-10
status: open
track: backend
priority: p1
summary: Server 向量与关键词存储适配（SDK IVectorStore + IKeywordStore 实现）
blocked_by: []
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

让 server 的存储层实现 SDK 定义的接口：
1. `VectorService` 适配 SDK `IVectorStore`，删除 server 自有冗余接口定义
2. 新增 `KeywordService` 实现 SDK `IKeywordStore`，基于 PostgreSQL 全文检索

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

### 为什么这两个组件放一起

`VectorService` 和 `KeywordService` 都是 `HybridRetriever` 的依赖：
- `HybridRetriever` 需要同时注入 `IVectorStore` + `IKeywordStore` + `IEmbedder`
- 两者都是"检索基础设施"，无业务逻辑，可独立测试
- 它们共同构成 RAG 检索的"存储适配层"

### 依赖关系

**阻塞下游：**
- `b-11-document-parser-indexer` — `PrismaMilvusIndexer` 需要 `VectorService`（IVectorStore）
- `b-09-chat-rag-retrieval` — `HybridRetriever` 需要 `VectorService` + `KeywordService`

**被阻塞于：**
- 无（本 issue 只修改 server 代码，不依赖 SDK 变更）

### 技术要点

- `VectorService` 字段与 SDK `IVectorStore` 完全一致，直接替换接口引用即可
- `deleteByFileId` / `deleteByKbId` 保留为扩展方法（不在 SDK 接口中）
- `KeywordService` 使用 PostgreSQL `to_tsvector('chinese', content)`，需 zhparser
- zhparser 未安装时降级为 `to_tsvector('simple')`
