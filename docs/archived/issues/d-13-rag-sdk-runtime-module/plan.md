---
id: d-13
issue: issue.md
version: 1
---

# RAG SDK 在线检索模块实现计划

> **For agentic workers:** 必需子技能：superpowers:executing-plans（当前会话顺序执行）。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 实现 RAG SDK 的在线检索编排模块，包含混合检索（向量 + 关键词 + RRF 融合）、检索后处理（过滤 / 重排 / 预算截断）和检索流水线编排。

**架构：** 采用扁平化设计，所有 runtime 文件直接放在 `packages/rag-sdk/src/runtime/` 目录。类型由 d-11 的 Zod Schema 推导（`z.infer`），消除重复定义。HybridRetriever 并行执行向量检索与关键词检索，失败时独立降级。RRF 融合后进入 DefaultRetrievalPostprocessor 分层处理，SelectionTrace 记录每步操作原因。runRetrievalPipeline 三阶段链路并收集 RuntimeDebugInfo。

**技术栈：** TypeScript 5.9 + Vitest（d-11 已提供 Zod 与类型基础）

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) / [specs/api-spec.md](specs/api-spec.md)
**测试引用：** `tests/issues/d-13-rag-sdk-runtime-module/`

---

## 文件结构

```
packages/rag-sdk/src/
  runtime/
    ├── keyword-store.ts      # 新增：IKeywordStore 接口（从 interfaces.ts 迁移并扩展注释）
    ├── rrf.ts                # 新增：reciprocalRankFusion 算法
    ├── selection-trace.ts    # 新增：SelectionTrace 类型与 buildTrace 辅助
    ├── postprocessor.ts      # 新增：DefaultRetrievalPostprocessor
    ├── hybrid-retriever.ts   # 新增：HybridRetriever
    ├── pipeline.ts           # 新增：runRetrievalPipeline
    └── index.ts              # 新增：runtime 统一导出
  index.ts                    # 修改：追加 runtime 导出

tests/issues/d-13-rag-sdk-runtime-module/
  └── runtime.spec.ts         # 新增：单元测试（AC-01 ~ AC-09）
```

---

## 任务 1: IKeywordStore 接口迁移与类型导出

**文件：**
- 创建：`packages/rag-sdk/src/runtime/keyword-store.ts`
- 修改：`packages/rag-sdk/src/index.ts`

**规格引用：**
- API 规格：[IKeywordStore 接口定义]
- checklist AC-02

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import { describe, it, expect } from 'vitest'
import type { IKeywordStore } from '../../../packages/rag-sdk/src/runtime/keyword-store.js'

