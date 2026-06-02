---
id: d-11
issue: issue.md
version: 1
---

# RAG SDK Core 契约层实现计划

> **For agentic workers:** 必需子技能：superpowers:executing-plans（当前会话顺序执行）。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 实现 RAG SDK 的共享领域契约层，包含数据模型、Zod Schema、能力接口、错误体系、Pipeline 抽象和向量存储接口。

**架构：** 采用扁平化设计，所有契约文件直接放在 `src/` 根目录。类型由 Zod Schema 推导（`z.infer`），消除重复定义。错误支持 `cause` 链式追溯。

**技术栈：** TypeScript 5.9 + Zod（需安装）

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) / [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

```
packages/rag-sdk/src/
  ├── schema.ts         # 新增：Zod Schema 定义
  ├── types.ts          # 修改：扩展类型（Query / RetrievalCandidate / Chunk 增强字段）
  ├── interfaces.ts     # 新增：合并现有 interfaces/ 目录，扁平化
  ├── errors.ts         # 修改：新增 IndexingError
  ├── pipeline.ts       # 新增：Pipeline 类型抽象
  ├── vector-store.ts   # 新增：向量存储接口
  └── index.ts          # 修改：统一导出入口

packages/rag-sdk/
  ├── package.json      # 修改：添加 zod 依赖
  └── tsconfig.json     # 可能需要调整

tests/issues/d-11-rag-sdk-core-contracts/
  └── coreContracts.spec.ts   # 新增：单元测试
```

---

## 任务 1: 安装 Zod 依赖并编写 Schema 测试

**文件：**
- 修改：`packages/rag-sdk/package.json`
- 创建：`tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`

**规格引用：**
- API 规格：[数据模型契约 - DocumentSource / Query / Chunk / ChunkWithScore / RetrievalCandidate / EmbeddingConfig / HybridSearchOptions]

- [ ] **步骤 1: 安装 zod 依赖**

```bash
cd packages/rag-sdk && pnpm add zod
```

- [ ] **步骤 2: 编写失败测试（Schema 校验）**

```typescript
// tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts
import { describe, it, expect } from 'vitest'
import {
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  ChunkWithScoreSchema, RetrievalCandidateSchema,
  EmbeddingConfigSchema, HybridSearchOptionsSchema,
} from '../../packages/rag-sdk/src/schema.js'

describe('Schema validation', () => {
  it('AC-01: validates valid DocumentSource', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello world',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(true)
  })

  it('AC-02: rejects empty content in DocumentSource', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: '',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })

  it('AC-03: rejects negative chunkIndex in Chunk', () => {
    const result = ChunkSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      kbId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'hello',
      chunkIndex: -1,
    })
    expect(result.success).toBe(false)
  })

  it('AC-04: rejects invalid UUID format', () => {
    const result = DocumentSourceSchema.safeParse({
      documentId: 'not-a-uuid',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello',
      mimeType: 'text/plain',
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **步骤 3: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：FAIL — "Cannot find module '../../packages/rag-sdk/src/schema.js'"

---

## 任务 2: 实现 schema.ts

**文件：**
- 创建：`packages/rag-sdk/src/schema.ts`

**规格引用：**
- API 规格：[3.2 Zod Schema]

- [ ] **步骤 4: 编写 schema.ts**

```typescript
// packages/rag-sdk/src/schema.ts
import { z } from 'zod'

export const DocumentSourceSchema = z.object({
  documentId: z.string().uuid(),
  kbId: z.string().uuid(),
  content: z.string().min(1),
  mimeType: z.string().min(1),
})

export const QuerySchema = z.object({
  original: z.string().min(1),
  rewritten: z.string().optional(),
  expanded: z.array(z.string()).optional(),
  kbIds: z.array(z.string().uuid()).min(1),
  filters: z.record(z.unknown()).optional(),
})

export const ChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  kbId: z.string().uuid(),
  content: z.string().min(1),
  chunkIndex: z.number().int().min(0),
  tokenCount: z.number().int().optional(),
  parentId: z.string().uuid().optional(),
  hierarchyPath: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const ChunkWithScoreSchema = ChunkSchema.extend({
  score: z.number().min(0).max(1),
})

export const RetrievalCandidateSchema = z.object({
  chunk: ChunkSchema,
  score: z.number().min(0).max(1),
  source: z.enum(['vector', 'keyword', 'hybrid']),
  route: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export const EmbeddingConfigSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  dimension: z.number().int().positive(),
  apiKey: z.string(),
  baseUrl: z.string().url().optional(),
})

export const HybridSearchOptionsSchema = z.object({
  vectorWeight: z.number().min(0).max(1).optional(),
  keywordWeight: z.number().min(0).max(1).optional(),
  rrfK: z.number().int().positive().optional(),
})
```

- [ ] **步骤 5: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS（AC-01 ~ AC-04 通过）

- [ ] **步骤 6: 提交**

```bash
git add packages/rag-sdk/src/schema.ts tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts packages/rag-sdk/package.json pnpm-lock.yaml
git commit -m "feat(rag-sdk): add Zod schemas for core data models (d-11)"
```

---

## 任务 3: 扩展 types.ts（由 Schema 推导）

**文件：**
- 修改：`packages/rag-sdk/src/types.ts`

**规格引用：**
- API 规格：[3.1 基础类型]
- 注意：保留现有 Chunk/DocumentSource/EmbeddingConfig/HybridSearchOptions 的 JSDoc，但类型改为 `z.infer`

- [ ] **步骤 7: 编写失败测试（类型推导一致性 — 运行时验证）**

在 `coreContracts.spec.ts` 中追加：

```typescript
import {
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  RetrievalCandidateSchema,
} from '../../packages/rag-sdk/src/schema.js'

describe('Type inference', () => {
  it('AC-06: infers correct types from Zod schemas', () => {
    // 验证 schema 能正确解析符合类型的数据（运行时验证类型推导一致性）
    const docResult = DocumentSourceSchema.safeParse({
      documentId: '550e8400-e29b-41d4-a716-446655440000',
      kbId: '550e8400-e29b-41d4-a716-446655440001',
      content: 'hello',
      mimeType: 'text/plain',
    })
    expect(docResult.success).toBe(true)
    if (docResult.success) {
      expect(docResult.data.content).toBe('hello')
    }

    const queryResult = QuerySchema.safeParse({
      original: 'test query',
      kbIds: ['550e8400-e29b-41d4-a716-446655440000'],
    })
    expect(queryResult.success).toBe(true)
    if (queryResult.success) {
      expect(queryResult.data.original).toBe('test query')
    }

    const chunkResult = ChunkSchema.safeParse({
      id: '550e8400-e29b-41d4-a716-446655440000',
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      kbId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'hello',
      chunkIndex: 0,
    })
    expect(chunkResult.success).toBe(true)

    const candidateResult = RetrievalCandidateSchema.safeParse({
      chunk: chunkResult.success ? chunkResult.data : {},
      score: 0.5,
      source: 'vector',
    })
    expect(candidateResult.success).toBe(true)
    if (candidateResult.success) {
      expect(candidateResult.data.source).toBe('vector')
    }
  })
})
```

- [ ] **步骤 8: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：FAIL — 如果 types.ts 尚未重写且测试文件中有 `import type` 引用未定义类型会编译失败；但当前运行时测试只依赖 schema.js，所以实际可能是 PASS —— 这说明 types.ts 的重写是类型层面的，不影响运行时

**注意**：此任务的核心是 types.ts 的类型正确性，由 `pnpm type-check` 验证。运行时测试验证 schema 数据结构的正确性。

- [ ] **步骤 9: 重写 types.ts**

```typescript
// packages/rag-sdk/src/types.ts
import { z } from 'zod'
import type {
  DocumentSourceSchema, QuerySchema, ChunkSchema,
  ChunkWithScoreSchema, RetrievalCandidateSchema,
  EmbeddingConfigSchema, HybridSearchOptionsSchema,
} from './schema.js'

export type DocumentSource = z.infer<typeof DocumentSourceSchema>
export type Query = z.infer<typeof QuerySchema>
export type Chunk = z.infer<typeof ChunkSchema>
export type ChunkWithScore = z.infer<typeof ChunkWithScoreSchema>
export type RetrievalCandidate = z.infer<typeof RetrievalCandidateSchema>
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>
export type HybridSearchOptions = z.infer<typeof HybridSearchOptionsSchema>
```

注意：保留原有 JSDoc 注释（从旧 types.ts 迁移）。

- [ ] **步骤 10: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS

- [ ] **步骤 11: 提交**

```bash
git add packages/rag-sdk/src/types.ts tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts
git commit -m "feat(rag-sdk): derive types from Zod schemas, add Query and RetrievalCandidate (d-11)"
```

---

## 任务 4: 扩展 errors.ts（新增 IndexingError）

**文件：**
- 修改：`packages/rag-sdk/src/errors.ts`

**规格引用：**
- API 规格：[错误契约]

- [ ] **步骤 12: 编写失败测试（错误 cause 链）**

在 `coreContracts.spec.ts` 中追加：

```typescript
import { RAGError, EmbeddingError, RetrievalError, ValidationError, IndexingError } from '../../packages/rag-sdk/src/errors.js'

describe('Error hierarchy', () => {
  it('AC-05: preserves error cause chain', () => {
    const cause = new Error('network timeout')
    const err = new EmbeddingError('embed failed', cause)
    expect(err.cause).toBe(cause)
    expect(err.name).toBe('EmbeddingError')
  })

  it('AC-05b: IndexingError exists and supports cause', () => {
    const cause = new Error('milvus down')
    const err = new IndexingError('index failed', cause)
    expect(err.cause).toBe(cause)
    expect(err.name).toBe('IndexingError')
    expect(err).toBeInstanceOf(RAGError)
  })
})
```

- [ ] **步骤 13: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：FAIL — "IndexingError is not defined"

- [ ] **步骤 14: 扩展 errors.ts**

在 `errors.ts` 末尾追加：

```typescript
/**
 * 索引错误。
 *
 * 触发场景：
 * - 向量库写入失败（连接断开、collection 不存在）
 * - 批量插入部分失败
 */
export class IndexingError extends RAGError {
  constructor(message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'IndexingError'
  }
}
```

- [ ] **步骤 15: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS

- [ ] **步骤 16: 提交**

```bash
git add packages/rag-sdk/src/errors.ts tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts
git commit -m "feat(rag-sdk): add IndexingError to error hierarchy (d-11)"
```

---

## 任务 5: 创建 interfaces.ts（扁平化合并）

**文件：**
- 创建：`packages/rag-sdk/src/interfaces.ts`
- 删除：`packages/rag-sdk/src/interfaces/` 目录（IChunker.ts / IEmbedder.ts / IIndexer.ts / IRetriever.ts / index.ts）

**规格引用：**
- API 规格：[4. 接口设计]
- 关键变更：IRetriever 入参从 `query: string, kbIds: string[]` 改为 `query: Query`
- 新增：IReranker / IGenerator / IKeywordStore

- [ ] **步骤 17: 编写失败测试（接口形状）**

在 `coreContracts.spec.ts` 中追加：

```typescript
import type { IChunker, IEmbedder, IIndexer, IRetriever, IReranker, IGenerator, IVectorStore, IKeywordStore } from '../../packages/rag-sdk/src/interfaces.js'

describe('Interface shapes', () => {
  it('AC-09: IVectorStore has required methods', () => {
    const store: IVectorStore = {
      insertVectors: async () => {},
      searchVectors: async () => [],
      deleteByIds: async () => {},
      ensureCollection: async () => {},
    }
    expect(store).toBeDefined()
  })

  it('AC-09b: IRetriever accepts Query object', () => {
    const retriever: IRetriever = {
      retrieve: async (query, topK, options) => {
        expect(query.original).toBeDefined()
        return []
      },
    }
    expect(retriever).toBeDefined()
  })
})
```

- [ ] **步骤 18: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：FAIL — "Cannot find module '../../packages/rag-sdk/src/interfaces.js'" 或接口不匹配

- [ ] **步骤 19: 创建 interfaces.ts**

```typescript
// packages/rag-sdk/src/interfaces.ts
import type { DocumentSource, Chunk, Query, RetrievalCandidate, EmbeddingConfig, HybridSearchOptions } from './types.js'
import { ValidationError, EmbeddingError, RAGError, RetrievalError } from './errors.js'

/**
 * 文档分块策略抽象。
 * 将文档纯文本内容按策略切分为语义完整的文本块。
 * 空内容应返回空数组 []，重叠配置非法时应抛出 ValidationError。
 */
export interface IChunker {
  chunk(doc: DocumentSource): Promise<Chunk[]>
}

/**
 * 文本向量化抽象。
 * 将字符串数组转换为高维向量数组，用于语义检索。
 * 空数组输入应抛出 ValidationError，维度不匹配时应抛出 EmbeddingError。
 */
export interface IEmbedder {
  embed(texts: string[]): Promise<number[][]>
  readonly config: Readonly<EmbeddingConfig>
}

/**
 * 向量索引写入抽象。
 * 将分块后的文本及其向量批量写入向量数据库。
 * chunks 与 vectors 长度不匹配时应抛出 ValidationError。
 */
export interface IIndexer {
  index(chunks: Chunk[], vectors: number[][]): Promise<void>
}

/**
 * 混合检索抽象（向量 + 关键词 + RRF 融合）。
 * 入参为结构化 Query 对象（非简单字符串）。
 * query.original 为空或 query.kbIds 为空数组时应抛出 ValidationError。
 */
export interface IRetriever {
  retrieve(
    query: Query,
    topK?: number,
    options?: HybridSearchOptions,
  ): Promise<RetrievalCandidate[]>
}

/**
 * 重排序抽象。
 * 对检索候选进行重排序，提升结果质量。
 */
export interface IReranker {
  rerank(candidates: RetrievalCandidate[], query: Query): Promise<RetrievalCandidate[]>
}

/**
 * 生成器抽象。
 * 基于查询和上下文 chunks 生成回答文本。
 */
export interface IGenerator {
  generate(input: { query: Query; chunks: Chunk[] }): Promise<string>
}

/**
 * 关键词存储抽象。
 * 由 server 的 PostgreSQL FTS 实现，支持混合检索的关键词分支。
 */
export interface IKeywordStore {
  search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]>
}
```

- [ ] **步骤 20: 删除旧 interfaces/ 目录**

```bash
rm -rf packages/rag-sdk/src/interfaces/
```

- [ ] **步骤 21: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS

- [ ] **步骤 22: 提交**

```bash
git add packages/rag-sdk/src/interfaces.ts packages/rag-sdk/src/interfaces/
git commit -m "feat(rag-sdk): flatten interfaces to src/interfaces.ts, update IRetriever signature, add IReranker/IGenerator/IKeywordStore (d-11)"
```

---

## 任务 6: 创建 vector-store.ts

**文件：**
- 创建：`packages/rag-sdk/src/vector-store.ts`

**规格引用：**
- API 规格：[4.7 IVectorStore]

- [ ] **步骤 23: 编写 vector-store.ts**

```typescript
// packages/rag-sdk/src/vector-store.ts

