# Behavior Spec: RAG SDK 接口层

> Issue: d-01-rag-sdk-contracts
> 状态: 草案
> 日期: 2026-05-16

---

## 1. 分块行为（IChunker）

### 1.1 正常流程

**触发时机**: 文档解析完成后，Worker 调用分块器。

**输入**: `DocumentSource` 对象，包含：
- `documentId`: string — 文档 ID（PostgreSQL 主键）
- `kbId`: string — 知识库 ID
- `content`: string — 文档纯文本内容
- `mimeType`: string — MIME 类型（如 `application/pdf`）

**流程**:
1. 根据 `mimeType` 和配置选择分块策略（字符 / Token / 语义）。
2. 将 `content` 按策略切分为不重叠（或允许少量重叠）的文本块。
3. 为每个块分配递增的 `chunkIndex`。
4. 可选：计算每个块的 `tokenCount`。

**输出**: `Chunk[]`，每个 Chunk 包含：
- `id`: string — 块 ID（UUID，由实现生成）
- `documentId`: string — 关联文档 ID
- `kbId`: string — 知识库 ID
- `content`: string — 块文本内容
- `chunkIndex`: number — 在文档中的顺序
- `tokenCount`: number | undefined — Token 数（可选）

### 1.2 边界条件

| 场景 | 行为 |
|------|------|
| 空内容 | 返回空数组 `[]`，不抛异常 |
| 内容长度小于分块大小 | 返回单个 Chunk，content 为原文 |
| 重叠配置大于分块大小 | 抛出 `ValidationError`（配置非法） |

---

## 2. 向量化行为（IEmbedder）

### 2.1 正常流程

**触发时机**: 分块完成后，Worker 调用向量化器；或检索时，将 query 向量化。

**输入**: `texts: string[]` — 待向量化的文本数组。

**流程**:
1. 校验输入数组非空。
2. 按 `EmbeddingConfig` 调用底层 Embedding API（OpenAI / 硅基流动 / 自定义）。
3. 接收 API 返回的向量数组。
4. 校验返回向量维度等于 `config.dimension`。

**输出**: `number[][]` — 与输入顺序一一对应的向量数组。

### 2.2 批量限制

- 单次调用上限由实现决定（OpenAI 官方限制 2048 tokens / request）。
- 超出限制时，实现层内部自动分批，对外仍表现为单次调用。

### 2.3 边界条件

| 场景 | 行为 |
|------|------|
| 空数组 | 抛出 `ValidationError` |
| 包含空字符串 | 实现决定：跳过或向量化后返回零向量 |
| API 返回维度不匹配 | 抛出 `EmbeddingError('维度不匹配: 期望 {dim}, 实际 {actual}')` |

---

## 3. 检索行为（IRetriever）

### 3.1 正常流程

**触发时机**: 用户发送消息且选择了知识库时，Chat API 调用检索器。

**输入**:
- `query`: string — 用户原始查询
- `kbIds`: string[] — 目标知识库 ID 数组（支持多知识库）
- `topK`: number — 返回结果数量上限
- `options?: HybridSearchOptions` — 混合检索参数（预留）

**流程**:
1. 调用 `IEmbedder.embed([query])` 生成 query 向量。
2. 调用 `IVectorStore.searchVectors(queryVector, { filter: { kbId }, topK })`。
   - 若 `kbIds` 包含多个 ID，对每个 ID 分别搜索后合并去重。
3. （预留）执行关键词检索，获取关键词匹配结果。
4. （预留）使用 RRF（Reciprocal Rank Fusion）融合向量检索结果与关键词检索结果。
5. 按最终分数降序排序，取前 `topK` 条。
6. 根据 `chunkId` 查询 PostgreSQL `chunks` 表，补全 `content` 等字段。

**输出**: `ChunkWithScore[]`，每个元素包含 Chunk 全部字段 + `score: number`。

### 3.2 混合检索参数（预留）

```typescript
interface HybridSearchOptions {
  /** 向量检索权重，默认 0.7 */
  vectorWeight?: number
  /** 关键词检索权重，默认 0.3 */
  keywordWeight?: number
  /** RRF 融合参数 k，默认 60 */
  rrfK?: number
}
```

- MVP 阶段仅实现纯向量检索（`vectorWeight = 1`，`keywordWeight = 0`）。
- 接口预留参数，Phase 5 后期实现混合检索时无需修改签名。

---

## 4. 索引行为（IIndexer）

