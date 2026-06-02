# 功能规格：d-12 RAG SDK 离线索引构建模块

## 用户故事

作为 GoferBot 后端开发者，我希望 RAG SDK 提供完整的离线索引构建能力，以便在异步流水线中将文档分块、向量化并写入向量数据库。

## 边界

- **范围内**：
  - `RecursiveCharacterChunker`：基于字符递归分割的文档分块器
  - `OpenAIEmbedder`：基于 OpenAI Embedding API 的文本向量化器
  - `MilvusIndexer`：通过 `IVectorStore` 接口批量写入向量索引
  - `runIndexing`：编排 chunk → embed → index 的流水线函数
  - `indexing/index.ts`：统一导出入口
  - 原 `adapters` 模块清理（删除旧适配器目录）
- **范围外**：
  - 文档解析（Parser）由 server 负责，输出 `DocumentSource` 后传入 SDK
  - 向量数据库连接管理（由 server 的 `VectorService` 实现 `IVectorStore`）
  - 运行时检索（由 d-13 负责）
  - 可观测性持久化（由 d-14 负责，d-12 仅提供 stage 状态数组）
  - 前端 UI 行为（本 issue 为设计轨道 SDK，无 behavior-spec）

## 涉及模块

- `packages/rag-sdk/src/chunkers/recursive-character.chunker.ts`
- `packages/rag-sdk/src/embedders/openai.embedder.ts`
- `packages/rag-sdk/src/indexers/milvus.indexer.ts`
- `packages/rag-sdk/src/pipelines/run-indexing.ts`
- `packages/rag-sdk/src/indexing/index.ts`

## 相关功能

- **上游**：d-11（core 契约层）— 提供 `DocumentSource`、`Chunk`、`EmbeddingConfig`、`IChunker`、`IEmbedder`、`IIndexer`、`IVectorStore`、`IndexingResult`、`IndexingStage` 及错误体系
- **下游**：
  - server BullMQ Worker — 调用 `runIndexing` 执行异步索引任务
  - d-13（运行时检索模块）— 消费 Milvus 中已写入的向量
  - d-14（可观测性模块）— 消费 `IndexingStage[]` 进行持久化与展示

## 已做决策

| 决策 | 理由 | 可逆？ |
|------|------|--------|
| Core 扁平化到 `src/` 根目录 | 单包内减少目录深度，与 d-11 保持一致 | 否 |
| 删除旧 `adapters` 模块 | 旧 `backendAdapters` / `shellAdapters` 已废弃，避免命名冲突 | 否 |
| `OpenAIEmbedder` 直接放在 `indexing/embedders/` | 扁平化后按功能域组织，不再使用 `adapters` 命名 | 否 |
| `RecursiveCharacterChunker` 支持 `parentId` / `hierarchyPath` | 为 Small-to-Big Retrieval 预留层级索引能力 | 是（可选字段，不影响现有接口） |
| `MilvusIndexer` 通过注入的 `IVectorStore` 写入 | 彻底解耦对 `@zilliz/milvus2-sdk-node` 的依赖，server 负责连接管理 | 否 |
| `runIndexing` 内置 `IndexingStage[]` 状态追踪 | 满足 Worker 状态上报需求，不依赖外部可观测性模块 | 是（数据结构可扩展） |
| 所有类型由 Zod Schema 推导（`z.infer`） | 与 d-11 保持一致，运行时校验与编译时类型统一 | 否 |
| `tokenCount` 使用简单字符估算（`Math.ceil(content.length / 4)`） | 不引入 `tiktoken` 等外部依赖，保持 SDK 轻量；server 可覆盖为精确值 | 是 |
