---
id: d-12
status: open
track: design
priority: p1
summary: RAG SDK 离线索引构建模块（chunkers / embedders / indexers / indexing pipeline）
blocked_by:
  - d-11
checklist: checklist.json
plan: plan.md
specs: specs/
---

## 要构建的内容

实现 RAG SDK 的离线索引构建模块，包含文档分块、文本向量化、向量索引写入和索引流水线编排。

## 规格引用

- 功能规格: specs/feature-spec.md
- API 规格: specs/api-spec.md

## 补充说明

- 依赖 d-11（core 契约层）完成后方可开始
- 删除原 adapters 模块，OpenAIEmbedder 直接放在 indexing/embedders/
- RecursiveCharacterChunker 支持 parentId / hierarchyPath / metadata，为 Small-to-Big Retrieval 做准备
- MilvusIndexer 通过注入的 IVectorStore 接口写入，不直接依赖 @zilliz/milvus2-sdk-node
- runIndexing 支持阶段状态追踪（IndexingStage[]），内置可观测性 hook
