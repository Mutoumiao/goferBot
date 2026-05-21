---
issue_id: d-01-rag-sdk-contracts
type: api-spec
status: approved
summary: 纯内部 TypeScript SDK 接口（无 REST 端点），定义 IChunker、IEmbedder、IRetriever、IIndexer 的方法签名与 Chunk、EmbeddingConfig、HybridSearchOptions 等数据类型，以及 RAGError 错误体系。
---
# API Spec: RAG SDK 接口层

> Issue: d-01-rag-sdk-contracts
> 状态: 草案
> 日期: 2026-05-16

---

## 说明

RAG SDK 为**纯内部 SDK 接口**，不暴露任何外部 REST API 端点。所有交互通过 TypeScript 接口在服务端内部进行（Worker、Service 层）。

本文件定义接口签名、配置类型、数据类型和错误类型，用于指导 Phase 5 的实现。

---

## 1. 接口定义

### 1.1 IChunker

文件: `packages/rag-sdk/src/interfaces/IChunker.ts`

```typescript
import type { Chunk, DocumentSource } from './types.js'

/**
 * 文档分块策略抽象。
 * 将文档纯文本内容按策略切分为语义完整的文本块。
 */
export interface IChunker {
  /**
   * 对文档内容进行分块。
   * @param doc — 文档来源信息（含内容、MIME 类型、元数据）
   * @returns 文本块数组，按原文顺序排列
   * @throws ValidationError — 配置非法（如重叠大于分块大小）
   */
  chunk(doc: DocumentSource): Promise<Chunk[]>
}
```

---

### 1.2 IEmbedder

文件: `packages/rag-sdk/src/interfaces/IEmbedder.ts`

```typescript
import type { EmbeddingConfig } from './types.js'

/**
 * 文本向量化抽象。
 * 将字符串数组转换为高维向量数组，用于语义检索。
 */
export interface IEmbedder {
  /**
   * 批量生成文本嵌入向量。
   * @param texts — 待向量化的文本数组（非空）
   * @returns 向量数组，与输入顺序一一对应
   * @throws ValidationError — 输入为空数组
   * @throws EmbeddingError — API 调用失败、返回维度不匹配
   */
  embed(texts: string[]): Promise<number[][]>

  /**
   * 获取当前 Embedder 的配置信息（只读）。
   * 用于调用方校验维度、提供商等元数据。
   */
  readonly config: Readonly<EmbeddingConfig>
}
```

---

### 1.3 IRetriever

文件: `packages/rag-sdk/src/interfaces/IRetriever.ts`

```typescript
import type { ChunkWithScore, HybridSearchOptions } from './types.js'

/**
 * 语义检索抽象。
 * 将用户查询转换为向量，从向量数据库中检索最相关的文本块。
 */
export interface IRetriever {
  /**
   * 执行检索。
   * @param query — 用户原始查询字符串
   * @param kbIds — 目标知识库 ID 数组（支持多知识库联合检索）
   * @param topK — 返回结果数量上限，默认 5
   * @param options — 混合检索参数（预留）
   * @returns 带相似度分数的 Chunk 数组（按分数降序）
   * @throws ValidationError — query 为空或 kbIds 为空
   * @throws RetrievalError — 检索超时或向量库失败
   */
  retrieve(
    query: string,
    kbIds: string[],
    topK?: number,
    options?: HybridSearchOptions
  ): Promise<ChunkWithScore[]>
}
```

---

### 1.4 IIndexer

文件: `packages/rag-sdk/src/interfaces/IIndexer.ts`

```typescript
import type { Chunk } from './types.js'

/**
 * 向量索引写入抽象。
 * 将分块后的文本及其向量批量写入向量数据库，并回写关联 ID。
 */
export interface IIndexer {
  /**
   * 索引 Chunk 及其向量。
   * @param chunks — 文本块数组（已持久化到 PostgreSQL）
   * @param vectors — 与 chunks 一一对应的向量数组
   * @returns void
   * @throws ValidationError — chunks 与 vectors 长度不匹配
   * @throws EmbeddingError — 向量维度不匹配
   * @throws RAGError — 向量库写入失败
   */
  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}
```

---

## 2. 配置类型

文件: `packages/rag-sdk/src/interfaces/types.ts`

### 2.1 EmbeddingConfig

