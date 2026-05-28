# API 规格：SDK Embedder 接口扩展（embedWithUsage + TokenUsage）

> Issue: d-20-rag-sdk-embedder-token-usage
> 版本: v1.0
> 日期: 2026-05-28

---

## 1. 类型定义

### 1.1 TokenUsage

```typescript
/**
 * 单条文本的 Token 用量。
 *
 * 由 IEmbedder.embedWithUsage() 返回，供下游 IIndexer 写入精确 tokenCount。
 * promptTokens 与 totalTokens 在 Embedding 场景下通常相等，因为 Embedding API
 * 不生成输出 token，保留两个字段以兼容未来可能产生 completion token 的 embedder。
 */
export interface TokenUsage {
  /** 输入文本消耗的 prompt token 数（非负整数）。 */
  promptTokens: number

  /** 总 token 数（prompt + completion）。在纯 Embedding 场景下等于 promptTokens。 */
  totalTokens: number
}
```

**约束：**
- `promptTokens >= 0`
- `totalTokens >= promptTokens`
- 实际值由 embedder 实现类填充，调用方不应假设具体数值。

### 1.2 EmbedWithUsageResult

```typescript
/**
 * embedWithUsage() 的返回结构。
 *
 * vectors 与 usage 数组长度严格等于输入 texts 的长度，且按相同索引一一对应。
 */
export interface EmbedWithUsageResult {
  /** 向量化结果。vectors[i] 对应 texts[i] 的嵌入向量。 */
  vectors: number[][]

  /** 逐条 token 用量。usage[i] 对应 texts[i] 的用量。 */
  usage: TokenUsage[]
}
```

**约束：**
- `vectors.length === usage.length === texts.length`
- 每个 `vectors[i].length` 必须等于 `EmbeddingConfig.dimension`

---

## 2. 接口签名

### 2.1 IEmbedder（变更后）

```typescript
export interface IEmbedder {
  /**
   * 将字符串数组转换为高维向量数组。
   *
   * 空数组输入应抛出 ValidationError，维度不匹配时应抛出 EmbeddingError。
   * 本方法签名与行为保持不变，确保向后兼容。
   */
  embed(texts: string[]): Promise<number[][]>

  /**
   * 将字符串数组转换为高维向量数组，并返回逐条 token 用量。
   *
   * 空数组输入应抛出 ValidationError，维度不匹配时应抛出 EmbeddingError。
   * 网络或 API 失败时应抛出 EmbeddingError，并保留 cause 链。
   *
   * 本方法为可选扩展。实现类可选择不实现，调用方通过 `in` 检查或能力检测后降级到 `embed()`。
   */
  embedWithUsage?(texts: string[]): Promise<EmbedWithUsageResult>

  /** 只读嵌入配置。 */
  readonly config: Readonly<EmbeddingConfig>
}
```

### 2.2 IIndexer（变更后）

```typescript
export interface IIndexer {
  /**
   * 将分块后的文本及其向量批量写入向量数据库。
   *
   * @param chunks  文本块数组
   * @param vectors 向量数组，长度必须与 chunks 一致
   * @param usage   可选的逐条 token 用量。当提供且长度与 chunks 一致时，
   *                实现类应优先使用 usage[i].promptTokens 作为 tokenCount。
   *
   * 约束：
   * - chunks.length !== vectors.length 时应抛出 ValidationError。
   * - chunks.length === 0 时应视为空操作，直接返回。
   * - usage 存在但 usage.length !== chunks.length 时，实现类可选择抛出 ValidationError
   *   或忽略 usage 回退到估算值（推荐后者，增强容错）。
   */
  index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void>
}
```

---

## 3. 实现类规范

### 3.1 OpenAIEmbedder

**文件：** `packages/rag-sdk/src/embedders/openai.embedder.ts`

**新增方法：**

