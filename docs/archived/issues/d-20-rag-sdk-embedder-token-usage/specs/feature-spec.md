# 功能规格：SDK Embedder 接口扩展（embedWithUsage + TokenUsage）

> Issue: d-20-rag-sdk-embedder-token-usage
> 版本: v1.0
> 日期: 2026-05-28

---

## 1. 用户故事

### US-1: 精确 Token 计数
作为索引流水线的开发者，
我希望 `IEmbedder` 在返回向量的同时返回每个输入文本消耗的 token 数，
以便 `IIndexer` 能将精确的 `tokenCount` 写入数据库，替代不准确的字符长度估算。

**验收标准：**
- `embedWithUsage()` 返回的 `usage` 数组长度与输入文本数组长度一致。
- `TokenUsage.promptTokens` 为大于等于 0 的整数。
- 当 Embedding API 返回总量时，按文本长度比例分配到各 chunk，分配后总和等于 API 返回的总量（允许 ±1 的舍入误差）。

### US-2: 向后兼容
作为现有 SDK 用户，
我希望 `embed()` 方法的签名和行为保持不变，
以便已实现的代码无需修改即可继续工作。

**验收标准：**
- `IEmbedder.embed(texts: string[]): Promise<number[][]>` 的签名不变。
- 所有现有调用 `embed()` 的代码无需任何修改。
- `runIndexing` 在未检测到 `embedWithUsage` 时自动回退到 `embed()`（本 issue 不实现，仅保留扩展空间）。

### US-3: 下游索引消费
作为 `IIndexer` 的实现者，
我希望 `index()` 方法能接收可选的 `TokenUsage[]` 参数，
以便优先使用 embedder 提供的精确值，无值时回退到 chunker 估算值。

**验收标准：**
- `IIndexer.index(chunks, vectors, usage?)` 的 `usage` 参数为可选。
- 当 `usage` 存在且长度与 `chunks` 一致时，indexer 必须使用 `usage[i].promptTokens` 作为 `tokenCount`。
- 当 `usage` 缺失或长度不匹配时，indexer 回退到 `chunk.tokenCount ?? Math.ceil(chunk.content.length / 4)`。

---

## 2. 边界与约束

### 2.1 输入边界

| 场景 | 预期行为 |
|------|----------|
| `texts` 为空数组 | `embedWithUsage` 抛出 `ValidationError`，与 `embed()` 一致 |
| `texts` 包含空字符串 | 正常处理，API 返回的 usage 可能为 0 |
| `texts` 长度超过 API 批次上限（如 >2048） | 由实现类内部分批处理，`usage` 合并后按原始顺序返回 |
| API 响应中 `usage` 字段缺失 | `totalTokens` 视为 0，所有 `promptTokens` 为 0 |
| API 响应中 `usage.prompt_tokens` 为 0 | 所有 `promptTokens` 为 0 |

### 2.2 数值边界

- `promptTokens` 和 `totalTokens` 类型为 `number`，语义为非负整数。
- 比例分配使用 `Math.round`，允许分配后总和与原始总量存在 ±1 的舍入误差。
- 当 `totalTokens > 0` 但所有 `texts` 长度均为 0 时，平均分配总量到每条记录。

### 2.3 并发与性能

- `embedWithUsage()` 的网络调用次数和批次数与 `embed()` 完全一致，不引入额外请求。
- `usage` 计算在内存中进行，时间复杂度 O(n)，不成为瓶颈。

### 2.4 向后兼容边界

- `IEmbedder` 新增 `embedWithUsage` 为必选方法（接口层面），但所有现有实现必须在同一变更中同步实现。
- `IIndexer.index` 的 `usage` 参数为可选，现有实现无需立即修改。
- `runIndexing` 内部改为调用 `embedWithUsage()`，因此要求传入的 `embedder` 必须实现该方法。

---

## 3. 架构决策