export interface VectorRecord {
  id: string
  chunkId: string
  kbId: string
  fileId: string
  embedding: number[]
}

export interface VectorSearchOptions {
  topK?: number
  filter?: {
    kbId?: string
  }
}

export interface VectorSearchResult {
  id: string
  chunkId: string
  score: number
}

export interface IVectorStore {
  insertVectors(vectors: VectorRecord[]): Promise<void>
  searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]>
  deleteByIds(ids: string[]): Promise<void>
  ensureCollection(): Promise<void>
}
```

- [ ] **步骤 24: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS（AC-09 已覆盖 IVectorStore）

- [ ] **步骤 25: 提交**

```bash
git add packages/rag-sdk/src/vector-store.ts
git commit -m "feat(rag-sdk): add vector-store interfaces (IVectorStore, VectorRecord, VectorSearchOptions, VectorSearchResult) (d-11)"
```

---

## 任务 7: 创建 pipeline.ts

**文件：**
- 创建：`packages/rag-sdk/src/pipeline.ts`

**规格引用：**
- API 规格：[Pipeline 契约]

- [ ] **步骤 26: 编写失败测试（Pipeline 类型结构）**

在 `coreContracts.spec.ts` 中追加：

```typescript
import type { IndexingStage, RuntimeStage, RuntimeDebugInfo, RuntimePipelineResult } from '../../packages/rag-sdk/src/pipeline.js'