### 4.1 正常流程

**触发时机**: 向量化完成后，Worker 调用索引器。

**输入**:
- `chunks: Chunk[]` — 已分块的文本块
- `vectors: number[][]` — 与 chunks 一一对应的向量数组

**流程**:
1. 校验 `chunks.length === vectors.length`，否则抛出 `ValidationError`。
2. 校验每个 `vectors[i].length === config.dimension`，否则抛出 `EmbeddingError`。
3. 构造 `VectorRecord[]`：
   - `id`: 业务生成 UUID（Milvus 主键）
   - `chunkId`: `chunks[i].id`
   - `kbId`: `chunks[i].kbId`
   - `fileId`: `chunks[i].documentId`
   - `embedding`: `vectors[i]`
4. 调用 `IVectorStore.insertVectors(records)`。
5. 将 `VectorRecord.id` 回写到 PostgreSQL `chunks.milvusId`。

**输出**: `void`（成功时）或抛出错误。

### 4.2 异步执行

- `IIndexer.index` 为异步方法，可能在 BullMQ Worker 中执行。
- 调用方通过 Job 状态追踪索引进度，不阻塞用户请求。

---

## 5. 错误场景

| 场景 | 触发条件 | 行为 | 错误类型 |
|------|----------|------|----------|
| Embedding API 失败 | API Key 无效、网络中断、Rate Limit | 抛出明确错误，保留原始 cause | `EmbeddingError` |
| 向量维度不匹配 | 配置 dimension 与 API 返回 / Collection 维度不一致 | 立即抛出，拒绝后续操作 | `EmbeddingError` |
| 检索超时 | Milvus 负载高或网络延迟 | 抛出超时错误 | `RetrievalError` |
| 空查询检索 | `query` 为空字符串 | 抛出 `ValidationError` | `ValidationError` |
| 索引长度不匹配 | `chunks.length !== vectors.length` | 抛出 `ValidationError` | `ValidationError` |
| 向量库写入失败 | Milvus 连接中断、Collection 未创建 | 抛出 `RAGError`，保留 cause | `RAGError` |

---

## 6. 生命周期

```
文档上传
  └─ MinIO 存储
       └─ PostgreSQL 创建记录（status = uploaded）
            └─ BullMQ: document-processing job
                 └─ Worker 下载文件
                      └─ Parser 提取文本
                           └─ IChunker.chunk(doc) → Chunk[]
                                └─ IEmbedder.embed(chunks.map(c => c.content)) → number[][]
                                     └─ IIndexer.index(chunks, vectors)
                                          ├─ IVectorStore.insertVectors(records)
                                          └─ UPDATE chunks SET milvus_id = ...
                                               └─ status = ready
```

---

## 7. 与现有接口的协作时序

### 7.1 索引时序

```
RAG Worker
  ├─ IStorageProvider.download(storageKey) → 文件流
  ├─ Parser → 纯文本 content
  ├─ IChunker.chunk({ documentId, kbId, content, mimeType }) → Chunk[]
  ├─ INSERT INTO chunks (...) → 返回 chunk_id
  ├─ IEmbedder.embed(chunks.map(c => c.content)) → vectors
  ├─ IIndexer.index(chunks, vectors)
  │    ├─ 构造 VectorRecord[]
  │    ├─ IVectorStore.insertVectors(records)
  │    └─ UPDATE chunks SET milvus_id = record.id WHERE id = chunk.id
  └─ UPDATE documents SET status = 'ready'
```

### 7.2 检索时序

```
Chat API
  ├─ 提取 knowledgeBaseIds
  ├─ IEmbedder.embed([query]) → queryVector
  ├─ IRetriever.retrieve(query, kbIds, topK, options)
  │    ├─ IVectorStore.searchVectors(queryVector, { filter: { kbId }, topK })
  │    ├─ （预留）关键词检索
  │    ├─ （预留）RRF 融合
  │    └─ PostgreSQL 查询 chunks 补全内容
  └─ 将 ChunkWithScore[] 拼入 system prompt
```

---

## 8. 日志与可观测性

- 分块：`[RAG] Chunked document {docId} into {n} chunks`
- 向量化：`[RAG] Embedded {n} texts, dim={dimension}, provider={provider}`
- 检索：`[RAG] Retrieved {n} chunks from kbIds=[...], topK={k}`
- 索引：`[RAG] Indexed {n} vectors into Milvus`
- 错误：`[RAG] Error in {stage}: {message}`