### AD-1: 接口新增方法而非修改返回值

**决策：** 在 `IEmbedder` 上新增 `embedWithUsage()` 方法，不修改 `embed()` 的返回值。

**理由：**
- 修改 `embed()` 返回值会破坏所有现有调用方，违背向后兼容原则。
- 新增方法允许调用方按需选择：不关心 token 用量的场景继续使用 `embed()`。
- 与 OpenAI SDK 的设计模式一致（如 `chat.completions.create` 与 `chat.completions.createWithRawResponse`）。

### AD-2: TokenUsage 按文本长度比例分配

**决策：** 当 Embedding API 只返回整个请求的总量时，按各文本的 `text.length` 比例分配。

**理由：**
- OpenAI Embedding API 目前只返回整个 batch 的 `prompt_tokens`，不返回逐条计数。
- 文本长度与 token 数呈强正相关（英文 ~4 chars/token，中文 ~1-2 chars/token），比例分配是最佳近似。
- 未来若 API 支持逐条 usage，可直接替换分配逻辑，接口不变。

### AD-3: TokenUsage 作为 IIndexer.index 的可选参数

**决策：** `IIndexer.index` 新增可选的第三个参数 `usage?: TokenUsage[]`。

**理由：**
- 使 token 计数成为 indexer 的增强能力而非强制要求。
- 现有 `MilvusIndexer` 可忽略该参数，无需修改行为。
- 下游 `PrismaMilvusIndexer`（server 侧实现）可选择消费该参数。

### AD-4: runIndexing 内部统一使用 embedWithUsage

**决策：** `runIndexing` 的 embed stage 统一调用 `embedder.embedWithUsage()`，并将 `usage` 传入 `indexer.index()`。

**理由：**
- 确保索引流水线在支持 usage 的场景下始终使用精确值。
- 若传入的 `embedder` 未实现 `embedWithUsage`，TypeScript 编译期报错，避免运行时静默失败。
- `embed()` 保留给外部直接调用或未来非索引场景使用。

---

## 4. 数据流

```
DocumentSource
    |
    v
+---------------+
| IChunker      |
| .chunk()      |
+---------------+
    |
    v
Chunk[]
    |
    v
+---------------+
| IEmbedder     |
| .embedWithUsage()  <-- 新增
+---------------+
    |
    +---> vectors: number[][]
    +---> usage: TokenUsage[]
    |
    v
+---------------+
| IIndexer      |
| .index(chunks, vectors, usage?)  <-- usage 新增
+---------------+
    |
    v
VectorRecord[] (写入向量库)
Chunk[] (写入 PG，含精确 tokenCount)
```

---

## 5. 测试映射

| 测试文件路径 | 用例名 | 覆盖点 |
|--------------|--------|--------|
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage returns vectors and usage for single text` | 单条输入，返回值结构正确 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage returns vectors and usage for multiple texts` | 多条输入，usage 长度匹配 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage distributes total tokens proportionally by text length` | 比例分配，总和校验 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage handles missing usage field` | API 无 usage 时降级为 0 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage throws ValidationError for empty array` | 空输入校验 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage handles batching correctly` | 大批次分批，usage 合并顺序 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/openai-embedder-usage.spec.ts` | `embedWithUsage distributes evenly when all texts are empty` | 边界：全空文本平均分配 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/run-indexing-usage.spec.ts` | `runIndexing passes usage to indexer when embedder supports embedWithUsage` | 流水线端到端 usage 传递 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/run-indexing-usage.spec.ts` | `runIndexing still works when indexer ignores usage` | indexer 不消费 usage 时正常 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/interfaces.spec.ts` | `IEmbedder interface requires embedWithUsage method` | 接口契约编译期检查 |
| `tests/issues/d-20-rag-sdk-embedder-token-usage/interfaces.spec.ts` | `IIndexer index method accepts optional usage parameter` | 接口契约编译期检查 |
