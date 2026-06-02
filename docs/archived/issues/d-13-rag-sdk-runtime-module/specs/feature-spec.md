---
issue_id: d-13
type: feature-spec
status: draft
summary: RAG SDK 在线检索模块——混合检索、检索后处理与运行时流水线编排
---

# 功能规格：d-13 RAG SDK 在线检索模块

## 用户故事

作为 GoferBot 后端开发者，我希望 RAG SDK 提供完整的在线检索能力，包括混合检索（向量 + 关键词 + RRF 融合）、检索后处理（过滤 / 重排 / 预算截断）和检索流水线编排，以便在问答场景中高效召回相关上下文并生成回答。

## 边界

- **范围内**：
  - HybridRetriever：向量检索与关键词检索并行执行 + RRF 融合
  - IKeywordStore 接口定义（searchKeywords / KeywordSearchResult / KeywordSearchOptions）
  - reciprocalRankFusion 算法实现
  - DefaultRetrievalPostprocessor：分数过滤 → 可选 rerank → token 预算截断 + maxChunks 限制
  - SelectionTrace：记录 filtering / reranking / budget-trim 每步操作原因
  - runRetrievalPipeline：四阶段流水线（retrieval → post-retrieval → generation），阶段耗时记录
  - runtime/index.ts 统一导出
  - 全部单元测试（AC-09 所列场景）
- **范围外**：
  - 向量数据库具体实现（由 server 的 VectorService 实现 IVectorStore）
  - 关键词存储具体实现（由 server 的 PostgreSQL FTS 实现 IKeywordStore）
  - 嵌入模型具体实现（由 d-12 或 server 提供 IEmbedder）
  - 生成模型具体实现（由 server 提供 IGenerator）
  - 可观测性持久化与 UI（由 d-14 负责）
  - 索引构建流程（由 d-12 负责）

## 涉及模块

- `packages/rag-sdk/src/runtime/hybrid-retriever.ts`
- `packages/rag-sdk/src/runtime/keyword-store.ts`
- `packages/rag-sdk/src/runtime/rrf.ts`
- `packages/rag-sdk/src/runtime/postprocessor.ts`
- `packages/rag-sdk/src/runtime/selection-trace.ts`
- `packages/rag-sdk/src/runtime/pipeline.ts`
- `packages/rag-sdk/src/runtime/index.ts`

## 相关功能

- **上游**：
  - d-11（core 契约层）— 提供 Query / RetrievalCandidate / HybridSearchOptions / IRetriever / IReranker / IGenerator / IVectorStore / IKeywordStore / RuntimePipeline / RuntimeDebugInfo 等类型与接口
- **下游**：
  - d-14（可观测性模块）— 消费 RuntimeDebugInfo / SelectionTrace 进行调试展示
  - d-15（集成验证）— 端到端测试消费完整检索流水线
  - server 模块 — 实现 IVectorStore / IKeywordStore / IReranker / IGenerator 并注入 SDK

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| HybridRetriever 替代旧 MilvusRetriever | 统一支持向量 + 关键词 + RRF，避免 server 侧维护多个检索器 | 否 |
| 并行执行向量检索与关键词检索 | 缩短检索延迟，失败时独立降级 | 否 |
| RRF k 默认 60 | 业界常用默认值，对排名差异敏感适中 | 是（可通过 HybridSearchOptions.rrfK 调整） |
| IKeywordStore 由 SDK 定义契约、server 实现 | 解耦 SDK 与 PostgreSQL FTS 细节，保持 SDK 纯净 | 否 |
| DefaultRetrievalPostprocessor 分层处理：filter → rerank → budget trim | 每层职责单一，便于调试与替换 | 否 |
| SelectionTrace 记录每步操作原因 | 支持可观测性调试，明确结果为何被过滤或截断 | 否 |
| runRetrievalPipeline 四阶段设计（retrieval → post-retrieval → generation） | 与 pipeline.ts 的 RuntimePipeline / RuntimeDebugInfo 类型对齐，预留扩展空间 | 否 |
| 所有类型从 d-11 Zod Schema 推导（z.infer） | 保证运行时校验与编译时类型一致，消除重复定义 | 否 |
| Core 扁平化到 `src/` 根目录 | 单包内减少不必要的目录深度 | 否 |
