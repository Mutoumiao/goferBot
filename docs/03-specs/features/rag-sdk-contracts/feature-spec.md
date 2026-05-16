# Feature Spec: RAG SDK 接口层

> Issue: d-01-rag-sdk-contracts
> 状态: 草案
> 日期: 2026-05-16

---

## 1. 用户故事

作为系统，我需要标准化的 RAG 流水线接口，以便支持多种解析 / 分块 / 向量化 / 检索策略，使 Phase 5 的实现只需遵循接口而无需修改消费方代码。

---

## 2. 范围

### 2.1 范围内

- `IChunker` 接口定义 — 文档分块策略抽象
- `IEmbedder` 接口定义 — 文本向量化抽象
- `IRetriever` 接口定义 — 语义检索抽象
- `IIndexer` 接口定义 — 向量索引写入抽象
- 配置类型：`EmbeddingConfig`、`HybridSearchOptions`
- 数据类型：`Chunk`、`ChunkWithScore`、`DocumentSource`
- 统一导出：`packages/rag-sdk/src/interfaces/index.ts`
- 错误类型：`RAGError`、`EmbeddingError`、`RetrievalError`

### 2.2 范围外

- SDK 具体实现（Phase 5 负责）
- Reranker 接口（Phase 5 后期）
- 多模态解析（图片、音频、视频）
- 具体 Parser（PDF、Word、Markdown 等）

---

## 3. 涉及组件

| 组件 | 路径 | 职责 |
|------|------|------|
| IChunker | `packages/rag-sdk/src/interfaces/IChunker.ts` | 将文档内容按策略切分为文本块 |
| IEmbedder | `packages/rag-sdk/src/interfaces/IEmbedder.ts` | 将文本数组转换为向量数组 |
| IRetriever | `packages/rag-sdk/src/interfaces/IRetriever.ts` | 执行语义检索，返回带分数的 Chunk |
| IIndexer | `packages/rag-sdk/src/interfaces/IIndexer.ts` | 将 Chunk 与向量写入向量数据库 |
| 统一导出 | `packages/rag-sdk/src/interfaces/index.ts` | 类型与接口的集中导出 |
| IVectorStore 消费方 | `packages/server/src/interfaces/IVectorStore.ts` | IIndexer / IRetriever 的底层依赖 |
| IStorageProvider 消费方 | `packages/server/src/interfaces/IStorageProvider.ts` | 文档下载与内容获取 |

---

## 4. 依赖关系

### 4.1 与 i-04-milvus-client 的关系

- `IRetriever.retrieve` 依赖 `IVectorStore.searchVectors` 执行 ANN 搜索。
- `IIndexer.index` 依赖 `IVectorStore.insertVectors` 写入向量。
- RAG SDK 不直接依赖 `@zilliz/milvus2-sdk-node`，只通过 `IVectorStore` 接口交互。

### 4.2 与 i-05-redis-bullmq-setup 的关系

- `IIndexer` 的实现可能在 BullMQ Worker 中异步执行（文档解析流水线）。
- Worker 占位逻辑中预留 `parse → chunk → embed → index` 四阶段，本接口定义了 `chunk`、`embed`、`index` 三阶段的契约。

### 4.3 与 i-00-core-interfaces 的关系

- `IVectorStore` 和 `IStorageProvider` 已在 `packages/server/src/interfaces` 中定义。
- RAG SDK 的接口位于独立的 `packages/rag-sdk/src/interfaces`，供前后端共享类型（未来前端可能离线使用 SDK）。

---

## 5. 关键设计决策

| 决策 | 说明 |
|------|------|
| 嵌入维度从配置读取 | 不硬编码 1536，支持 OpenAI 1536 / bge-large-zh 1024 / 自定义模型等 |
| 混合检索参数预留 | `HybridSearchOptions` 预留 `vectorWeight`、`keywordWeight`、`rrfK`，Phase 5 实现 |
| 接口与实现分离 | SDK 只定义接口和类型，具体实现由 Phase 5 注入 |
| 错误独立体系 | RAG SDK 定义专属错误类，与 server 的 `RepositoryError` 体系平行但独立 |
| Node16 模块解析 | 所有导入使用 `.js` 扩展名 |

---

## 6. 配置项

| 配置字段 | 类型 | 说明 |
|----------|------|------|
| `provider` | `string` | 提供商标识，如 `'openai'`、`'siliconflow'`、`'custom'` |
| `model` | `string` | 模型名称，如 `'text-embedding-3-small'` |
| `dimension` | `number` | 向量维度，如 `1536`、`1024` |
| `apiKey` | `string` | API 密钥 |
| `baseUrl` | `string` | 自定义 Base URL（可选） |

---

## 7. 非功能性需求

- 接口定义必须支持 Tree-shaking，避免前端打包时引入未使用的类型。
- 所有方法签名必须包含 JSDoc，说明参数、返回值、错误场景。
- 类型定义零运行时依赖（仅依赖 TypeScript 内置类型和 `IVectorStore` 类型引用）。
