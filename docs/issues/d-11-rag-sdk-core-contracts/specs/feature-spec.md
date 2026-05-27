# 功能规格：d-11 RAG SDK Core 契约层

## 用户故事

作为 GoferBot 后端开发者，我希望 RAG SDK 提供统一的领域契约层，以便在索引构建和检索流程中共享一致的数据模型、校验规则和错误处理。

## 边界

- **范围内**：
  - 共享数据模型（DocumentSource / Query / Chunk / ChunkWithScore / RetrievalCandidate / EmbeddingConfig / HybridSearchOptions）
  - Zod Schema 定义与类型推导
  - 跨模块能力接口（IChunker / IEmbedder / IIndexer / IRetriever / IReranker / IGenerator / IVectorStore / IKeywordStore）
  - 错误体系（RAGError 及子类）
  - Pipeline 类型抽象（IndexingPipeline / RuntimePipeline）
  - 向量存储接口（VectorRecord / VectorSearchOptions / VectorSearchResult）
  - 统一导出入口（index.ts）
- **范围外**：
  - 任何接口的具体实现（由 d-12 / d-13 负责）
  - 外部 SDK 调用（OpenAI / Milvus / PostgreSQL）
  - 可观测性实现（由 d-14 负责）
  - 业务编排逻辑（由 server 负责）

## 涉及模块

- `packages/rag-sdk/src/types.ts`
- `packages/rag-sdk/src/schema.ts`
- `packages/rag-sdk/src/interfaces.ts`
- `packages/rag-sdk/src/errors.ts`
- `packages/rag-sdk/src/pipeline.ts`
- `packages/rag-sdk/src/vector-store.ts`
- `packages/rag-sdk/src/index.ts`

## 相关功能

- **上游**：无（阻塞性基础 issue）
- **下游**：
  - d-12（索引模块）— 消费 IChunker / IEmbedder / IIndexer / IndexingPipeline
  - d-13（运行时模块）— 消费 IRetriever / IReranker / IGenerator / RuntimePipeline / IKeywordStore
  - d-14（可观测性模块）— 消费 IndexingStage / RuntimeStage / RuntimeDebugInfo
  - d-15（集成验证）— 消费全部契约进行端到端测试

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Core 扁平化到 `src/` 根目录 | 单包内减少不必要的目录深度，直接 `import { X } from '@goferbot/rag-sdk'` | 否 |
| 所有类型由 Zod Schema 推导 | 保证运行时校验与编译时类型一致，消除重复定义 | 否 |
| IVectorStore 内聚到 SDK | 彻底解耦对 server 的反向依赖，server 实现后注入 | 否 |
| Query 从 `string` 升级为结构化对象 | 支持 query rewrite、expansion、routing 等高级特性 | 否 |
| RetrievalCandidate 替代 ChunkWithScore 作为 IRetriever 返回值 | 支持 source、route、metadata 等扩展信息 | 否 |
| 新增 IKeywordStore 接口 | 支持混合检索中的关键词检索分支；参数简单（string + string[] + number），无需独立 Zod Schema，由实现方校验 | 否 |
| 错误支持 `cause` 链式追溯 | 便于调试底层故障（如 Embedding API 失败） | 否 |
