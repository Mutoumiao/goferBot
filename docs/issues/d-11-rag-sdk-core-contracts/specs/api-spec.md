# API 规格：d-11 RAG SDK Core 契约层

## 模块导出

所有契约通过 `@goferbot/rag-sdk` 统一导出。

```typescript
import {
  // Schema
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  ChunkWithScoreSchema, RetrievalCandidateSchema,
  EmbeddingConfigSchema, HybridSearchOptionsSchema,
  // 类型（由 z.infer 推导）
  DocumentSource, Query, Chunk, ChunkWithScore,
  RetrievalCandidate, EmbeddingConfig, HybridSearchOptions,
  // 接口
  IChunker, IEmbedder, IIndexer, IRetriever, IReranker,
  IGenerator, IVectorStore, IKeywordStore,
  // 向量存储
  VectorRecord, VectorSearchOptions, VectorSearchResult,
  // Pipeline
  IndexingStage, IndexingResult, IndexingPipeline,
  RuntimeStage, RuntimeDebugInfo, RuntimePipelineResult, RuntimePipeline,
  // 错误
  RAGError, EmbeddingError, RetrievalError, ValidationError, IndexingError,
} from '@goferbot/rag-sdk'
```

---

## 数据模型契约

### DocumentSource

文档源输入，由 server 的 Parser 产出后传入 IChunker。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| documentId | string | UUID 格式 | 文档在 PostgreSQL 中的持久化 ID |
| kbId | string | UUID 格式 | 所属知识库 ID |
| content | string | 非空 | 文档纯文本内容（已提取） |
| mimeType | string | 非空 | MIME 类型，如 `text/plain` |

### Query

结构化查询对象，支持重写、扩展、过滤。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| original | string | 非空 | 用户原始输入 |
| rewritten | string | 可选 | 重写后的查询 |
| expanded | string[] | 可选 | 扩展查询词 |
| kbIds | string[] | 至少 1 个 UUID | 目标知识库 ID 列表 |
| filters | Record<string, unknown> | 可选 | 附加过滤条件 |

### Chunk

文本块，IChunker 的输出单元。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | string | UUID 格式 | 块全局唯一 ID |
| documentId | string | UUID 格式 | 来源文档 ID |
| kbId | string | UUID 格式 | 所属知识库 ID |
| content | string | 非空 | 块纯文本内容 |
| chunkIndex | number | 整数 ≥ 0 | 块在文档内的递增序号 |
| tokenCount | number | 整数，可选 | 预估 token 数 |
| parentId | string | UUID 格式，可选 | 父 chunk ID（Small-to-Big Retrieval） |
| hierarchyPath | string[] | 可选 | 层级路径 |
| metadata | object | 可选 | 附加元数据（JSON-safe） |

### ChunkWithScore

继承 Chunk，增加 score 字段。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| score | number | 0 ~ 1 | 相关度分数 |

### RetrievalCandidate

检索候选，包含 chunk、分数、来源等完整信息。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| chunk | Chunk | — | 候选 chunk |
| score | number | 0 ~ 1 | 相关度分数 |
| source | enum | `vector` / `keyword` / `hybrid` | 检索来源 |
| route | string | 可选 | 检索路由信息 |
| metadata | Record<string, unknown> | 可选 | 附加元数据 |

### EmbeddingConfig

向量化配置。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| provider | string | 非空 | 提供商标识 |
| model | string | 非空 | 模型名称 |
| dimension | number | 正整数 | 输出向量维度 |
| apiKey | string | — | API 密钥 |
| baseUrl | string | URL 格式，可选 | 自定义 API 基础地址 |

### HybridSearchOptions

混合检索参数。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| rrfK | number | 正整数，可选 | RRF 融合参数 k，默认 60 |
| vectorWeight | number | 0 ~ 1，可选 | 向量检索权重（预留） |
| keywordWeight | number | 0 ~ 1，可选 | 关键词检索权重（预留） |

---

## 接口契约

### IChunker

```typescript
interface IChunker {
  chunk(doc: DocumentSource): Promise<Chunk[]>
}
```

- **输入**：DocumentSource（documentId / kbId / content / mimeType）
- **输出**：按 chunkIndex 递增排序的 Chunk 数组
- **错误**：ValidationError（输入内容格式非法或分块参数冲突）

### IEmbedder

```typescript
interface IEmbedder {
  embed(texts: string[]): Promise<number[][]>
  readonly config: Readonly<EmbeddingConfig>
}
```