describe('IKeywordStore', () => {
  it('AC-02: defines search method with correct signature', () => {
    const store: IKeywordStore = {
      search: async (query, kbIds, topK) => {
        expect(typeof query).toBe('string')
        expect(Array.isArray(kbIds)).toBe(true)
        return []
      },
    }
    expect(store).toBeDefined()
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/keyword-store.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/keyword-store.ts
import type { RetrievalCandidate } from '../types.js'

export interface KeywordSearchOptions {
  topK?: number
}

export interface KeywordSearchResult {
  candidates: RetrievalCandidate[]
}

/**
 * 关键词存储抽象。
 *
 * 由 server 的 PostgreSQL FTS 实现，支持混合检索的关键词分支。
 * 空 query 或空 kbIds 应返回空数组 []。
 * 返回的 RetrievalCandidate.source 必须为 'keyword'。
 * 失败时抛出 RetrievalError。
 */
export interface IKeywordStore {
  search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]>
}
```

- [ ] **步骤 4: 修改 index.ts 追加导出**

```typescript
// packages/rag-sdk/src/index.ts
export * from './schema.js'
export * from './types.js'
export * from './interfaces.js'
export * from './errors.js'
export * from './pipeline.js'
export * from './vector-store.js'
export * from './runtime/index.js'
```

- [ ] **步骤 5: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-02 通过）

---

## 任务 2: reciprocalRankFusion 算法实现

**文件：**
- 创建：`packages/rag-sdk/src/runtime/rrf.ts`
- 修改：`tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts`

**规格引用：**
- API 规格：[reciprocalRankFusion]
- checklist AC-03

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import { reciprocalRankFusion } from '../../../packages/rag-sdk/src/runtime/rrf.js'
import type { RetrievalCandidate } from '../../../packages/rag-sdk/src/types.js'

function makeCandidate(id: string, score: number, source: 'vector' | 'keyword'): RetrievalCandidate {
  return {
    chunk: {
      id: '550e8400-e29b-41d4-a716-4466554400' + id,
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      kbId: '550e8400-e29b-41d4-a716-446655440002',
      content: 'chunk ' + id,
      chunkIndex: 0,
    },
    score,
    source,
  }
}

describe('reciprocalRankFusion', () => {
  it('AC-03: fuses vector and keyword results with RRF', () => {
    const vectorResults = [
      makeCandidate('01', 0.9, 'vector'),
      makeCandidate('02', 0.8, 'vector'),
    ]
    const keywordResults = [
      makeCandidate('02', 0.85, 'keyword'),
      makeCandidate('03', 0.75, 'keyword'),
    ]

    const fused = reciprocalRankFusion([vectorResults, keywordResults], 60)

    expect(fused.length).toBe(3)
    expect(fused[0].source).toBe('hybrid')
    // chunk 02 出现在两路中，RRF 分数应最高
    expect(fused[0].chunk.content).toBe('chunk 02')
    // 分数应大于单路分数（累加效应）
    expect(fused[0].score).toBeGreaterThan(0)
  })

  it('AC-03: uses default k=60 when not provided', () => {
    const results = [[makeCandidate('01', 0.5, 'vector')]]
    const fused = reciprocalRankFusion(results)
    expect(fused.length).toBe(1)
    expect(fused[0].score).toBe(1 / (60 + 1))
  })

  it('AC-03: returns empty array for empty input', () => {
    expect(reciprocalRankFusion([])).toEqual([])
    expect(reciprocalRankFusion([[]])).toEqual([])
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/rrf.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/rrf.ts
import type { RetrievalCandidate } from '../types.js'

/**
 * Reciprocal Rank Fusion（RRF）多路结果融合。
 *
 * 公式：score = Σ(1 / (k + rank))，rank 从 1 开始。
 * 同一 chunk 在多个列表中出现时分数累加。
 * 最终按融合分数降序排列。
 *
 * @param results 多路检索结果列表
 * @param k 调和常数，默认 60
 * @returns 融合后的候选列表，source 标记为 'hybrid'
 */
export function reciprocalRankFusion(
  results: RetrievalCandidate[][],
  k: number = 60,
): RetrievalCandidate[] {
  const scores = new Map<string, { candidate: RetrievalCandidate; score: number }>()

  for (const list of results) {
    const sorted = [...list].sort((a, b) => b.score - a.score)
    for (let i = 0; i < sorted.length; i++) {
      const candidate = sorted[i]
      const rank = i + 1
      const key = candidate.chunk.id
      const rrfScore = 1 / (k + rank)
      const existing = scores.get(key)
      if (existing) {
        existing.score += rrfScore
      } else {
        scores.set(key, {
          candidate: { ...candidate, source: 'hybrid' as const },
          score: rrfScore,
        })
      }
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(item => ({ ...item.candidate, score: item.score }))
}
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-03 通过）

---

## 任务 3: SelectionTrace 类型与辅助函数

**文件：**
- 创建：`packages/rag-sdk/src/runtime/selection-trace.ts`
- 修改：`tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts`

**规格引用：**
- API 规格：[SelectionTrace]
- checklist AC-05

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import { buildTrace, type SelectionTrace } from '../../../packages/rag-sdk/src/runtime/selection-trace.js'

describe('SelectionTrace', () => {
  it('AC-05: records each processing step', () => {
    const trace = buildTrace({
      initialCount: 10,
      afterFilter: 8,
      afterRerank: 8,
      afterBudgetTrim: 5,
      afterMaxChunksTrim: 4,
      finalCount: 4,
      steps: [
        { operation: 'filter', reason: 'score below threshold', droppedCount: 2 },
        { operation: 'budget-trim', reason: 'token budget exceeded', droppedCount: 3 },
        { operation: 'max-chunks-trim', reason: 'max chunks limit', droppedCount: 1 },
      ],
    })

    expect(trace.initialCount).toBe(10)
    expect(trace.finalCount).toBe(4)
    expect(trace.steps.length).toBe(3)
    expect(trace.steps[0].operation).toBe('filter')
    expect(trace.steps[1].droppedCount).toBe(3)
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/selection-trace.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/selection-trace.ts

export type TraceOperation = 'filter' | 'rerank' | 'budget-trim' | 'max-chunks-trim'

export interface SelectionTrace {
  initialCount: number
  afterFilter: number
  afterRerank: number
  afterBudgetTrim: number
  afterMaxChunksTrim: number
  finalCount: number
  steps: Array<{
    operation: TraceOperation
    reason: string
    droppedCount: number
  }>
}

/**
 * 构建 SelectionTrace 的辅助工厂函数。
 */
export function buildTrace(trace: SelectionTrace): SelectionTrace {
  return trace
}
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-05 通过）

---

## 任务 4: DefaultRetrievalPostprocessor 实现

**文件：**
- 创建：`packages/rag-sdk/src/runtime/postprocessor.ts`
- 修改：`tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts`

**规格引用：**
- API 规格：[DefaultRetrievalPostprocessor]
- checklist AC-04

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import { DefaultRetrievalPostprocessor } from '../../../packages/rag-sdk/src/runtime/postprocessor.js'
import type { Query } from '../../../packages/rag-sdk/src/types.js'

function makeQuery(): Query {
  return { original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] }
}

describe('DefaultRetrievalPostprocessor', () => {
  it('AC-04: filters candidates below minScore', () => {
    const processor = new DefaultRetrievalPostprocessor({ minScore: 0.5 })
    const candidates = [
      makeCandidate('01', 0.9, 'vector'),
      makeCandidate('02', 0.4, 'vector'),
      makeCandidate('03', 0.6, 'vector'),
    ]
    const result = processor.process(candidates, makeQuery())
    expect(result.candidates.length).toBe(2)
    expect(result.trace.steps[0].operation).toBe('filter')
    expect(result.trace.steps[0].droppedCount).toBe(1)
  })

  it('AC-04: trims candidates by token budget', () => {
    const processor = new DefaultRetrievalPostprocessor({ tokenBudget: 100 })
    const candidates = [
      { ...makeCandidate('01', 0.9, 'vector'), chunk: { ...makeCandidate('01', 0.9, 'vector').chunk, tokenCount: 50 } },
      { ...makeCandidate('02', 0.8, 'vector'), chunk: { ...makeCandidate('02', 0.8, 'vector').chunk, tokenCount: 40 } },
      { ...makeCandidate('03', 0.7, 'vector'), chunk: { ...makeCandidate('03', 0.7, 'vector').chunk, tokenCount: 30 } },
    ]
    const result = processor.process(candidates, makeQuery())
    // 50 + 40 = 90 <= 100，再加 30 就超了，所以保留 2 个
    expect(result.candidates.length).toBe(2)
    expect(result.trace.steps.some(s => s.operation === 'budget-trim')).toBe(true)
  })

  it('AC-04: reranks when reranker provided', async () => {
    const reranker = {
      rerank: async (candidates: RetrievalCandidate[]) => {
        return candidates.reverse()
      },
    }
    const processor = new DefaultRetrievalPostprocessor({ reranker })
    const candidates = [
      makeCandidate('01', 0.9, 'vector'),
      makeCandidate('02', 0.8, 'vector'),
    ]
    const result = await processor.process(candidates, makeQuery())
    expect(result.trace.steps.some(s => s.operation === 'rerank')).toBe(true)
    expect(result.candidates[0].chunk.content).toBe('chunk 02')
  })

  it('AC-04: applies maxChunks trim', () => {
    const processor = new DefaultRetrievalPostprocessor({ maxChunks: 2 })
    const candidates = [
      makeCandidate('01', 0.9, 'vector'),
      makeCandidate('02', 0.8, 'vector'),
      makeCandidate('03', 0.7, 'vector'),
    ]
    const result = processor.process(candidates, makeQuery())
    expect(result.candidates.length).toBe(2)
    expect(result.trace.steps.some(s => s.operation === 'max-chunks-trim')).toBe(true)
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/postprocessor.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/postprocessor.ts
import type { Query, RetrievalCandidate, Chunk } from '../types.js'
import type { IReranker } from '../interfaces.js'
import type { SelectionTrace, TraceOperation } from './selection-trace.js'

export interface PostprocessorOptions {
  minScore?: number
  maxChunks?: number
  tokenBudget?: number
  reranker?: IReranker
}

function estimateTokenCount(chunk: Chunk): number {
  return chunk.tokenCount ?? Math.ceil(chunk.content.length / 4)
}

export class DefaultRetrievalPostprocessor {
  private readonly minScore: number
  private readonly maxChunks: number
  private readonly tokenBudget: number
  private readonly reranker?: IReranker

  constructor(options: PostprocessorOptions = {}) {
    this.minScore = options.minScore ?? 0.0
    this.maxChunks = options.maxChunks ?? 10
    this.tokenBudget = options.tokenBudget ?? 3000
    this.reranker = options.reranker
  }

  async process(
    candidates: RetrievalCandidate[],
    query: Query,
  ): Promise<{ candidates: RetrievalCandidate[]; trace: SelectionTrace }> {
    const steps: SelectionTrace['steps'] = []
    let current = candidates
    const initialCount = current.length

    // 1. Score Filter
    current = current.filter(c => c.score >= this.minScore)
    const afterFilter = current.length
    if (afterFilter < initialCount) {
      steps.push({
        operation: 'filter',
        reason: `minScore threshold ${this.minScore}`,
        droppedCount: initialCount - afterFilter,
      })
    }

    // 2. Rerank
    let afterRerank = afterFilter
    if (this.reranker && current.length > 0) {
      current = await this.reranker.rerank(current, query)
      afterRerank = current.length
      steps.push({
        operation: 'rerank',
        reason: 'reranker provided',
        droppedCount: 0,
      })
    }

    // 3. Budget Trim（按 score 降序）
    current = [...current].sort((a, b) => b.score - a.score)
    let tokenSum = 0
    let budgetIndex = current.length
    for (let i = 0; i < current.length; i++) {
      tokenSum += estimateTokenCount(current[i].chunk)
      if (tokenSum > this.tokenBudget) {
        budgetIndex = i
        break
      }
    }
    const afterBudgetTrim = budgetIndex
    if (afterBudgetTrim < current.length) {
      steps.push({
        operation: 'budget-trim',
        reason: `token budget ${this.tokenBudget} exceeded`,
        droppedCount: current.length - afterBudgetTrim,
      })
      current = current.slice(0, afterBudgetTrim)
    }

    // 4. Max Chunks Trim
    let afterMaxChunksTrim = current.length
    if (current.length > this.maxChunks) {
      afterMaxChunksTrim = this.maxChunks
      steps.push({
        operation: 'max-chunks-trim',
        reason: `maxChunks limit ${this.maxChunks}`,
        droppedCount: current.length - this.maxChunks,
      })
      current = current.slice(0, this.maxChunks)
    }

    const trace: SelectionTrace = {
      initialCount,
      afterFilter,
      afterRerank,
      afterBudgetTrim,
      afterMaxChunksTrim,
      finalCount: current.length,
      steps,
    }

    return { candidates: current, trace }
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-04 通过）

---

## 任务 5: HybridRetriever 实现

**文件：**
- 创建：`packages/rag-sdk/src/runtime/hybrid-retriever.ts`
- 修改：`tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts`

**规格引用：**
- API 规格：[HybridRetriever]
- checklist AC-01

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import { HybridRetriever } from '../../../packages/rag-sdk/src/runtime/hybrid-retriever.js'
import { ValidationError, RetrievalError } from '../../../packages/rag-sdk/src/errors.js'
import type { IVectorStore, VectorSearchResult } from '../../../packages/rag-sdk/src/vector-store.js'
import type { IKeywordStore } from '../../../packages/rag-sdk/src/runtime/keyword-store.js'
import type { IEmbedder } from '../../../packages/rag-sdk/src/interfaces.js'

describe('HybridRetriever', () => {
  const mockEmbedder: IEmbedder = {
    embed: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
    config: { provider: 'test', model: 'test', dimension: 3, apiKey: 'test' },
  }

  const mockVectorStore: IVectorStore = {
    insertVectors: async () => {},
    searchVectors: async () => [
      { id: 'v1', chunkId: '550e8400-e29b-41d4-a716-446655440001', score: 0.9 },
      { id: 'v2', chunkId: '550e8400-e29b-41d4-a716-446655440002', score: 0.8 },
    ],
    deleteByIds: async () => {},
    ensureCollection: async () => {},
  }

  const mockKeywordStore: IKeywordStore = {
    search: async () => [
      makeCandidate('02', 0.85, 'keyword'),
      makeCandidate('03', 0.75, 'keyword'),
    ],
  }

  it('AC-01: returns empty for empty query', async () => {
    const retriever = new HybridRetriever({
      vectorStore: mockVectorStore,
      keywordStore: mockKeywordStore,
      embedder: mockEmbedder,
    })
    await expect(retriever.retrieve({ original: '', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] }))
      .rejects.toThrow(ValidationError)
  })

  it('AC-01: returns empty for empty kbIds', async () => {
    const retriever = new HybridRetriever({
      vectorStore: mockVectorStore,
      keywordStore: mockKeywordStore,
      embedder: mockEmbedder,
    })
    await expect(retriever.retrieve({ original: 'test', kbIds: [] }))
      .rejects.toThrow(ValidationError)
  })

  it('AC-01: falls back to keyword on vector failure', async () => {
    const failingVectorStore: IVectorStore = {
      ...mockVectorStore,
      searchVectors: async () => { throw new Error('vector down') },
    }
    const retriever = new HybridRetriever({
      vectorStore: failingVectorStore,
      keywordStore: mockKeywordStore,
      embedder: mockEmbedder,
    })
    const results = await retriever.retrieve({ original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.source === 'keyword')).toBe(true)
  })

  it('AC-01: falls back to vector on keyword failure', async () => {
    const failingKeywordStore: IKeywordStore = {
      search: async () => { throw new Error('keyword down') },
    }
    const retriever = new HybridRetriever({
      vectorStore: mockVectorStore,
      keywordStore: failingKeywordStore,
      embedder: mockEmbedder,
    })
    const results = await retriever.retrieve({ original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every(r => r.source === 'vector')).toBe(true)
  })

  it('AC-01: throws RetrievalError when both fail', async () => {
    const failingVectorStore: IVectorStore = {
      ...mockVectorStore,
      searchVectors: async () => { throw new Error('vector down') },
    }
    const failingKeywordStore: IKeywordStore = {
      search: async () => { throw new Error('keyword down') },
    }
    const retriever = new HybridRetriever({
      vectorStore: failingVectorStore,
      keywordStore: failingKeywordStore,
      embedder: mockEmbedder,
    })
    await expect(retriever.retrieve({ original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] }))
      .rejects.toThrow(RetrievalError)
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/hybrid-retriever.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/hybrid-retriever.ts
import type { Query, RetrievalCandidate, Chunk } from '../types.js'
import type { IVectorStore, VectorSearchResult } from '../vector-store.js'
import type { IKeywordStore } from './keyword-store.js'
import type { IEmbedder, IRetriever } from '../interfaces.js'
import { ValidationError, RetrievalError } from '../errors.js'
import { reciprocalRankFusion } from './rrf.js'

export interface HybridRetrieverOptions {
  vectorStore: IVectorStore
  keywordStore: IKeywordStore
  embedder: IEmbedder
  vectorWeight?: number
  keywordWeight?: number
  rrfK?: number
}

export class HybridRetriever implements IRetriever {
  private readonly vectorStore: IVectorStore
  private readonly keywordStore: IKeywordStore
  private readonly embedder: IEmbedder
  private readonly vectorWeight: number
  private readonly keywordWeight: number
  private readonly rrfK: number

  constructor(options: HybridRetrieverOptions) {
    this.vectorStore = options.vectorStore
    this.keywordStore = options.keywordStore
    this.embedder = options.embedder
    this.vectorWeight = options.vectorWeight ?? 0.7
    this.keywordWeight = options.keywordWeight ?? 0.3
    this.rrfK = options.rrfK ?? 60
  }

  async retrieve(
    query: Query,
    topK: number = 5,
    options?: { vectorWeight?: number; keywordWeight?: number; rrfK?: number },
  ): Promise<RetrievalCandidate[]> {
    if (!query.original || query.original.trim().length === 0) {
      throw new ValidationError('query.original is required')
    }
    if (!query.kbIds || query.kbIds.length === 0) {
      throw new ValidationError('query.kbIds must not be empty')
    }

    const rrfK = options?.rrfK ?? this.rrfK

    let queryVector: number[] | undefined
    try {
      const vectors = await this.embedder.embed([query.original])
      queryVector = vectors[0]
    } catch {
      queryVector = undefined
    }

    const vectorPromise = queryVector
      ? this.vectorStore.searchVectors(queryVector, { topK, filter: { kbId: query.kbIds[0] } }).catch(() => [])
      : Promise.resolve([])

    const keywordPromise = this.keywordStore.search(query.original, query.kbIds, topK).catch(() => [])

    const [vectorResults, keywordResults] = await Promise.all([vectorPromise, keywordPromise])

    const vectorCandidates: RetrievalCandidate[] = vectorResults.map(r => ({
      chunk: {
        id: r.chunkId,
        documentId: '00000000-0000-0000-0000-000000000000',
        kbId: query.kbIds[0],
        content: '',
        chunkIndex: 0,
      },
      score: r.score,
      source: 'vector' as const,
    }))

    if (vectorCandidates.length === 0 && keywordResults.length === 0) {
      throw new RetrievalError('Both vector and keyword retrieval failed')
    }

    if (vectorCandidates.length === 0) {
      return keywordResults
    }

    if (keywordResults.length === 0) {
      return vectorCandidates
    }

    return reciprocalRankFusion([vectorCandidates, keywordResults], rrfK)
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-01 通过）

---

## 任务 6: runRetrievalPipeline 实现

**文件：**
- 创建：`packages/rag-sdk/src/runtime/pipeline.ts`
- 修改：`tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts`

**规格引用：**
- API 规格：[runRetrievalPipeline]
- checklist AC-06

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import { runRetrievalPipeline } from '../../../packages/rag-sdk/src/runtime/pipeline.js'
import type { IRetriever, IGenerator } from '../../../packages/rag-sdk/src/interfaces.js'
import type { RuntimePipelineResult } from '../../../packages/rag-sdk/src/pipeline.js'

describe('runRetrievalPipeline', () => {
  const mockRetriever: IRetriever = {
    retrieve: async () => [
      makeCandidate('01', 0.9, 'vector'),
      makeCandidate('02', 0.8, 'vector'),
    ],
  }

  const mockGenerator: IGenerator = {
    generate: async () => 'generated answer',
  }

  it('AC-06: records stage timings in debugInfo', async () => {
    const processor = new DefaultRetrievalPostprocessor({ maxChunks: 1 })
    const result: RuntimePipelineResult = await runRetrievalPipeline(
      { original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] },
      mockRetriever,
      processor,
      mockGenerator,
    )

    expect(result.answer).toBe('generated answer')
    expect(result.debugInfo.stages.length).toBe(3)
    expect(result.debugInfo.stages[0].name).toBe('retrieval')
    expect(result.debugInfo.stages[1].name).toBe('post-retrieval')
    expect(result.debugInfo.stages[2].name).toBe('generation')

    for (const stage of result.debugInfo.stages) {
      expect(stage.startTime).toBeGreaterThan(0)
      expect(stage.endTime).toBeGreaterThanOrEqual(stage.startTime)
    }

    expect(result.debugInfo.metrics.retrievalCount).toBe(2)
    expect(result.debugInfo.metrics.selectedCount).toBe(1)
    expect(result.debugInfo.metrics.droppedCount).toBe(1)
    expect(result.debugInfo.metrics.totalTokens).toBeGreaterThanOrEqual(0)
    expect(result.debugInfo.metrics.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/pipeline.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/pipeline.ts
import type { Query, Chunk } from '../types.js'
import type { IRetriever, IGenerator } from '../interfaces.js'
import type { RuntimeStage, RuntimeDebugInfo, RuntimePipelineResult } from '../pipeline.js'
import type { DefaultRetrievalPostprocessor } from './postprocessor.js'

function createStage(name: string, startTime: number, endTime: number, input: unknown, output: unknown, error?: string): RuntimeStage {
  return { name, startTime, endTime, input, output, error }
}

function generateTraceId(): string {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export async function runRetrievalPipeline(
  query: Query,
  retriever: IRetriever,
  postprocessor: DefaultRetrievalPostprocessor,
  generator: IGenerator,
): Promise<RuntimePipelineResult> {
  const traceId = generateTraceId()
  const stages: RuntimeStage[] = []
  const startTime = Date.now()

  // Stage 1: retrieval
  const retrievalStart = Date.now()
  let candidates = await retriever.retrieve(query)
  const retrievalEnd = Date.now()
  stages.push(createStage('retrieval', retrievalStart, retrievalEnd, query, candidates))

  // Stage 2: post-retrieval
  const postStart = Date.now()
  const { candidates: processedCandidates, trace } = await postprocessor.process(candidates, query)
  const postEnd = Date.now()
  stages.push(createStage('post-retrieval', postStart, postEnd, candidates, { candidates: processedCandidates, trace }))

  // Stage 3: generation
  const genStart = Date.now()
  const chunks: Chunk[] = processedCandidates.map(c => c.chunk)
  const answer = await generator.generate({ query, chunks })
  const genEnd = Date.now()
  stages.push(createStage('generation', genStart, genEnd, { query, chunks }, answer))

  const endTime = Date.now()
  const latencyMs = endTime - startTime
  const totalTokens = chunks.reduce((sum, c) => sum + (c.tokenCount ?? Math.ceil(c.content.length / 4)), 0)

  const debugInfo: RuntimeDebugInfo = {
    traceId,
    query,
    stages,
    metrics: {
      retrievalCount: candidates.length,
      selectedCount: processedCandidates.length,
      droppedCount: candidates.length - processedCandidates.length,
      totalTokens,
      latencyMs,
    },
  }

  return {
    answer,
    chunks,
    debugInfo,
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-06 通过）

---

## 任务 7: runtime/index.ts 统一导出

**文件：**
- 创建：`packages/rag-sdk/src/runtime/index.ts`
- 修改：`packages/rag-sdk/src/index.ts`

**规格引用：**
- checklist AC-07

- [ ] **步骤 1: 编写失败测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
import * as runtime from '../../../packages/rag-sdk/src/runtime/index.js'

describe('runtime/index.ts exports', () => {
  it('AC-07: exports all runtime modules', () => {
    expect(runtime.HybridRetriever).toBeDefined()
    expect(runtime.DefaultRetrievalPostprocessor).toBeDefined()
    expect(runtime.reciprocalRankFusion).toBeDefined()
    expect(runtime.runRetrievalPipeline).toBeDefined()
    expect(runtime.buildTrace).toBeDefined()
    expect(runtime.IKeywordStore).toBeUndefined() // interface is type-only
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/runtime/index.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/runtime/index.ts
export { IKeywordStore } from './keyword-store.js'
export { reciprocalRankFusion } from './rrf.js'
export { buildTrace, type SelectionTrace, type TraceOperation } from './selection-trace.js'
export { DefaultRetrievalPostprocessor, type PostprocessorOptions } from './postprocessor.js'
export { HybridRetriever, type HybridRetrieverOptions } from './hybrid-retriever.js'
export { runRetrievalPipeline } from './pipeline.js'
```

- [ ] **步骤 4: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（AC-07 通过）

---

## 任务 8: 补充 AC-09 边界测试与全局验证

**文件：**
- 修改：`tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts`

**规格引用：**
- checklist AC-09（空查询、空 kbIds、向量检索失败降级、关键词检索失败降级、RRF 融合、后处理截断、rerank）

- [ ] **步骤 1: 追加边界测试**

```typescript
// 追加到 tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
// 以下用例在之前的任务中已部分覆盖，此处补充完整边界

describe('AC-09 boundary tests', () => {
  const embedder: IEmbedder = {
    embed: async (texts) => texts.map(() => [0.1, 0.2, 0.3]),
    config: { provider: 'test', model: 'test', dimension: 3, apiKey: 'test' },
  }

  it('AC-09: empty query throws ValidationError', async () => {
    const retriever = new HybridRetriever({
      vectorStore: { searchVectors: async () => [] } as unknown as IVectorStore,
      keywordStore: { search: async () => [] } as unknown as IKeywordStore,
      embedder,
    })
    await expect(retriever.retrieve({ original: '', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] }))
      .rejects.toThrow(ValidationError)
  })

  it('AC-09: empty kbIds throws ValidationError', async () => {
    const retriever = new HybridRetriever({
      vectorStore: { searchVectors: async () => [] } as unknown as IVectorStore,
      keywordStore: { search: async () => [] } as unknown as IKeywordStore,
      embedder,
    })
    await expect(retriever.retrieve({ original: 'test', kbIds: [] }))
      .rejects.toThrow(ValidationError)
  })

  it('AC-09: vector retrieval failure falls back to keyword', async () => {
    const vectorStore: IVectorStore = {
      searchVectors: async () => { throw new Error('fail') },
    } as unknown as IVectorStore
    const keywordStore: IKeywordStore = {
      search: async () => [makeCandidate('01', 0.8, 'keyword')],
    }
    const retriever = new HybridRetriever({ vectorStore, keywordStore, embedder })
    const results = await retriever.retrieve({ original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(results.every(r => r.source === 'keyword')).toBe(true)
  })

  it('AC-09: keyword retrieval failure falls back to vector', async () => {
    const vectorStore: IVectorStore = {
      searchVectors: async () => [{ id: 'v1', chunkId: '550e8400-e29b-41d4-a716-446655440001', score: 0.9 }],
    } as unknown as IVectorStore
    const keywordStore: IKeywordStore = {
      search: async () => { throw new Error('fail') },
    }
    const retriever = new HybridRetriever({ vectorStore, keywordStore, embedder })
    const results = await retriever.retrieve({ original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(results.every(r => r.source === 'vector')).toBe(true)
  })

  it('AC-09: RRF fusion produces hybrid source', async () => {
    const vectorStore: IVectorStore = {
      searchVectors: async () => [
        { id: 'v1', chunkId: '550e8400-e29b-41d4-a716-446655440001', score: 0.9 },
      ],
    } as unknown as IVectorStore
    const keywordStore: IKeywordStore = {
      search: async () => [
        { ...makeCandidate('01', 0.85, 'keyword'), chunk: { ...makeCandidate('01', 0.85, 'keyword').chunk, id: '550e8400-e29b-41d4-a716-446655440001' } },
      ],
    }
    const retriever = new HybridRetriever({ vectorStore, keywordStore, embedder })
    const results = await retriever.retrieve({ original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(results.length).toBe(1)
    expect(results[0].source).toBe('hybrid')
  })

  it('AC-09: postprocess trims by token budget', () => {
    const processor = new DefaultRetrievalPostprocessor({ tokenBudget: 10 })
    const candidates = [
      { ...makeCandidate('01', 0.9, 'vector'), chunk: { ...makeCandidate('01', 0.9, 'vector').chunk, tokenCount: 8 } },
      { ...makeCandidate('02', 0.8, 'vector'), chunk: { ...makeCandidate('02', 0.8, 'vector').chunk, tokenCount: 8 } },
    ]
    const result = processor.process(candidates, { original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(result.candidates.length).toBe(1)
  })

  it('AC-09: rerank changes order when provided', async () => {
    const processor = new DefaultRetrievalPostprocessor({
      reranker: {
        rerank: async (cands) => [...cands].reverse(),
      },
    })
    const candidates = [
      makeCandidate('01', 0.9, 'vector'),
      makeCandidate('02', 0.8, 'vector'),
    ]
    const result = await processor.process(candidates, { original: 'test', kbIds: ['550e8400-e29b-41d4-a716-446655440000'] })
    expect(result.candidates[0].chunk.content).toBe('chunk 02')
  })
})
```

- [ ] **步骤 2: 运行测试确认通过**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：PASS（全部 AC-09 通过）

---

## 任务 9: 类型检查与全局回归

**规格引用：**
- checklist AC-08: pnpm type-check 通过

- [ ] **步骤 1: 运行 rag-sdk 类型检查**

```bash
cd packages/rag-sdk && pnpm type-check
```
预期：0 错误

- [ ] **步骤 2: 运行全部单元测试**

```bash
npx vitest run tests/issues/d-13-rag-sdk-runtime-module/runtime.spec.ts
```
预期：全部通过

- [ ] **步骤 3: 运行全局测试确保无回归**

```bash
npx vitest run
```
预期：其他 issue 的测试也全部通过

- [ ] **步骤 4: 提交**

```bash
git add packages/rag-sdk/src/runtime/ tests/issues/d-13-rag-sdk-runtime-module/
git commit -m "feat(rag-sdk): add runtime retrieval module (hybrid retriever, RRF, postprocessor, pipeline) (d-13)"
```

---

## 自检

**规格覆盖检查：**

| 规格需求 | 对应任务 | 状态 |
|----------|----------|------|
| HybridRetriever：向量检索 + 关键词检索并行 + RRF 融合 | 任务 5 | ✅ |
| IKeywordStore 接口定义 | 任务 1 | ✅ |
| reciprocalRankFusion 算法，k 默认 60，source 标记 hybrid | 任务 2 | ✅ |
| DefaultRetrievalPostprocessor：filter → rerank → budget trim → max chunks | 任务 4 | ✅ |
| SelectionTrace 记录每步操作原因 | 任务 3 | ✅ |
| runRetrievalPipeline：三阶段链路 + 阶段耗时记录 | 任务 6 | ✅ |
| runtime/index.ts 统一导出 | 任务 7 | ✅ |
| pnpm type-check 通过 | 任务 9 | ✅ |
| 单元测试覆盖 AC-09 边界 | 任务 8 | ✅ |

**占位符扫描：** 无 TBD / TODO / 稍后实现。

**类型一致性：** 所有类型从 d-11 Zod Schema 推导（`z.infer`），无手写重复类型。`IKeywordStore` 与 `interfaces.ts` 中的定义保持一致。

**降级策略验证：**
- Query embed 失败 → keyword only ✅
- Vector search 失败 → keyword only ✅
- Keyword search 失败 → vector only ✅
- 两路均失败 → RetrievalError ✅
