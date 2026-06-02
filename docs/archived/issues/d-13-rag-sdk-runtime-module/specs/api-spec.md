---
issue_id: d-13
type: api-spec
status: draft
summary: RAG SDK 在线检索模块的 API 契约，包括混合检索器、关键词存储接口、RRF 融合、检索后处理、选择追踪与流水线编排。所有类型从 d-11 Zod Schema 推导。
---

# API 规格：d-13 RAG SDK 在线检索模块

## 模块导出

所有运行时模块通过 `@goferbot/rag-sdk` 统一导出（由 `runtime/index.ts` 聚合后汇入根 `index.ts`）。

```typescript
import {
  // Hybrid Retriever
  HybridRetriever,
  // Keyword Store
  IKeywordStore, KeywordSearchResult, KeywordSearchOptions,
  // RRF
  reciprocalRankFusion,
  // Postprocessor
  DefaultRetrievalPostprocessor, PostprocessOptions,
  // Selection Trace
  SelectionTrace, SelectionStep,
  // Pipeline
  runRetrievalPipeline,
} from '@goferbot/rag-sdk'
```

---

## 数据模型契约

### KeywordSearchOptions

关键词检索选项，供 `IKeywordStore.search` 使用。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| topK | number | 正整数，可选 | 返回结果数量，默认 10 |
| filters | Record<string, unknown> | 可选 | 附加过滤条件（如文档类型、时间范围） |

### KeywordSearchResult

关键词检索结果单元。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| chunkId | string | UUID 格式 | 关联 Chunk 的 ID |
| score | number | 0 ~ 1 | 关键词匹配分数 |
| content | string | 非空 | 匹配到的文本片段 |
| metadata | Record<string, unknown> | 可选 | 附加元数据 |

### PostprocessOptions

检索后处理配置。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| minScore | number | 0 ~ 1，可选 | 分数过滤阈值，默认 0.3 |
| maxChunks | number | 正整数，可选 | 最大返回 chunk 数，默认 5 |
| tokenBudget | number | 正整数，可选 | 最大 token 预算，默认 2048 |
| enableRerank | boolean | 可选 | 是否启用重排，默认 false |
| reranker | IReranker | 可选 | 重排器实例，enableRerank 为 true 时必须提供 |

### SelectionStep

选择追踪的单个步骤记录。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| stage | string | 非空 | 阶段名称：`filter` / `rerank` / `budget-trim` |
| inputCount | number | 整数 ≥ 0 | 进入该阶段的候选数量 |
| outputCount | number | 整数 ≥ 0 | 离开该阶段的候选数量 |
| reason | string | 非空 | 操作原因描述 |
| droppedIds | string[] | 可选 | 被移除的候选 chunk ID 列表 |

### SelectionTrace

选择追踪完整记录。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| steps | SelectionStep[] | — | 按执行顺序排列的步骤记录 |
| finalCount | number | 整数 ≥ 0 | 最终选中的候选数量 |
| totalDropped | number | 整数 ≥ 0 | 总共被丢弃的候选数量 |

---

## 接口契约

### IKeywordStore

```typescript
interface IKeywordStore {
  search(
    query: string,
    kbIds: string[],
    options?: KeywordSearchOptions,
  ): Promise<KeywordSearchResult[]>
}
```

- **输入**：查询字符串 + 目标知识库 ID 列表 + 可选检索选项
- **输出**：按分数降序排列的 KeywordSearchResult 数组
- **错误**：
  - ValidationError（query 为空字符串或 kbIds 为空数组）
  - RetrievalError（关键词检索执行失败）
- **设计说明**：由 server 的 PostgreSQL FTS 实现，SDK 仅定义契约。
- **兼容性说明**：d-11 的 `interfaces.ts` 中已存在同名接口 `IKeywordStore`，其方法签名返回 `Promise<RetrievalCandidate[]>`。本规格将其扩展为返回 `Promise<KeywordSearchResult[]>`，并新增 `KeywordSearchOptions` 参数。实现时需注意：
  - `HybridRetriever` 内部调用 `IKeywordStore.search` 后，需将 `KeywordSearchResult[]` 转换为 `RetrievalCandidate[]`（source 设为 `'keyword'`）
  - 或选择在 d-11 的 `interfaces.ts` 中直接更新 `IKeywordStore` 签名以匹配本规格

---

## 类契约

### HybridRetriever

实现 `IRetriever` 接口的混合检索器，支持向量检索 + 关键词检索并行执行 + RRF 融合。