```typescript
async embedWithUsage(texts: string[]): Promise<EmbedWithUsageResult> {
  if (texts.length === 0) {
    throw new ValidationError('texts array must not be empty')
  }

  const batchSize = 100
  const results: number[][] = []
  const usages: TokenUsage[] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    const { vectors, usage } = await this.embedBatchWithUsage(batch)
    results.push(...vectors)
    usages.push(...usage)
  }

  for (const vec of results) {
    if (vec.length !== this.config.dimension) {
      throw new EmbeddingError(
        `Expected dimension ${this.config.dimension}, got ${vec.length}`
      )
    }
  }

  return { vectors: results, usage: usages }
}

private async embedBatchWithUsage(texts: string[]): Promise<EmbedWithUsageResult> {
  const url = this.config.baseUrl ?? 'https://api.openai.com/v1/embeddings'
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.config.apiKey}`,
    },
    body: JSON.stringify({
      model: this.config.model,
      input: texts,
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new EmbeddingError(`Embedding API error: ${response.status} ${text}`, new Error(text))
  }

  const data = await response.json()
  const vectors: number[][] = data.data.map((item: { embedding: number[] }) => item.embedding)

  // OpenAI Embedding API 返回整个 batch 的 usage，需按文本长度比例分配
  const totalTokens = data.usage?.prompt_tokens ?? 0
  const totalLength = texts.reduce((sum, t) => sum + t.length, 0)

  let usage: TokenUsage[]
  if (totalTokens === 0) {
    usage = texts.map(() => ({ promptTokens: 0, totalTokens: 0 }))
  } else if (totalLength === 0) {
    // 所有文本长度均为 0，平均分配
    const avg = Math.round(totalTokens / texts.length)
    usage = texts.map(() => ({ promptTokens: avg, totalTokens: avg }))
  } else {
    usage = texts.map(text => {
      const promptTokens = Math.round((text.length / totalLength) * totalTokens)
      return { promptTokens, totalTokens: promptTokens }
    })
  }

  // 修正舍入误差：确保总和等于 API 返回的总量
  const distributedSum = usage.reduce((sum, u) => sum + u.promptTokens, 0)
  const diff = totalTokens - distributedSum
  if (diff !== 0 && usage.length > 0) {
    usage[usage.length - 1].promptTokens += diff
    usage[usage.length - 1].totalTokens += diff
  }

  return { vectors, usage }
}
```

**关键行为：**
- 分批逻辑与 `embed()` 完全一致，确保性能不变。
- 比例分配后执行舍入误差修正，将差值加到最后一项，保证总和严格等于 API 返回值。
- `totalTokens` 在 Embedding 场景下等于 `promptTokens`。

### 3.2 MilvusIndexer（不变更行为，签名适配）

**文件：** `packages/rag-sdk/src/indexers/milvus.indexer.ts`

```typescript
async index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void> {
  // 现有逻辑不变，忽略 usage 参数
  // ...
}
```

### 3.3 runIndexing（内部调用变更）

**文件：** `packages/rag-sdk/src/pipelines/run-indexing.ts`

**变更点：**

```typescript
// Stage 2: embed — 检测 embedder 是否支持 embedWithUsage，降级为 embed
stages[1].status = 'running'
await notify()
let vectors: number[][]
let usage: TokenUsage[] | undefined
if ('embedWithUsage' in embedder && typeof embedder.embedWithUsage === 'function') {
  const embedResult = await embedder.embedWithUsage(chunks.map(c => c.content))
  vectors = embedResult.vectors
  usage = embedResult.usage
} else {
  vectors = await embedder.embed(chunks.map(c => c.content))
}
stages[1].status = 'completed'
await notify()

// Stage 3: index — 传入 usage（若可用）
stages[2].status = 'running'
await notify()
await indexer.index(chunks, vectors, usage)
stages[2].status = 'completed'
await notify()
```

---

## 4. 错误场景

| 场景 | 触发条件 | 错误类型 | 错误消息示例 |
|------|----------|----------|--------------|
| 空输入数组 | `texts.length === 0` | `ValidationError` | `texts array must not be empty` |
| 向量维度不匹配 | `vec.length !== config.dimension` | `EmbeddingError` | `Expected dimension 1536, got 768` |
| API 网络失败 | `fetch()` 抛出 | `EmbeddingError` | `Embedding API error: 503 ...` |
| API 鉴权失败 | HTTP 401/403 | `EmbeddingError` | `Embedding API error: 401 ...` |
| chunks 与 vectors 长度不匹配 | `chunks.length !== vectors.length` | `ValidationError` | `chunks length 5 != vectors length 4` |
| usage 长度不匹配（可选严格检查） | `usage.length !== chunks.length` | `ValidationError`（可选） | `usage length 5 != chunks length 4` |

---

## 5. 导出变更

**文件：** `packages/rag-sdk/src/index.ts`

新增导出：

```typescript
export type { TokenUsage, EmbedWithUsageResult } from './types.js'
```

> 注：`TokenUsage` 和 `EmbedWithUsageResult` 需先加入 `types.ts` 或 `schema.ts` 中定义，再统一从 `index.ts` 导出。

---

## 6. 测试映射

| 测试文件路径 | 用例名 | 覆盖点 |
|--------------|--------|--------|
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage returns vectors and usage for single text` | 单条输入，返回值结构正确 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage returns vectors and usage for multiple texts` | 多条输入，usage 长度匹配 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage distributes total tokens proportionally by text length` | 比例分配，总和校验 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage handles missing usage field` | API 无 usage 时降级为 0 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage throws ValidationError for empty array` | 空输入校验 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage handles batching correctly` | 大批次分批，usage 合并顺序 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage distributes evenly when all texts are empty` | 边界：全空文本平均分配 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage corrects rounding error to match total` | 舍入误差修正 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/run-indexing-usage.spec.ts` | `runIndexing passes usage to indexer when embedder supports embedWithUsage` | 流水线端到端 usage 传递 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/run-indexing-usage.spec.ts` | `runIndexing still works when indexer ignores usage` | indexer 不消费 usage 时正常 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/run-indexing-usage.spec.ts` | `runIndexing falls back to embed when embedder lacks embedWithUsage` | 可选方法降级路径 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/interfaces.spec.ts` | `IEmbedder interface allows optional embedWithUsage method` | 接口契约编译期检查 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/interfaces.spec.ts` | `IIndexer index method accepts optional usage parameter` | 接口契约编译期检查 |