- **输入**：待嵌入的纯文本数组，长度 ≥ 1
- **输出**：与输入一一对应的高维向量数组
- **错误**：
  - ValidationError（texts 为空数组）
  - EmbeddingError（嵌入 API 失败或返回维度不匹配）

### IIndexer

```typescript
interface IIndexer {
  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}
```

- **输入**：已持久化到 PostgreSQL 的 Chunk 数组 + 对应向量数组
- **输出**：无（副作用：写入向量索引）
- **错误**：
  - ValidationError（chunks 与 vectors 长度不一致）
  - EmbeddingError（向量维度与配置不匹配）
  - RAGError（向量库写入失败）

### IRetriever

```typescript
interface IRetriever {
  retrieve(
    query: Query,
    topK?: number,
    options?: HybridSearchOptions,
  ): Promise<RetrievalCandidate[]>
}
```

- **输入**：Query 对象 + topK（默认 5）+ HybridSearchOptions
- **输出**：按 RRF 融合分数降序排列的 RetrievalCandidate 数组
- **错误**：
  - ValidationError（query.original 为空或 query.kbIds 为空数组）
  - RetrievalError（检索执行失败）

### IReranker

```typescript
interface IReranker {
  rerank(candidates: RetrievalCandidate[], query: Query): Promise<RetrievalCandidate[]>
}
```

- **输入**：初始检索结果 + 原始查询
- **输出**：按重排分数降序排列的 RetrievalCandidate 数组

### IGenerator

```typescript
interface IGenerator {
  generate(input: { query: Query; chunks: Chunk[] }): Promise<string>
}
```

- **输入**：Query 对象 + 选中的上下文 chunks
- **输出**：生成的回答文本

### IVectorStore

```typescript
interface IVectorStore {
  insertVectors(vectors: VectorRecord[]): Promise<void>
  searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>
  deleteByIds(ids: string[]): Promise<void>
  ensureCollection(): Promise<void>
}
```

- **设计说明**：server 的 VectorService 实现此接口，通过构造函数注入 SDK

### IKeywordStore（新增）

```typescript
interface IKeywordStore {
  search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]>
}
```

- **设计说明**：server 的 PostgreSQL FTS 实现此接口，支持混合检索的关键词分支

---

## Pipeline 契约

### IndexingPipeline

```typescript
type IndexingPipeline = (document: DocumentSource) => Promise<IndexingResult>

interface IndexingResult {
  chunks: Chunk[]
  vectorCount: number
  stages: IndexingStage[]
}

interface IndexingStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}
```

### RuntimePipeline

```typescript
type RuntimePipeline = (query: Query) => Promise<RuntimePipelineResult>

interface RuntimePipelineResult {
  answer: string
  chunks: Chunk[]
  debugInfo: RuntimeDebugInfo
}

interface RuntimeDebugInfo {
  traceId: string
  query: Query
  stages: RuntimeStage[]
  metrics: {
    retrievalCount: number
    selectedCount: number
    droppedCount: number
    totalTokens: number
    latencyMs: number
  }
}

interface RuntimeStage {
  name: string
  startTime: number
  endTime: number
  input: unknown
  output: unknown
  error?: string
}
```

---

## 错误契约

| 错误类 | 继承 | 使用场景 | cause 支持 |
|--------|------|----------|------------|
| RAGError | Error | 基类，所有 RAG 相关错误 | 是 |
| EmbeddingError | RAGError | 嵌入 API 失败、维度不匹配 | 是 |
| RetrievalError | RAGError | 检索执行失败 | 是 |
| ValidationError | RAGError | 输入校验失败 | 否 |
| IndexingError | RAGError | 索引写入失败 | 是 |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| Schema 校验通过 | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-01: validates valid DocumentSource` |
| Schema 校验失败（空字符串） | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-02: rejects empty content in DocumentSource` |
| Schema 校验失败（负数） | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-03: rejects negative chunkIndex in Chunk` |
| Schema 校验失败（非法 UUID） | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-04: rejects invalid UUID format` |
| 错误 cause 链 | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-05: preserves error cause chain` |
| 类型推导一致性 | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-06: infers correct types from Zod schemas` |
| 统一导出完整性 | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-07: exports all contracts from index.ts` |
| Pipeline 类型结构 | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-08: validates IndexingStage status enum` |
| IVectorStore 接口形状 | `tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts` | `AC-09: IVectorStore has required methods (insertVectors, searchVectors, deleteByIds, ensureCollection)` |