```typescript
class HybridRetriever implements IRetriever {
  constructor(
    vectorStore: IVectorStore,
    keywordStore: IKeywordStore,
    embedder: IEmbedder,
  )

  retrieve(
    query: Query,
    topK?: number,
    options?: HybridSearchOptions,
  ): Promise<RetrievalCandidate[]>
}
```

- **入参校验**：
  - `query.original` 为空字符串时抛出 `ValidationError`
  - `query.kbIds` 为空数组时抛出 `ValidationError`
- **并行执行**：
  - 向量分支：`embedder.embed([query.original])` → `vectorStore.searchVectors(queryVector, { topK, filter: { kbId } })`
  - 关键词分支：`keywordStore.search(query.original, query.kbIds, { topK })`
  - 两分支通过 `Promise.allSettled` 并行执行
- **失败降级**：
  - 向量检索失败（rejected）：记录错误，仅使用关键词检索结果，source 标记为 `keyword`
  - 关键词检索失败（rejected）：记录错误，仅使用向量检索结果，source 标记为 `vector`
  - 两者均失败：抛出 `RetrievalError`，cause 包含两个分支的错误信息
- **RRF 融合**：
  - 当两分支均成功时，调用 `reciprocalRankFusion` 进行多路融合
  - 融合后 source 标记为 `hybrid`
- **返回**：按融合分数降序排列的 `RetrievalCandidate[]`，长度不超过 `topK`（默认 5）

---

### reciprocalRankFusion

RRF 多路融合算法。

```typescript
function reciprocalRankFusion(
  sources: Array<{ candidates: RetrievalCandidate[]; weight?: number }>,
  k?: number,
): RetrievalCandidate[]
```

- **参数**：
  - `sources`：多路检索结果，每路包含候选列表与可选权重（当前版本权重预留，实际计算暂不使用）
  - `k`：RRF 常数，默认 60
- **算法**：对每个候选，累加各来源中的 `1 / (k + rank)`，得到融合分数；按融合分数降序排列
- **去重**：同一 chunk（按 `chunk.id` 判断）在多个来源中出现时，取最高排名（最小 rank）计算
- **返回**：按融合分数降序排列的 `RetrievalCandidate[]`，source 统一标记为 `hybrid`

---

### DefaultRetrievalPostprocessor

默认检索后处理器，执行分层处理：filter → rerank → budget trim。

```typescript
class DefaultRetrievalPostprocessor {
  process(
    candidates: RetrievalCandidate[],
    query: Query,
    options?: PostprocessOptions,
  ): Promise<{ candidates: RetrievalCandidate[]; trace: SelectionTrace }>
}
```

- **Stage 1 — 分数过滤（filter）**：
  - 移除 `score < minScore`（默认 0.3）的候选
  - `SelectionTrace` 记录：`stage: 'filter'`，`reason: 'score below threshold {minScore}'`
- **Stage 2 — 重排（rerank）**（可选）：
  - 仅当 `enableRerank === true` 且 `reranker` 存在时执行
  - 调用 `reranker.rerank(candidates, query)`
  - `SelectionTrace` 记录：`stage: 'rerank'`，`reason: 'reranker reordering'`
- **Stage 3 — Token 预算截断（budget-trim）**：
  - 按当前顺序累加 `chunk.tokenCount`，当超过 `tokenBudget`（默认 2048）时截断
  - 若 `maxChunks`（默认 5）先达到，则按 `maxChunks` 截断
  - `SelectionTrace` 记录：`stage: 'budget-trim'`，`reason: 'token budget {tokenBudget} or maxChunks {maxChunks}'`
- **返回**：处理后的候选列表 + 完整的 `SelectionTrace`

---

### runRetrievalPipeline

检索流水线编排函数。

```typescript
function runRetrievalPipeline(
  deps: {
    retriever: IRetriever
    postprocessor: DefaultRetrievalPostprocessor
    generator: IGenerator
  },
  query: Query,
  options?: {
    topK?: number
    hybridOptions?: HybridSearchOptions
    postprocessOptions?: PostprocessOptions
  },
): Promise<RuntimePipelineResult>
```

- **四阶段设计**：
  1. **retrieval**：调用 `retriever.retrieve(query, topK, hybridOptions)`
  2. **post-retrieval**：调用 `postprocessor.process(candidates, query, postprocessOptions)`
  3. **generation**：调用 `generator.generate({ query, chunks: selectedChunks })`
- **阶段耗时记录**：
  - 每个 `RuntimeStage` 记录 `startTime` / `endTime`（`Date.now()` 毫秒时间戳）
  - `RuntimeDebugInfo.metrics.latencyMs` 为总耗时
