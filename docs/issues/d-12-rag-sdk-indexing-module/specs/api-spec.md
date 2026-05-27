# API 规格：d-12 RAG SDK 离线索引构建模块

## 模块导出

所有索引构建能力通过 `@goferbot/rag-sdk` 统一导出。

```typescript
import {
  // Chunkers
  RecursiveCharacterChunker,
  // Embedders
  OpenAIEmbedder,
  // Indexers
  MilvusIndexer,
  // Pipeline
  runIndexing,
} from '@goferbot/rag-sdk'
```

---

## Chunker 契约

### RecursiveCharacterChunker

```typescript
class RecursiveCharacterChunker implements IChunker {
  constructor(options?: {
    chunkSize?: number      // 默认 512
    chunkOverlap?: number   // 默认 50，必须 < chunkSize
    separators?: string[]   // 默认 ['\n\n', '\n', ' ', '']
  })

  chunk(doc: DocumentSource): Promise<Chunk[]>
}
```

- **输入**：`DocumentSource`（`documentId` / `kbId` / `content` / `mimeType`）
- **输出**：按 `chunkIndex` 递增排序的 `Chunk[]`
- **字段填充规则**：

| 字段 | 来源 |
|------|------|
| `id` | 每个 chunk 独立生成 UUID（`crypto.randomUUID()`） |
| `documentId` | 继承 `doc.documentId` |
| `kbId` | 继承 `doc.kbId` |
| `content` | 分割后的文本片段 |
| `chunkIndex` | 文档内递增序号，从 `0` 开始 |
| `tokenCount` | `Math.ceil(content.length / 4)`，可选覆盖 |
| `parentId` | 当前版本为 `undefined`（预留 Small-to-Big Retrieval，支持按 header 层级关联） |
| `hierarchyPath` | 若检测到 Markdown/标题层级，填充为 `['# 标题', '## 子标题']` 形式；否则 `undefined` |
| `metadata` | 继承 `doc.mimeType` 为 `{ mimeType: doc.mimeType }` |

- **空文档**：`content` 为空字符串时返回 `[]`
- **超长文本**：按 `separators` 优先级递归分割，确保每个 chunk 长度不超过 `chunkSize`
- **错误**：
  - `ValidationError` — `chunkOverlap >= chunkSize` 时抛出
  - `ValidationError` — `chunkSize <= 0` 时抛出

---

## Embedder 契约

### OpenAIEmbedder

```typescript
class OpenAIEmbedder implements IEmbedder {
  constructor(config: EmbeddingConfig)

  readonly config: Readonly<EmbeddingConfig>

  embed(texts: string[]): Promise<number[][]>
}
```

- **输入**：待嵌入的纯文本数组，长度 >= 1
- **输出**：与输入一一对应的高维向量数组，每个向量长度为 `config.dimension`
- **批量策略**：
  - 内部按 100 条为一批切分，逐批调用 OpenAI Embedding API
  - 使用 `fetch` 发送 HTTP 请求到 `config.baseUrl ?? 'https://api.openai.com/v1/embeddings'`
  - 请求头包含 `Authorization: Bearer ${config.apiKey}` 和 `Content-Type: application/json`
  - 请求体：`{ model: config.model, input: batchTexts }`
- **错误处理**：
  - `ValidationError` — `texts` 为空数组时抛出
  - `EmbeddingError` — HTTP 非 2xx 响应时抛出，携带响应体作为 `cause`
  - `EmbeddingError` — 返回向量维度与 `config.dimension` 不匹配时抛出
  - `EmbeddingError` — 单批部分失败时整批失败，不静默跳过
- **降级策略**：当前版本无自动降级，失败时直接抛出 `EmbeddingError`，由调用方（`runIndexing`）决定重试或标记失败

---

## Indexer 契约

### MilvusIndexer

```typescript
class MilvusIndexer implements IIndexer {
  constructor(vectorStore: IVectorStore)

  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}
```

- **输入**：
  - `chunks` — 已生成的 `Chunk[]`，每个 chunk 必须包含有效的 `id`
  - `vectors` — 与 `chunks` 一一对应的向量数组
- **输出**：无（副作用：通过 `IVectorStore.insertVectors` 写入向量数据库）
- **写入映射**：将 `Chunk[]` 与 `vectors` 组合为 `VectorRecord[]`：