describe('Pipeline types', () => {
  it('AC-08: validates IndexingStage status enum', () => {
    const stage: IndexingStage = {
      name: 'chunking',
      status: 'running',
    }
    expect(stage.status).toBe('running')
  })

  it('AC-08b: RuntimeDebugInfo has required metrics', () => {
    const debug: RuntimeDebugInfo = {
      traceId: 'abc',
      query: { original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] },
      stages: [],
      metrics: {
        retrievalCount: 0,
        selectedCount: 0,
        droppedCount: 0,
        totalTokens: 0,
        latencyMs: 0,
      },
    }
    expect(debug.metrics.latencyMs).toBe(0)
  })
})
```

- [ ] **步骤 27: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：FAIL — "Cannot find module '../../packages/rag-sdk/src/pipeline.js'"

- [ ] **步骤 28: 创建 pipeline.ts**

```typescript
// packages/rag-sdk/src/pipeline.ts
import type { Chunk, Query } from './types.js'

export interface IndexingStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  error?: string
}

export interface IndexingResult {
  chunks: Chunk[]
  vectorCount: number
  stages: IndexingStage[]
}

export type IndexingPipeline = (
  document: DocumentSource
) => Promise<IndexingResult>

export interface RuntimeStage {
  name: string
  startTime: number
  endTime: number
  input: unknown
  output: unknown
  error?: string
}

