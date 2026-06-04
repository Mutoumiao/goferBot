# @goferbot/rag-sdk

RAG（检索增强生成）工具库 — GoferBot 知识库问答的核心引擎。

**定位**：纯逻辑库，不绑定任何具体存储后端。定义接口契约，由 `@goferbot/server` 实现存储端。

---

## 目录

- [架构概览](#架构概览)
- [模块地图](#模块地图)
- [模块详解](#模块详解)
  - [1. 核心契约层](#1-核心契约层-core-contracts)
  - [2. 索引流水线](#2-索引流水线-indexing)
  - [3. 在线检索流水线](#3-在线检索流水线-runtime)
  - [4. 可观测性](#4-可观测性-observability)
- [Demo 最小闭环](#demo-最小闭环)
- [Server 集成指南](#server-集成指南)
- [架构决策](#架构决策)
- [迭代指南](#迭代指南)

---

## 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                      @goferbot/rag-sdk                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 核心契约层 (src/)                                      │   │
│  │ types.ts  schema.ts  interfaces.ts  errors.ts        │   │
│  │ pipeline.ts  vector-store.ts                         │   │
│  └──────────────────────────────────────────────────────┘   │
│         │              │              │                      │
│    ┌────▼────┐   ┌─────▼──────┐  ┌────▼──────────┐         │
│    │ Indexing│   │  Runtime   │  │ Observability │         │
│    │ (索引)  │   │  (在线检索) │  │  (可观测性)    │         │
│    │         │   │            │  │               │         │
│    │ Chunker │   │ Retriever  │  │ Tracer        │         │
│    │ Embedder│   │ RRF        │  │ Observer      │         │
│    │ Pipeline│   │ Postproc   │  │ Console       │         │
│    │         │   │ Pipeline   │  │               │         │
│    └─────────┘   └────────────┘  └───────────────┘         │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Demo (demo/run.ts)                                     │   │
│  │ 内存 Mock 全部外部依赖，验证 SDK 最小闭环               │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ 单向依赖（接口注入）
┌──────────────────────▼───────────────────────────────────────┐
│                   @goferbot/server                           │
│                                                              │
│  PgVectorStore      KeywordService     ChatService          │
│  (IVectorStore)     (IKeywordStore)    (IGenerator)         │
│                                                              │
│  PrismaVectorIndexer (IIndexer)                              │
│  → 单事务写入 PG chunks + embedding                          │
└──────────────────────────────────────────────────────────────┘
```

**核心原则**：
- SDK 定义接口（`IChunker`, `IEmbedder`, `IIndexer`, `IRetriever`, `IGenerator`...）
- Server 实现接口（`PgVectorStore`, `KeywordService`, `PrismaVectorIndexer`, `ChatService`...）
- SDK 提供流水线编排（`runIndexing`, `runRetrievalPipeline`）
- SDK 提供可运行的默认实现（`RecursiveCharacterChunker`, `OpenAIEmbedder`, `HybridRetriever`, `DefaultRetrievalPostprocessor`）

---

## 模块地图

```
src/
├── types.ts                         # 所有领域类型（DocumentSource, Query, Chunk, TokenUsage...）
├── schema.ts                        # Zod Schema（运行时校验 + 类型推导）
├── interfaces.ts                    # 抽象接口（IChunker, IEmbedder, IIndexer, IRetriever...）
├── errors.ts                        # 错误体系（RAGError → EmbeddingError/RetrievalError/...）
├── pipeline.ts                      # 流水线类型（IndexingStage, RuntimeStage, DebugInfo）
├── vector-store.ts                  # IVectorStore 接口 + VectorRecord/SearchOptions 类型
│
├── chunkers/
│   └── recursive-character.chunker.ts  # 递归字符分割器（实现 IChunker）
│
├── embedders/
│   └── openai.embedder.ts              # OpenAI 兼容 Embedding 客户端（实现 IEmbedder）
│
├── pipelines/
│   └── run-indexing.ts                 # 索引流水线编排（chunk → embed → index）
│
├── indexing/
│   └── index.ts                        # 索引子模块统一导出
│
├── runtime/
│   ├── hybrid-retriever.ts             # 混合检索器（向量 + 关键词 + RRF 融合）
│   ├── rrf.ts                          # Reciprocal Rank Fusion 算法
│   ├── postprocessor.ts               # 检索后处理（filter → rerank → budget → trim）
│   ├── selection-trace.ts              # 后处理追踪类型
│   ├── pipeline.ts                     # 在线检索流水线（retrieve → postprocess → generate）
│   ├── keyword-store.ts               # IKeywordStore 接口类型
│   └── index.ts                        # Runtime 子模块统一导出
│
├── observability/
│   ├── types.ts                        # RAGTrace, RAGStage, RAGObserver 类型
│   ├── tracer.ts                       # RAGTracer 实现（生命周期追踪）
│   ├── console-observer.ts             # 控制台观察者实现
│   └── index.ts                        # Observability 子模块统一导出
│
└── index.ts                            # 顶层统一导出
```

---

## 模块详解

### 1. 核心契约层 (Core Contracts)

SDK 的一切从**类型定义**开始。所有类型由 Zod Schema 推导（`z.infer`），确保运行时校验与编译时类型一致。

#### `types.ts` — 领域类型

| 类型 | 说明 | 关键字段 |
|------|------|----------|
| `DocumentSource` | 待处理的原始文档 | `documentId`, `kbId`, `content`, `mimeType` |
| `Query` | 结构化查询（非简单字符串） | `original`, `rewritten?`, `expanded?`, `kbIds`, `filters?` |
| `Chunk` | 文本块（分块输出单元） | `id`, `documentId`, `kbId`, `content`, `chunkIndex`, `tokenCount?`, `parentId?` |
| `ChunkWithScore` | 带分数的 Chunk | 继承 Chunk + `score` |
| `RetrievalCandidate` | 检索候选（含来源标记） | `chunk`, `score`, `source` (`vector`/`keyword`/`hybrid`) |
| `EmbeddingConfig` | Embedder 配置 | `provider`, `model`, `dimension`, `apiKey`, `baseUrl?` |
| `TokenUsage` | 单条 token 用量 | `promptTokens`, `totalTokens` |
| `EmbedWithUsageResult` | embedWithUsage 返回值 | `vectors`, `usage` (逐条对应) |

#### `schema.ts` — Zod 运行时校验

```typescript
// 设计原则：schema 是唯一真相来源，type 由 z.infer 推导
const DocumentSourceSchema = z.object({
  documentId: z.string().uuid(),
  kbId: z.string().uuid(),
  content: z.string().min(1),
  mimeType: z.string().min(1),
})
export type DocumentSource = z.infer<typeof DocumentSourceSchema>
```

#### `interfaces.ts` — 跨模块接口契约

| 接口 | 职责 | 由谁实现 |
|------|------|----------|
| `IChunker` | 文档 → Chunk[] | SDK: `RecursiveCharacterChunker` |
| `IEmbedder` | text[] → number[][] | SDK: `OpenAIEmbedder` |
| **`IIndexer`** | **Chunk[] + vector[] → 写入存储** | **Server: `PrismaVectorIndexer`** |
| `IRetriever` | Query → RetrievalCandidate[] | SDK: `HybridRetriever` |
| `IReranker` | 候选重排序 | 可选实现 |
| `IGenerator` | Query + Chunk[] → 回答文本 | Server: `ChatService` |
| `IKeywordStore` | 关键词检索 | Server: `KeywordService` (PostgreSQL FTS) |

> ⚠️ **关键设计**：`IIndexer` 是唯一由 Server 层独占实现的接口。
> SDK 不提供默认 Indexer 实现，因为索引写入与具体数据库事务语义强耦合。
> 详见 [架构决策](#架构决策) 第 1 条。

#### `errors.ts` — 错误类型体系

```
RAGError（基类）
├── EmbeddingError    — 嵌入 API 调用失败、维度不匹配
├── RetrievalError    — 向量库超时、混合检索失败
├── ValidationError   — 输入参数非法（不含 cause，代表调用方逻辑错误）
└── IndexingError     — 向量库写入失败
```

#### `pipeline.ts` — 流水线类型抽象

| 类型 | 用途 |
|------|------|
| `IndexingStage` | 单阶段状态：`pending → running → completed/failed` |
| `IndexingResult` | 索引结果：`chunks[]`, `vectorCount`, `stages[]` |
| `RuntimeStage` | 在线检索阶段：`name`, `startTime/endTime`, `input/output` |
| `RuntimeDebugInfo` | 调试信息：`traceId`, `metrics`, `stages[]` |
| `RuntimePipelineResult` | 最终结果：`answer`, `chunks[]`, `debugInfo` |

#### `vector-store.ts` — 向量存储契约

```typescript
interface IVectorStore {
  insertVectors(vectors: VectorRecord[]): Promise<void>    // 批量写入
  searchVectors(vector, options?): Promise<SearchResult[]> // ANN 搜索
  deleteByIds(ids: string[]): Promise<void>                // 按 ID 删除
  ensureCollection(): Promise<void>                        // 幂等初始化
}
```

> ⚠️ `insertVectors` 在 pgvector 实现中已废弃。Server 层使用 `PrismaVectorIndexer.index()` 进行单事务写入（元数据 + 向量），绕过 `IVectorStore.insertVectors`。
> 详见 `packages/server/src/vector/pgvector.ts` 中的 `@deprecated` 标记。

---

### 2. 索引流水线 (Indexing)

离线数据构建：文档 → 分块 → 向量化 → 写入存储。

#### `RecursiveCharacterChunker` — 递归字符分割

```
实现: IChunker
文件: chunkers/recursive-character.chunker.ts

算法:
  1. 按分隔符优先级递归切分: \n\n → \n → ' ' → ''
  2. 每次在 chunkSize 范围内找最后一个分隔符位置切分
  3. 重叠区 (overlap) 保证块间上下文不丢失
  4. 若按分隔符切出的块太小（≤ overlap），退化为硬切避免无限循环

参数:
  chunkSize   = 512   (块最大字符数)
  chunkOverlap = 50   (块间重叠字符数)
  separators  = ['\n\n', '\n', ' ', '']

输出: Chunk[] — 每个包含 id, content, chunkIndex, tokenCount(估算), metadata
```

#### `OpenAIEmbedder` — OpenAI 兼容嵌入客户端

```
实现: IEmbedder
文件: embedders/openai.embedder.ts

特性:
  - 支持任何 OpenAI 兼容 API (OpenAI, 阿里云, 本地 vLLM...)
  - 自动批处理 (batchSize=100)
  - embed(): 返回向量数组
  - embedWithUsage(): 返回向量 + 逐条 token 用量（供 PrismaVectorIndexer 精确记录）
  - Token 用量按文本长度比例分配，余数归入最后一条

配置:
  EmbeddingConfig { provider, model, dimension, apiKey, baseUrl? }
```

#### `runIndexing` — 索引流水线编排

```
文件: pipelines/run-indexing.ts

流水线: chunk → embed → index (3 阶段)

输入:
  document: DocumentSource
  options:  { chunker, embedder, indexer, onStageChange? }

输出: IndexingResult { chunks, vectorCount, stages[] }

调用示例:
  const result = await runIndexing(document, {
    chunker: new RecursiveCharacterChunker({ chunkSize: 512 }),
    embedder: new OpenAIEmbedder(config),
    indexer: prismaVectorIndexer,  // ← Server 提供
  })
```

---

### 3. 在线检索流水线 (Runtime)

在线请求处理：查询 → 检索 → 后处理 → 生成。

#### `HybridRetriever` — 混合检索器

```
实现: IRetriever
文件: runtime/hybrid-retriever.ts

检索策略:
  1. 向量检索 (IVectorStore.searchVectors) — 语义相似
  2. 关键词检索 (IKeywordStore.search) — PostgreSQL FTS
  3. RRF 融合 (reciprocalRankFusion) — 多路结果合并

容错机制:
  - 单路检索失败不崩溃，降级为另一路
  - 双路均失败才抛 RetrievalError

参数:
  vectorWeight  = 0.7   (向量权重)
  keywordWeight = 0.3   (关键词权重)
  rrfK          = 60    (RRF 平滑因子)
```

#### `reciprocalRankFusion` — RRF 融合算法

```
文件: runtime/rrf.ts

算法: 对每个候选，score = Σ 1/(k + rank_i + 1)
      不依赖原始分数，纯基于排名的融合

输入: RetrievalCandidate[][]  (多路检索结果)
输出: RetrievalCandidate[]    (按 RRF 分数降序)
```

#### `DefaultRetrievalPostprocessor` — 检索后处理

```
文件: runtime/postprocessor.ts

四阶段处理:
  1. Filter (分数过滤)    → 丢弃 score < minScore 的候选
  2. Rerank (重排序·可选) → 调用 IReranker 重新计算相关性
  3. Budget Trim (Token裁剪) → 累计 token 不超过 tokenBudget
  4. Max Chunks Trim (数量裁剪) → 最多保留 maxChunks 个候选

每步输出 SelectionTrace，记录丢弃原因和数量，用于调试和可观测。

参数:
  minScore    = 0.0    (最低分数阈值)
  maxChunks   = 10     (最大候选数)
  tokenBudget = 3000   (Token 预算)
  reranker?            (可选重排序器)
```

#### `runRetrievalPipeline` — 在线检索流水线

```
文件: runtime/pipeline.ts

流水线: retrieval → post-retrieval → generation (3 阶段)

输入:
  query:     Query
  retriever: IRetriever
  postprocessor: DefaultRetrievalPostprocessor
  generator: IGenerator

输出: RuntimePipelineResult {
  answer,       // 生成文本
  chunks[],     // 使用的上下文
  debugInfo {   // 调试数据
    traceId, query, stages[], metrics {
      retrievalCount, selectedCount, droppedCount,
      totalTokens, latencyMs
    }
  }
}
```

---

### 4. 可观测性 (Observability)

追踪每一次 RAG 调用的完整生命周期。

#### `RAGTracer` — 追踪器

```
文件: observability/tracer.ts

生命周期:
  tracer.start(name) → trace
    → tracer.stage(trace, 'retrieval')
    → tracer.completeStage(stage, output)
    → tracer.complete(trace)
    → tracer.error(trace, error)  (异常路径)

特性:
  - 每个 trace 有唯一 traceId (crypto.randomUUID())
  - 每个 stage 记录 startTime/endTime/input/output
  - 支持多 Observer 模式（发布/订阅）
```

#### `RAGObserver` 接口

```typescript
interface RAGObserver {
  onTraceStart?(trace: RAGTrace): void
  onTraceStage?(trace: RAGTrace, stage: RAGStage): void
  onTraceComplete?(trace: RAGTrace): void
  onTraceError?(trace: RAGTrace, error: Error): void
}
```

#### `consoleObserver` — 内置控制台观察者

直接输出到 `console.log`/`console.error`，开发调试用。

---

## Demo 最小闭环

文件：`demo/run.ts`

**目的**：用内存 Mock 验证 SDK 完整链路，不依赖任何外部服务。

```
DocumentSource → Chunker → Embedder → Indexer → VectorStore
                                                    ↓
           Answer ← Generator ← Postprocessor ← Retriever ← Query
```

**Mock 实现**：
- `createMockVectorStore()` — 内存 Map 实现 IVectorStore
- `createMockKeywordStore()` — 内存 Map 实现 IKeywordStore
- `createMockGenerator()` — 固定模版实现 IGenerator
- `createMockEmbedder(4)` — 确定性输出实现 IEmbedder（4 维向量）
- 内联 indexer（10 行）— 将 chunk+向量组装为 VectorRecord 后写入

**运行**：
```bash
npx tsx packages/rag-sdk/demo/run.ts
```

**预期输出**：
```
[Demo] RAG SDK 最小闭环验证开始
[Demo] 执行索引流水线...
[Demo] Indexing stages: chunk=completed, embed=completed, index=completed
[Demo] 分块完成: 5 chunks
[Demo] 向量写入: 5 vectors
[Demo] 执行检索流水线...
[Demo] 回答生成完成: "Answer based on 5 chunks for: RAG 技术"

[Demo] 验证结果:
  ✅ chunks.length > 0
  ✅ vectorCount === chunks.length
  ✅ all stages completed
  ✅ answer is truthy
  ✅ result.chunks.length > 0
  ✅ latencyMs >= 0
  ✅ stages.length === 3

[Demo] ✅ 所有验证通过，RAG SDK 集成验证成功！
```

---

## Server 集成指南

### 接口实现映射

| SDK 接口 | Server 实现 | 文件位置 |
|----------|------------|----------|
| `IVectorStore` | `PgVectorStore` | `packages/server/src/vector/pgvector.ts` |
| `IIndexer` | `PrismaVectorIndexer` | `packages/server/src/processors/indexing/prisma-vector.indexer.ts` |
| `IKeywordStore` | `KeywordService` | `packages/server/src/processors/keyword/keyword.service.ts` |
| `IGenerator` | `ChatService` | `packages/server/src/modules/chat/chat.service.ts` |

### 索引链路（BullMQ Worker）

```typescript
// packages/server/src/processors/queue/indexing.worker.ts
import { runIndexing, RecursiveCharacterChunker } from '@goferbot/rag-sdk'

const result = await runIndexing(document, {
  chunker: new RecursiveCharacterChunker({ chunkSize: 512 }),
  embedder: this.openaiEmbedder,
  indexer: this.prismaVectorIndexer,  // 单事务写入 PG
  onStageChange: (stages) => job.updateProgress({ stages }),
})
```

### 检索链路（Chat API）

```typescript
// packages/server/src/modules/chat/chat.service.ts
import { HybridRetriever, DefaultRetrievalPostprocessor } from '@goferbot/rag-sdk'

const retriever = new HybridRetriever({
  vectorStore: this.vectorService,     // PgVectorStore
  keywordStore: this.keywordService,   // PostgreSQL FTS
  embedder: this.openaiEmbedder,
})

const result = await runRetrievalPipeline(
  query,
  retriever,
  new DefaultRetrievalPostprocessor({ minScore: 0.3 }),
  this,  // ChatService 实现了 IGenerator
)
```

> 更多细节见 `packages/rag-sdk/docs/integration.md`（部分内容基于旧 Milvus 架构，集成模式不变）

---

## 架构决策

| # | 决策 | 理由 |
|----|------|------|
| 1 | **SDK 不提供 Indexer 默认实现** | pgvector 需要单事务写入（元数据+向量），该逻辑与 PostgreSQL 强耦合，属于 Server 层职责。SDK 只定义 `IIndexer` 接口契约 |
| 2 | **单向依赖** | `server → rag-sdk`，禁止反向依赖。SDK 是纯逻辑库，不感知数据库 |
| 3 | **接口注入而非继承** | Server 实现 SDK 接口，通过构造函数注入。SDK 不控制实现细节 |
| 4 | **Zod Schema 是唯一真相来源** | 所有类型由 `z.infer` 推导，运行时校验 + 编译时类型一致 |
| 5 | **流水线模式** | Indexing 和 Retrieval 都采用流水线编排，阶段可插拔、可追踪 |
| 6 | **内置 Demo 验证** | `demo/run.ts` 用纯内存 Mock 验证 SDK 闭环，不依赖外部服务 |
| 7 | **单包多模块** | 一个 npm 包包含所有模块，降低发布和维护成本 |

---

## 迭代指南

### 如果你想新增一个 Chunker

1. 实现 `IChunker` 接口（`interfaces.ts:15`）
2. 放在 `src/chunkers/` 目录
3. 在 `src/indexing/index.ts` 中导出
4. 编写单元测试（参考 `tests/unit/server/document-parser.spec.ts` 中的 chunk 相关用例）

### 如果你想新增一个 Embedder

1. 实现 `IEmbedder` 接口（`interfaces.ts:25`）
2. 可选实现 `embedWithUsage()` 扩展方法
3. 放在 `src/embedders/` 目录
4. 在 `src/indexing/index.ts` 中导出
5. 确保 `EmbeddingConfig` schema（`schema.ts:43`）覆盖新 provider 的需要

### 如果你想替换检索策略

1. 实现 `IRetriever` 接口（`interfaces.ts:61`）
2. 放在 `src/runtime/` 目录
3. 可选择是否复用 `RRF`、`postprocessor` 等现有组件

### 如果你想接入新的向量数据库（如 Pinecone / Weaviate）

1. 在 Server 层实现 `IVectorStore` 接口（`vector-store.ts:39`）
2. 同样实现 `IIndexer` 接口（因为写入逻辑与数据库耦合）
3. SDK 完全不需要改动——这正是接口注入架构的价值

### 开发流程

```bash
# 类型检查
cd packages/rag-sdk && pnpm type-check

# 运行 Demo 验证闭环
npx tsx packages/rag-sdk/demo/run.ts

# 运行 SDK 相关测试
npx vitest run tests/unit/server/embedder-interfaces.spec.ts
npx vitest run tests/unit/server/openai-embedder-usage.spec.ts
npx vitest run tests/unit/server/run-indexing-usage.spec.ts
```

### 相关文档

| 文档 | 路径 |
|------|------|
| 模块设计详情 | `packages/rag-sdk/docs/01-07` |
| Server 集成指南 | `packages/rag-sdk/docs/integration.md` |
| ADR 0001 (云原生架构) | `docs/adrs/0001-cloud-native-architecture.md` |
| PRD RAG Server 集成 | `docs/prd/rag-server-integration.md` |