- **DebugInfo 收集**：
  - `traceId`：每次调用生成唯一 UUID
  - `query`：原始 Query 对象
  - `stages`：按顺序排列的 RuntimeStage 数组
  - `metrics`：
    - `retrievalCount`：检索阶段返回的候选总数
    - `selectedCount`：后处理阶段最终选中的候选数
    - `droppedCount`：`retrievalCount - selectedCount`
    - `totalTokens`：选中候选的 `tokenCount` 总和
    - `latencyMs`：总耗时
- **错误处理**：
  - 任一阶段失败时，将错误信息写入当前 `RuntimeStage.error`，并向上抛出原始错误
  - 检索阶段失败抛出 `RetrievalError`
  - 生成阶段失败抛出 `RAGError`（由 generator 实现决定）

---

## 错误契约

| 错误类 | 继承 | 使用场景 | cause 支持 |
|--------|------|----------|------------|
| ValidationError | RAGError | query.original 为空、kbIds 为空数组、postprocess 参数非法 | 否 |
| RetrievalError | RAGError | 向量检索失败、关键词检索失败、RRF 融合异常 | 是 |
| RAGError | Error | 生成阶段失败、其他未分类错误 | 是 |

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 空查询校验 | `tests/issues/d-13-rag-sdk-runtime-module/hybridRetriever.spec.ts` | `AC-01: throws ValidationError on empty query.original` |
| 空 kbIds 校验 | `tests/issues/d-13-rag-sdk-runtime-module/hybridRetriever.spec.ts` | `AC-01: throws ValidationError on empty kbIds` |
| 向量检索失败降级 | `tests/issues/d-13-rag-sdk-runtime-module/hybridRetriever.spec.ts` | `AC-01: falls back to keyword results when vector fails` |
| 关键词检索失败降级 | `tests/issues/d-13-rag-sdk-runtime-module/hybridRetriever.spec.ts` | `AC-01: falls back to vector results when keyword fails` |
| RRF 融合正确性 | `tests/issues/d-13-rag-sdk-runtime-module/rrf.spec.ts` | `AC-03: fuses multi-source results with correct scores` |
| RRF 默认 k=60 | `tests/issues/d-13-rag-sdk-runtime-module/rrf.spec.ts` | `AC-03: uses default k=60` |
| RRF source 标记 hybrid | `tests/issues/d-13-rag-sdk-runtime-module/rrf.spec.ts` | `AC-03: marks fused results source as hybrid` |
| 后处理分数过滤 | `tests/issues/d-13-rag-sdk-runtime-module/postprocessor.spec.ts` | `AC-04: filters candidates below minScore` |
| 后处理 rerank | `tests/issues/d-13-rag-sdk-runtime-module/postprocessor.spec.ts` | `AC-04: reranks when enableRerank is true` |
| 后处理 token 预算截断 | `tests/issues/d-13-rag-sdk-runtime-module/postprocessor.spec.ts` | `AC-04: trims candidates by token budget` |
| 后处理 maxChunks 限制 | `tests/issues/d-13-rag-sdk-runtime-module/postprocessor.spec.ts` | `AC-04: respects maxChunks limit` |
| SelectionTrace 记录过滤 | `tests/issues/d-13-rag-sdk-runtime-module/selectionTrace.spec.ts` | `AC-05: records filter step reason` |
| SelectionTrace 记录 rerank | `tests/issues/d-13-rag-sdk-runtime-module/selectionTrace.spec.ts` | `AC-05: records rerank step reason` |
| SelectionTrace 记录预算截断 | `tests/issues/d-13-rag-sdk-runtime-module/selectionTrace.spec.ts` | `AC-05: records budget-trim step reason` |
| 流水线阶段耗时记录 | `tests/issues/d-13-rag-sdk-runtime-module/pipeline.spec.ts` | `AC-06: records stage timing in RuntimeDebugInfo` |
| 流水线 DebugInfo 指标 | `tests/issues/d-13-rag-sdk-runtime-module/pipeline.spec.ts` | `AC-06: populates retrievalCount/selectedCount/droppedCount/totalTokens/latencyMs` |
| runtime/index.ts 统一导出 | `tests/issues/d-13-rag-sdk-runtime-module/exports.spec.ts` | `AC-07: exports all runtime modules from runtime/index.ts` |
| pnpm type-check 通过 | `tests/issues/d-13-rag-sdk-runtime-module/typecheck.spec.ts` | `AC-08: passes pnpm type-check` |
