---
id: d-13
status: open
track: design
priority: p1
summary: RAG SDK 在线检索模块（hybrid retriever / postprocessor / runtime pipeline / RRF）
blocked_by:
  - d-11
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

实现 RAG SDK 的在线检索编排模块，包含混合检索（向量 + 关键词 + RRF 融合）、检索后处理（过滤 / 重排 / 预算截断）和检索流水线编排。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 依赖 d-11（core 契约层）完成后方可开始
- HybridRetriever 替代原 MilvusRetriever，支持向量检索 + 关键词检索 + RRF 融合
- IKeywordStore 接口由 server 基于 PostgreSQL FTS 实现，SDK 仅定义契约
- DefaultRetrievalPostprocessor 支持分层处理：filter → rerank → budget trim
- SelectionTrace 记录每步操作原因，支持可观测性调试
- runRetrievalPipeline 支持阶段耗时记录和 RuntimeDebugInfo 收集