export interface RuntimeDebugInfo {
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

export interface RuntimePipelineResult {
  answer: string
  chunks: Chunk[]
  debugInfo: RuntimeDebugInfo
}

export type RuntimePipeline = (query: Query) => Promise<RuntimePipelineResult>
```

- [ ] **步骤 29: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS

- [ ] **步骤 30: 提交**

```bash
git add packages/rag-sdk/src/pipeline.ts tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts
git commit -m "feat(rag-sdk): add pipeline type abstractions (IndexingPipeline, RuntimePipeline) (d-11)"
```

---

## 任务 8: 更新 index.ts 统一导出

**文件：**
- 修改：`packages/rag-sdk/src/index.ts`

**规格引用：**
- API 规格：[模块导出]

- [ ] **步骤 31: 编写失败测试（统一导出完整性）**

在 `coreContracts.spec.ts` 中追加：

```typescript
import * as sdk from '../../packages/rag-sdk/src/index.js'

describe('Index exports', () => {
  it('AC-07: exports all contracts from index.ts', () => {
    expect(sdk.DocumentSourceSchema).toBeDefined()
    expect(sdk.QuerySchema).toBeDefined()
    expect(sdk.RAGError).toBeDefined()
    expect(sdk.IndexingError).toBeDefined()
    expect(sdk.IVectorStore).toBeUndefined() // interface is type-only
    expect(sdk.VectorRecord).toBeUndefined() // interface is type-only
  })
})
```

- [ ] **步骤 32: 运行测试验证失败**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：FAIL — "IndexingError is not exported" 或类似

- [ ] **步骤 33: 重写 index.ts**

```typescript
// packages/rag-sdk/src/index.ts
export * from './schema.js'
export * from './types.js'
export * from './interfaces.js'
export * from './errors.js'
export * from './pipeline.js'
export * from './vector-store.js'
```

- [ ] **步骤 34: 运行测试验证通过**

运行：`npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts`
预期：PASS

- [ ] **步骤 35: 提交**

```bash
git add packages/rag-sdk/src/index.ts tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts
git commit -m "feat(rag-sdk): unify exports in index.ts (d-11)"
```

---

## 任务 9: 类型检查与最终验证

**规格引用：**
- checklist AC-08: pnpm type-check 通过
- checklist AC-09: 单元测试覆盖边界

- [ ] **步骤 36: 运行类型检查**

```bash
cd packages/rag-sdk && pnpm type-check
```
预期：0 错误

- [ ] **步骤 37: 运行全部单元测试**

```bash
npx vitest run tests/issues/d-11-rag-sdk-core-contracts/coreContracts.spec.ts
```
预期：全部通过（AC-01 ~ AC-09）

- [ ] **步骤 38: 运行全局测试确保无回归**

```bash
npx vitest run
```
预期：其他 issue 的测试也全部通过

- [ ] **步骤 39: 提交**

```bash
git add -A
git commit -m "test(rag-sdk): complete d-11 core contracts with full test coverage"
```

---

## 自检

**规格覆盖检查：**

| 规格需求 | 对应任务 | 状态 |
|----------|----------|------|
| DocumentSource / Query / Chunk / ChunkWithScore / RetrievalCandidate / EmbeddingConfig / HybridSearchOptions 类型 | 任务 1-3 | ✅ |
| Zod Schema 定义 | 任务 1-2 | ✅ |
| IChunker / IEmbedder / IIndexer / IRetriever / IReranker / IGenerator / IVectorStore / IKeywordStore | 任务 5-6 | ✅ |
| RAGError / EmbeddingError / RetrievalError / ValidationError / IndexingError | 任务 4 | ✅ |
| IndexingStage / IndexingResult / IndexingPipeline / RuntimeStage / RuntimeDebugInfo / RuntimePipelineResult / RuntimePipeline | 任务 7 | ✅ |
| VectorRecord / VectorSearchOptions / VectorSearchResult | 任务 6 | ✅ |
| index.ts 统一导出 | 任务 8 | ✅ |
| pnpm type-check 通过 | 任务 9 | ✅ |
| 单元测试覆盖边界 | 任务 1-9 | ✅ |

**占位符扫描：** 无 TBD / TODO / 稍后实现。

**类型一致性：** 所有任务中的类型签名一致（IRetriever 入参统一为 `Query`，返回值统一为 `RetrievalCandidate[]`）。