```typescript
/**
 * Embedding 服务配置。
 * 维度从配置读取，不硬编码，支持多种模型。
 */
export interface EmbeddingConfig {
  /** 提供商标识，如 'openai' | 'siliconflow' | 'custom' */
  provider: string

  /** 模型名称，如 'text-embedding-3-small' */
  model: string

  /** 向量维度，如 1536（OpenAI）、1024（bge-large-zh） */
  dimension: number

  /** API 密钥 */
  apiKey: string

  /** 自定义 Base URL（可选，用于私有化部署或代理） */
  baseUrl?: string
}
```

### 2.2 HybridSearchOptions

```typescript
/**
 * 混合检索参数（MVP 预留，Phase 5 后期实现）。
 * 支持向量检索与关键词检索的加权融合（RRF）。
 */
export interface HybridSearchOptions {
  /** 向量检索权重，默认 0.7 */
  vectorWeight?: number

  /** 关键词检索权重，默认 0.3 */
  keywordWeight?: number

  /** RRF 融合参数 k，默认 60 */
  rrfK?: number
}
```

---

## 3. 数据类型

### 3.1 DocumentSource

```typescript
/**
 * 分块器的输入：文档来源信息。
 */
export interface DocumentSource {
  /** 文档 ID（PostgreSQL 主键） */
  documentId: string

  /** 知识库 ID */
  kbId: string

  /** 文档纯文本内容（已由 Parser 提取） */
  content: string

  /** MIME 类型，如 'application/pdf' */
  mimeType: string
}
```

### 3.2 Chunk

```typescript
/**
 * 文本块 — 分块器的输出，索引器的输入。
 */
export interface Chunk {
  /** 块 ID（UUID，由实现生成） */
  id: string

  /** 关联文档 ID */
  documentId: string

  /** 知识库 ID */
  kbId: string

  /** 块文本内容 */
  content: string

  /** 在文档中的顺序索引 */
  chunkIndex: number

  /** Token 数（可选，由实现计算） */
  tokenCount?: number
}
```

### 3.3 ChunkWithScore

```typescript
/**
 * 带相似度分数的文本块 — 检索器的输出。
 */
export interface ChunkWithScore extends Chunk {
  /** 相似度分数（0~1，越高越相似） */
  score: number
}
```

---

## 4. 错误类型

文件: `packages/rag-sdk/src/interfaces/errors.ts`

```typescript
/**
 * RAG SDK 基础错误类。
 */
export class RAGError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'RAGError'
  }
}

/**
 * 向量化阶段错误。
 * 触发场景：API 调用失败、返回维度不匹配、Rate Limit。
 */
export class EmbeddingError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'EmbeddingError'
  }
}

/**
 * 检索阶段错误。
 * 触发场景：向量库超时、搜索失败、结果补全失败。
 */
export class RetrievalError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, cause)
    this.name = 'RetrievalError'
  }
}

/**
 * 参数校验错误。
 * 触发场景：空输入、长度不匹配、配置非法。
 */
export class ValidationError extends RAGError {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}
```

---

## 5. 统一导出

文件: `packages/rag-sdk/src/interfaces/index.ts`

```typescript
export * from './IChunker.js'
export * from './IEmbedder.js'
export * from './IRetriever.js'
export * from './IIndexer.js'
export * from './types.js'
export * from './errors.js'
```

---

## 6. 与 IVectorStore 的类型协作

`IIndexer` 和 `IRetriever` 的实现类需要引用 `packages/server/src/interfaces/IVectorStore.ts` 中的类型：

| RAG SDK 类型 | IVectorStore 类型 | 协作方式 |
|--------------|-------------------|----------|
| `Chunk` | `VectorRecord.chunkId` | `chunk.id` 映射为 `VectorRecord.chunkId` |
| `Chunk.kbId` | `VectorRecord.kbId` | 直接透传 |
| `Chunk.documentId` | `VectorRecord.fileId` | 直接透传 |
| `number[]` (向量) | `VectorRecord.embedding` | 直接透传 |
| `ChunkWithScore.score` | `VectorSearchResult.score` | 直接透传 |

**注意**: RAG SDK 不直接导入 `IVectorStore`，而是通过构造函数注入或实现类内部引用，保持 SDK 包的独立性。

---

## 7. 无 REST API

本 SDK 不注册任何 Hono 路由。如需触发索引，通过以下方式：

- **索引**: BullMQ Worker 内部调用 `IIndexer.index`
- **检索**: Chat API 路由内部调用 `IRetriever.retrieve`
- **配置**: 通过 `GET /settings` 和 `POST /settings` 读取 / 保存 `EmbeddingConfig`