| VectorRecord 字段 | 来源 |
|-------------------|------|
| `id` | `chunk.id`（与 chunk 主键一致，便于关联） |
| `chunkId` | `chunk.id` |
| `kbId` | `chunk.kbId` |
| `fileId` | `chunk.documentId` |
| `embedding` | 对应 `vectors[i]` |

- **错误**：
  - `ValidationError` — `chunks.length !== vectors.length` 时抛出
  - `IndexingError` — `IVectorStore.insertVectors` 失败时抛出，携带原始错误作为 `cause`

---

## Pipeline 契约

### runIndexing

```typescript
async function runIndexing(
  document: DocumentSource,
  dependencies: {
    chunker: IChunker
    embedder: IEmbedder
    indexer: IIndexer
    onStageChange?: (stages: IndexingStage[]) => void | Promise<void>
  },
): Promise<IndexingResult>
```

- **阶段定义**：

| 阶段名 | 职责 |
|--------|------|
| `chunk` | 调用 `chunker.chunk(document)` |
| `embed` | 调用 `embedder.embed(chunks.map(c => c.content))` |
| `index` | 调用 `indexer.index(chunks, vectors)` |

- **状态流转**：

```
pending -> running -> completed
              |
              v
            failed（错误信息写入 stage.error）
```

- **执行顺序**：`chunk` → `embed` → `index`，串行执行
- **短路行为**：任一阶段失败时，后续阶段保持 `pending` 状态，不再执行
- **观测性 Hook**：
  - 每次阶段状态变更后调用 `onStageChange(stages)`
  - 包括：`pending → running`、`running → completed`、`running → failed`
  - 支持同步或异步回调（`await onStageChange(stages)`）
- **返回值**：

```typescript
interface IndexingResult {
  chunks: Chunk[]       // 分块结果（若 chunk 阶段失败则为 []）
  vectorCount: number   // 成功写入的向量数量（若 index 阶段失败则为 0）
  stages: IndexingStage[]
}
```

- **错误**：
  - 各阶段错误由对应组件抛出（`ValidationError` / `EmbeddingError` / `IndexingError`）
  - `runIndexing` 捕获错误后更新 stage 状态并继续抛出，确保调用方感知失败

---

## 统一导出入口

### indexing/index.ts

```typescript
export { RecursiveCharacterChunker } from '../chunkers/recursive-character.chunker.js'
export { OpenAIEmbedder } from '../embedders/openai.embedder.js'
export { MilvusIndexer } from '../indexers/milvus.indexer.js'
export { runIndexing } from '../pipelines/run-indexing.js'
```

根目录 `index.ts` 需追加：

```typescript
export * from './indexing/index.js'
```

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 空文档分块返回空数组 | `tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts` | `AC-01: returns empty array for empty document content` |
| 超长文本递归分块 | `tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts` | `AC-02: splits long text into multiple chunks with correct chunkIndex` |
| chunkOverlap >= chunkSize 校验 | `tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts` | `AC-03: throws ValidationError when chunkOverlap >= chunkSize` |
| 分块字段完整性 | `tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts` | `AC-04: populates documentId, kbId, tokenCount, metadata correctly` |
| OpenAIEmbedder 批量 embed | `tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts` | `AC-05: embeds texts in batches and returns correct dimensions` |
| embed 空数组校验 | `tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts` | `AC-06: throws ValidationError for empty texts array` |
| embed API 失败降级 | `tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts` | `AC-07: throws EmbeddingError on API failure with cause` |
| MilvusIndexer 批量写入 | `tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts` | `AC-08: indexes chunks and vectors via IVectorStore` |
| chunks 与 vectors 长度不一致 | `tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts` | `AC-09: throws ValidationError when chunks and vectors length mismatch` |
| runIndexing 正常流程 | `tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts` | `AC-10: completes all stages and returns IndexingResult` |
| runIndexing 阶段状态追踪 | `tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts` | `AC-11: tracks stage status through pending/running/completed` |
| runIndexing 失败短路 | `tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts` | `AC-12: stops at failed stage and leaves subsequent stages pending` |
| runIndexing onStageChange hook | `tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts` | `AC-13: invokes onStageChange on every status transition` |
| 统一导出完整性 | `tests/issues/d-12-rag-sdk-indexing-module/exports.spec.ts` | `AC-14: exports all indexing modules from indexing/index.ts` |
