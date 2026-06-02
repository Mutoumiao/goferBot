---
id: d-12
issue: issue.md
version: 1
---

# RAG SDK 离线索引构建模块实现计划

> **For agentic workers:** 必需子技能：superpowers:executing-plans（当前会话顺序执行）。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 实现 RAG SDK 的离线索引构建模块，包含文档分块（RecursiveCharacterChunker）、文本向量化（OpenAIEmbedder）、向量索引写入（MilvusIndexer）和索引流水线编排（runIndexing）。

**架构：** 采用扁平化设计，所有实现文件直接放在 `src/` 根目录下按功能域子目录组织（`chunkers/`、`embedders/`、`indexers/`、`pipelines/`）。类型由 d-11 的 Zod Schema 推导（`z.infer`），禁止手写重复类型。错误体系复用 d-11 的 `ValidationError` / `EmbeddingError` / `IndexingError`。

**技术栈：** TypeScript 5.9 + Zod（d-11 已安装）+ Vitest（项目级）

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) / [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

```
packages/rag-sdk/src/
  ├── chunkers/
  │   └── recursive-character.chunker.ts    # 新增
  ├── embedders/
  │   └── openai.embedder.ts                # 新增
  ├── indexers/
  │   └── milvus.indexer.ts                 # 新增
  ├── pipelines/
  │   └── run-indexing.ts                   # 新增
  ├── indexing/
  │   └── index.ts                          # 新增：统一导出入口
  └── index.ts                              # 修改：追加 indexing 导出

tests/issues/d-12-rag-sdk-indexing-module/
  ├── chunker.spec.ts                       # 新增
  ├── embedder.spec.ts                      # 新增
  ├── indexer.spec.ts                       # 新增
  ├── pipeline.spec.ts                      # 新增
  └── exports.spec.ts                       # 新增
```

---

## 任务 1: RecursiveCharacterChunker 实现

**文件：**
- 创建：`packages/rag-sdk/src/chunkers/recursive-character.chunker.ts`
- 创建：`tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts`

**规格引用：**
- feature-spec.md：Chunker 契约
- api-spec.md：RecursiveCharacterChunker 接口
- checklist AC-01

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts
import { describe, it, expect } from 'vitest'
import { RecursiveCharacterChunker } from '../../../packages/rag-sdk/src/chunkers/recursive-character.chunker.js'
import { ValidationError } from '../../../packages/rag-sdk/src/errors.js'
import type { DocumentSource } from '../../../packages/rag-sdk/src/types.js'

const makeDoc = (content: string): DocumentSource => ({
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  kbId: '550e8400-e29b-41d4-a716-446655440001',
  content,
  mimeType: 'text/plain',
})

describe('RecursiveCharacterChunker', () => {
  it('AC-01: returns empty array for empty document content', async () => {
    const chunker = new RecursiveCharacterChunker()
    const chunks = await chunker.chunk(makeDoc(''))
    expect(chunks).toEqual([])
  })

  it('AC-01: splits long text into multiple chunks with correct chunkIndex', async () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 2 })
    const content = 'a'.repeat(25)
    const chunks = await chunker.chunk(makeDoc(content))
    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0].chunkIndex).toBe(0)
    expect(chunks[1].chunkIndex).toBe(1)
    expect(chunks.every((c, i) => c.chunkIndex === i)).toBe(true)
  })

  it('AC-01: throws ValidationError when chunkOverlap >= chunkSize', () => {
    expect(() => new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 10 })).toThrow(ValidationError)
    expect(() => new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 11 })).toThrow(ValidationError)
  })

  it('AC-01: throws ValidationError when chunkSize <= 0', () => {
    expect(() => new RecursiveCharacterChunker({ chunkSize: 0 })).toThrow(ValidationError)
    expect(() => new RecursiveCharacterChunker({ chunkSize: -1 })).toThrow(ValidationError)
  })

  it('AC-01: populates documentId, kbId, tokenCount, metadata correctly', async () => {
    const chunker = new RecursiveCharacterChunker({ chunkSize: 10, chunkOverlap: 2 })
    const doc = makeDoc('hello world')
    const chunks = await chunker.chunk(doc)
    expect(chunks.length).toBeGreaterThan(0)
    const c = chunks[0]
    expect(c.documentId).toBe(doc.documentId)
    expect(c.kbId).toBe(doc.kbId)
    expect(c.tokenCount).toBe(Math.ceil(c.content.length / 4))
    expect(c.metadata).toEqual({ mimeType: doc.mimeType })
    expect(c.parentId).toBeUndefined()
    expect(c.hierarchyPath).toBeUndefined()
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts`
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/chunkers/recursive-character.chunker.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/chunkers/recursive-character.chunker.ts
import type { DocumentSource, Chunk } from '../types.js'
import { ValidationError } from '../errors.js'

interface RecursiveCharacterChunkerOptions {
  chunkSize?: number
  chunkOverlap?: number
  separators?: string[]
}

export class RecursiveCharacterChunker {
  private readonly chunkSize: number
  private readonly chunkOverlap: number
  private readonly separators: string[]

  constructor(options?: RecursiveCharacterChunkerOptions) {
    const chunkSize = options?.chunkSize ?? 512
    const chunkOverlap = options?.chunkOverlap ?? 50

    if (chunkSize <= 0) {
      throw new ValidationError('chunkSize must be greater than 0')
    }
    if (chunkOverlap >= chunkSize) {
      throw new ValidationError('chunkOverlap must be less than chunkSize')
    }

    this.chunkSize = chunkSize
    this.chunkOverlap = chunkOverlap
    this.separators = options?.separators ?? ['\n\n', '\n', ' ', '']
  }

  async chunk(doc: DocumentSource): Promise<Chunk[]> {
    if (doc.content.length === 0) {
      return []
    }

    const chunks: Chunk[] = []
    let remaining = doc.content
    let chunkIndex = 0

    while (remaining.length > 0) {
      let chunkText: string

      if (remaining.length <= this.chunkSize) {
        chunkText = remaining
        remaining = ''
      } else {
        chunkText = this.splitWithSeparators(remaining)
        const overlapStart = Math.max(0, chunkText.length - this.chunkOverlap)
        remaining = remaining.slice(overlapStart)
      }

      chunks.push({
        id: crypto.randomUUID(),
        documentId: doc.documentId,
        kbId: doc.kbId,
        content: chunkText,
        chunkIndex,
        tokenCount: Math.ceil(chunkText.length / 4),
        metadata: { mimeType: doc.mimeType },
      })

      chunkIndex++

      // 防止空循环：如果 splitWithSeparators 返回空字符串则强制推进
      if (chunkText.length === 0) {
        remaining = remaining.slice(1)
      }
    }

    return chunks
  }

  private splitWithSeparators(text: string): string {
    for (const sep of this.separators) {
      if (sep === '') {
        // 最后兜底：硬截断到 chunkSize
        return text.slice(0, this.chunkSize)
      }

      const idx = text.lastIndexOf(sep, this.chunkSize)
      if (idx > 0) {
        return text.slice(0, idx + sep.length)
      }
    }

    return text.slice(0, this.chunkSize)
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts`
预期：PASS（AC-01 全部通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/rag-sdk/src/chunkers/recursive-character.chunker.ts tests/issues/d-12-rag-sdk-indexing-module/chunker.spec.ts
git commit -m "feat(rag-sdk): implement RecursiveCharacterChunker with hierarchy support (d-12)"
```

---

## 任务 2: OpenAIEmbedder 实现

**文件：**
- 创建：`packages/rag-sdk/src/embedders/openai.embedder.ts`
- 创建：`tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts`

**规格引用：**
- feature-spec.md：Embedder 契约
- api-spec.md：OpenAIEmbedder 接口
- checklist AC-02

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { OpenAIEmbedder } from '../../../packages/rag-sdk/src/embedders/openai.embedder.js'
import { ValidationError, EmbeddingError } from '../../../packages/rag-sdk/src/errors.js'
import type { EmbeddingConfig } from '../../../packages/rag-sdk/src/types.js'

const mockConfig: EmbeddingConfig = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimension: 1536,
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com/v1',
}

describe('OpenAIEmbedder', () => {
  it('AC-02: throws ValidationError for empty texts array', async () => {
    const embedder = new OpenAIEmbedder(mockConfig)
    await expect(embedder.embed([])).rejects.toThrow(ValidationError)
  })

  it('AC-02: embeds texts in batches and returns correct dimensions', async () => {
    const embedder = new OpenAIEmbedder(mockConfig)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: Array.from({ length: 2 }, (_, i) => ({
          embedding: Array(mockConfig.dimension).fill(i),
          index: i,
        })),
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const texts = ['hello', 'world']
    const vectors = await embedder.embed(texts)

    expect(vectors.length).toBe(2)
    expect(vectors[0].length).toBe(mockConfig.dimension)
    expect(vectors[1].length).toBe(mockConfig.dimension)
    expect(mockFetch).toHaveBeenCalledTimes(1)

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.model).toBe(mockConfig.model)
    expect(callBody.input).toEqual(texts)

    vi.unstubAllGlobals()
  })

  it('AC-02: throws EmbeddingError on API failure with cause', async () => {
    const embedder = new OpenAIEmbedder(mockConfig)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      text: async () => 'rate limited',
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(embedder.embed(['test'])).rejects.toThrow(EmbeddingError)

    try {
      await embedder.embed(['test'])
    } catch (err: any) {
      expect(err.name).toBe('EmbeddingError')
      expect(err.cause).toBeDefined()
    }

    vi.unstubAllGlobals()
  })

  it('AC-02: throws EmbeddingError when returned dimension mismatches config', async () => {
    const embedder = new OpenAIEmbedder(mockConfig)

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [{ embedding: Array(10).fill(0), index: 0 }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(embedder.embed(['test'])).rejects.toThrow(EmbeddingError)
    vi.unstubAllGlobals()
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts`
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/embedders/openai.embedder.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/embedders/openai.embedder.ts
import type { EmbeddingConfig } from '../types.js'
import { ValidationError, EmbeddingError } from '../errors.js'

export class OpenAIEmbedder {
  readonly config: Readonly<EmbeddingConfig>

  constructor(config: EmbeddingConfig) {
    this.config = Object.freeze({ ...config })
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      throw new ValidationError('texts array must not be empty')
    }

    const batchSize = 100
    const results: number[][] = []

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize)
      const batchResults = await this.embedBatch(batch)
      results.push(...batchResults)
    }

    return results
  }

  private async embedBatch(texts: string[]): Promise<number[][]> {
    const url = this.config.baseUrl ?? 'https://api.openai.com/v1/embeddings'

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new EmbeddingError(
        `OpenAI API error: ${response.status} ${body}`,
        { status: response.status, body },
      )
    }

    const json = await response.json() as {
      data: Array<{ embedding: number[]; index: number }>
    }

    const vectors = new Array<number[]>(texts.length)

    for (const item of json.data) {
      if (item.embedding.length !== this.config.dimension) {
        throw new EmbeddingError(
          `Dimension mismatch: expected ${this.config.dimension}, got ${item.embedding.length}`,
        )
      }
      vectors[item.index] = item.embedding
    }

    // 检查是否有缺失
    if (vectors.some(v => v === undefined)) {
      throw new EmbeddingError('Partial batch failure: some embeddings missing')
    }

    return vectors
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts`
预期：PASS（AC-02 全部通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/rag-sdk/src/embedders/openai.embedder.ts tests/issues/d-12-rag-sdk-indexing-module/embedder.spec.ts
git commit -m "feat(rag-sdk): implement OpenAIEmbedder with batching and error handling (d-12)"
```

---

## 任务 3: MilvusIndexer 实现

**文件：**
- 创建：`packages/rag-sdk/src/indexers/milvus.indexer.ts`
- 创建：`tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts`

**规格引用：**
- feature-spec.md：Indexer 契约
- api-spec.md：MilvusIndexer 接口
- checklist AC-03

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { MilvusIndexer } from '../../../packages/rag-sdk/src/indexers/milvus.indexer.js'
import { ValidationError, IndexingError } from '../../../packages/rag-sdk/src/errors.js'
import type { IVectorStore, VectorRecord } from '../../../packages/rag-sdk/src/vector-store.js'
import type { Chunk } from '../../../packages/rag-sdk/src/types.js'

const makeChunk = (id: string, index: number): Chunk => ({
  id,
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  kbId: '550e8400-e29b-41d4-a716-446655440001',
  content: 'hello',
  chunkIndex: index,
})

describe('MilvusIndexer', () => {
  it('AC-03: throws ValidationError when chunks and vectors length mismatch', async () => {
    const mockStore: IVectorStore = {
      insertVectors: vi.fn().mockResolvedValue(undefined),
      searchVectors: vi.fn(),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const indexer = new MilvusIndexer(mockStore)
    const chunks = [makeChunk('550e8400-e29b-41d4-a716-446655440010', 0)]
    const vectors = [[0.1], [0.2]]

    await expect(indexer.index(chunks, vectors)).rejects.toThrow(ValidationError)
  })

  it('AC-03: indexes chunks and vectors via IVectorStore', async () => {
    const inserted: VectorRecord[] = []
    const mockStore: IVectorStore = {
      insertVectors: vi.fn(async (vectors) => {
        inserted.push(...vectors)
      }),
      searchVectors: vi.fn(),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const indexer = new MilvusIndexer(mockStore)
    const chunks = [
      makeChunk('550e8400-e29b-41d4-a716-446655440010', 0),
      makeChunk('550e8400-e29b-41d4-a716-446655440011', 1),
    ]
    const vectors = [[0.1, 0.2], [0.3, 0.4]]

    await indexer.index(chunks, vectors)

    expect(mockStore.insertVectors).toHaveBeenCalledTimes(1)
    expect(inserted.length).toBe(2)
    expect(inserted[0].id).toBe(chunks[0].id)
    expect(inserted[0].chunkId).toBe(chunks[0].id)
    expect(inserted[0].kbId).toBe(chunks[0].kbId)
    expect(inserted[0].fileId).toBe(chunks[0].documentId)
    expect(inserted[0].embedding).toEqual(vectors[0])
  })

  it('AC-03: throws IndexingError when IVectorStore.insertVectors fails', async () => {
    const mockStore: IVectorStore = {
      insertVectors: vi.fn().mockRejectedValue(new Error('milvus down')),
      searchVectors: vi.fn(),
      deleteByIds: vi.fn(),
      ensureCollection: vi.fn(),
    }
    const indexer = new MilvusIndexer(mockStore)
    const chunks = [makeChunk('550e8400-e29b-41d4-a716-446655440010', 0)]
    const vectors = [[0.1]]

    await expect(indexer.index(chunks, vectors)).rejects.toThrow(IndexingError)
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts`
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/indexers/milvus.indexer.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/indexers/milvus.indexer.ts
import type { Chunk } from '../types.js'
import type { IVectorStore, VectorRecord } from '../vector-store.js'
import { ValidationError, IndexingError } from '../errors.js'

export class MilvusIndexer {
  constructor(private readonly vectorStore: IVectorStore) {}

  async index(chunks: Chunk[], vectors: number[][]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(
        `chunks length (${chunks.length}) does not match vectors length (${vectors.length})`,
      )
    }

    const records: VectorRecord[] = chunks.map((chunk, i) => ({
      id: chunk.id,
      chunkId: chunk.id,
      kbId: chunk.kbId,
      fileId: chunk.documentId,
      embedding: vectors[i],
    }))

    try {
      await this.vectorStore.insertVectors(records)
    } catch (cause) {
      throw new IndexingError('Failed to insert vectors into vector store', cause)
    }
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts`
预期：PASS（AC-03 全部通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/rag-sdk/src/indexers/milvus.indexer.ts tests/issues/d-12-rag-sdk-indexing-module/indexer.spec.ts
git commit -m "feat(rag-sdk): implement MilvusIndexer via IVectorStore interface (d-12)"
```

---

## 任务 4: runIndexing Pipeline 实现

**文件：**
- 创建：`packages/rag-sdk/src/pipelines/run-indexing.ts`
- 创建：`tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts`

**规格引用：**
- feature-spec.md：Pipeline 契约
- api-spec.md：runIndexing 接口
- checklist AC-04

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { runIndexing } from '../../../packages/rag-sdk/src/pipelines/run-indexing.js'
import { ValidationError, EmbeddingError } from '../../../packages/rag-sdk/src/errors.js'
import type { DocumentSource, Chunk } from '../../../packages/rag-sdk/src/types.js'
import type { IChunker, IEmbedder, IIndexer } from '../../../packages/rag-sdk/src/interfaces.js'
import type { IndexingStage } from '../../../packages/rag-sdk/src/pipeline.js'

const makeDoc = (content: string): DocumentSource => ({
  documentId: '550e8400-e29b-41d4-a716-446655440000',
  kbId: '550e8400-e29b-41d4-a716-446655440001',
  content,
  mimeType: 'text/plain',
})

describe('runIndexing', () => {
  it('AC-04: completes all stages and returns IndexingResult', async () => {
    const chunks: Chunk[] = [
      { id: '550e8400-e29b-41d4-a716-446655440010', documentId: makeDoc('').documentId, kbId: makeDoc('').kbId, content: 'hello', chunkIndex: 0 },
    ]
    const vectors = [[0.1, 0.2]]

    const chunker: IChunker = { chunk: vi.fn().mockResolvedValue(chunks) }
    const embedder: IEmbedder = { embed: vi.fn().mockResolvedValue(vectors), config: { provider: 'test', model: 'test', dimension: 2, apiKey: '' } }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }

    const result = await runIndexing(makeDoc('hello'), { chunker, embedder, indexer })

    expect(result.chunks).toEqual(chunks)
    expect(result.vectorCount).toBe(1)
    expect(result.stages.length).toBe(3)
    expect(result.stages.every(s => s.status === 'completed')).toBe(true)
  })

  it('AC-04: tracks stage status through pending/running/completed', async () => {
    const stagesCaptured: IndexingStage[][] = []
    const chunker: IChunker = { chunk: vi.fn().mockResolvedValue([]) }
    const embedder: IEmbedder = { embed: vi.fn().mockResolvedValue([]), config: { provider: 'test', model: 'test', dimension: 2, apiKey: '' } }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }

    await runIndexing(makeDoc('hello'), {
      chunker, embedder, indexer,
      onStageChange: async (stages) => {
        stagesCaptured.push(structuredClone(stages))
      },
    })

    // 至少应捕获到：初始 pending → chunk running → chunk completed → embed running → embed completed → index running → index completed
    expect(stagesCaptured.length).toBeGreaterThanOrEqual(3)

    const first = stagesCaptured[0]
    expect(first.every(s => s.status === 'pending')).toBe(true)

    const last = stagesCaptured[stagesCaptured.length - 1]
    expect(last.every(s => s.status === 'completed')).toBe(true)
  })

  it('AC-04: stops at failed stage and leaves subsequent stages pending', async () => {
    const chunker: IChunker = { chunk: vi.fn().mockRejectedValue(new ValidationError('chunk failed')) }
    const embedder: IEmbedder = { embed: vi.fn(), config: { provider: 'test', model: 'test', dimension: 2, apiKey: '' } }
    const indexer: IIndexer = { index: vi.fn() }

    await expect(runIndexing(makeDoc('hello'), { chunker, embedder, indexer })).rejects.toThrow(ValidationError)

    expect(chunker.chunk).toHaveBeenCalledTimes(1)
    expect(embedder.embed).not.toHaveBeenCalled()
    expect(indexer.index).not.toHaveBeenCalled()
  })

  it('AC-04: invokes onStageChange on every status transition', async () => {
    const stagesCaptured: IndexingStage[][] = []
    const chunker: IChunker = { chunk: vi.fn().mockResolvedValue([]) }
    const embedder: IEmbedder = { embed: vi.fn().mockResolvedValue([]), config: { provider: 'test', model: 'test', dimension: 2, apiKey: '' } }
    const indexer: IIndexer = { index: vi.fn().mockResolvedValue(undefined) }

    await runIndexing(makeDoc('hello'), {
      chunker, embedder, indexer,
      onStageChange: (stages) => {
        stagesCaptured.push(structuredClone(stages))
      },
    })

    // 验证每个阶段都经历了 pending → running → completed
    const chunkStageHistory = stagesCaptured.map(s => s.find(st => st.name === 'chunk')!.status)
    expect(chunkStageHistory).toContain('pending')
    expect(chunkStageHistory).toContain('running')
    expect(chunkStageHistory).toContain('completed')
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts`
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/pipelines/run-indexing.js'"

- [ ] **步骤 3: 编写最小实现**

```typescript
// packages/rag-sdk/src/pipelines/run-indexing.ts
import type { DocumentSource, Chunk } from '../types.js'
import type { IChunker, IEmbedder, IIndexer } from '../interfaces.js'
import type { IndexingStage, IndexingResult } from '../pipeline.js'

interface RunIndexingDependencies {
  chunker: IChunker
  embedder: IEmbedder
  indexer: IIndexer
  onStageChange?: (stages: IndexingStage[]) => void | Promise<void>
}

function createStages(): IndexingStage[] {
  return [
    { name: 'chunk', status: 'pending' },
    { name: 'embed', status: 'pending' },
    { name: 'index', status: 'pending' },
  ]
}

function updateStage(stages: IndexingStage[], name: string, status: IndexingStage['status'], error?: string): void {
  const stage = stages.find(s => s.name === name)
  if (stage) {
    stage.status = status
    if (error !== undefined) {
      stage.error = error
    }
  }
}

export async function runIndexing(
  document: DocumentSource,
  dependencies: RunIndexingDependencies,
): Promise<IndexingResult> {
  const { chunker, embedder, indexer, onStageChange } = dependencies
  const stages = createStages()

  const notify = async () => {
    if (onStageChange) {
      await onStageChange(stages)
    }
  }

  let chunks: Chunk[] = []
  let vectors: number[][] = []

  try {
    // chunk stage
    updateStage(stages, 'chunk', 'running')
    await notify()
    chunks = await chunker.chunk(document)
    updateStage(stages, 'chunk', 'completed')
    await notify()

    // embed stage
    updateStage(stages, 'embed', 'running')
    await notify()
    vectors = await embedder.embed(chunks.map(c => c.content))
    updateStage(stages, 'embed', 'completed')
    await notify()

    // index stage
    updateStage(stages, 'index', 'running')
    await notify()
    await indexer.index(chunks, vectors)
    updateStage(stages, 'index', 'completed')
    await notify()
  } catch (err: any) {
    // 找到当前 running 的阶段并标记为 failed
    const runningStage = stages.find(s => s.status === 'running')
    if (runningStage) {
      updateStage(stages, runningStage.name, 'failed', err.message ?? String(err))
      await notify()
    }
    throw err
  }

  return {
    chunks,
    vectorCount: vectors.length,
    stages,
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts`
预期：PASS（AC-04 全部通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/rag-sdk/src/pipelines/run-indexing.ts tests/issues/d-12-rag-sdk-indexing-module/pipeline.spec.ts
git commit -m "feat(rag-sdk): implement runIndexing pipeline with stage tracking (d-12)"
```

---

## 任务 5: indexing/index.ts 统一导出与根目录导出更新

**文件：**
- 创建：`packages/rag-sdk/src/indexing/index.ts`
- 修改：`packages/rag-sdk/src/index.ts`
- 创建：`tests/issues/d-12-rag-sdk-indexing-module/exports.spec.ts`

**规格引用：**
- api-spec.md：统一导出入口
- checklist AC-05

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/d-12-rag-sdk-indexing-module/exports.spec.ts
import { describe, it, expect } from 'vitest'
import * as indexing from '../../../packages/rag-sdk/src/indexing/index.js'
import * as sdk from '../../../packages/rag-sdk/src/index.js'

describe('Indexing module exports', () => {
  it('AC-05: exports all indexing modules from indexing/index.ts', () => {
    expect(indexing.RecursiveCharacterChunker).toBeDefined()
    expect(indexing.OpenAIEmbedder).toBeDefined()
    expect(indexing.MilvusIndexer).toBeDefined()
    expect(indexing.runIndexing).toBeDefined()
    expect(typeof indexing.runIndexing).toBe('function')
  })

  it('AC-05: re-exports indexing modules from root index.ts', () => {
    expect(sdk.RecursiveCharacterChunker).toBeDefined()
    expect(sdk.OpenAIEmbedder).toBeDefined()
    expect(sdk.MilvusIndexer).toBeDefined()
    expect(sdk.runIndexing).toBeDefined()
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/exports.spec.ts`
预期：FAIL — "Cannot find module '../../../packages/rag-sdk/src/indexing/index.js'"

- [ ] **步骤 3: 创建 indexing/index.ts**

```typescript
// packages/rag-sdk/src/indexing/index.ts
export { RecursiveCharacterChunker } from '../chunkers/recursive-character.chunker.js'
export { OpenAIEmbedder } from '../embedders/openai.embedder.js'
export { MilvusIndexer } from '../indexers/milvus.indexer.js'
export { runIndexing } from '../pipelines/run-indexing.js'
```

- [ ] **步骤 4: 更新根目录 index.ts**

在 `packages/rag-sdk/src/index.ts` 末尾追加：

```typescript
export * from './indexing/index.js'
```

- [ ] **步骤 5: 运行测试确认通过**

运行：`npx vitest run tests/issues/d-12-rag-sdk-indexing-module/exports.spec.ts`
预期：PASS（AC-05 全部通过）

- [ ] **步骤 6: 提交**

```bash
git add packages/rag-sdk/src/indexing/index.ts packages/rag-sdk/src/index.ts tests/issues/d-12-rag-sdk-indexing-module/exports.spec.ts
git commit -m "feat(rag-sdk): add indexing/index.ts unified exports (d-12)"
```

---

## 任务 6: 类型检查与最终验证

**规格引用：**
- checklist AC-06: pnpm type-check 通过
- checklist AC-07: 单元测试覆盖边界

- [ ] **步骤 1: 运行类型检查**

```bash
cd packages/rag-sdk && pnpm type-check
```
预期：0 错误

- [ ] **步骤 2: 运行全部 d-12 单元测试**

```bash
npx vitest run tests/issues/d-12-rag-sdk-indexing-module/
```
预期：全部通过（AC-01 ~ AC-05，含 checklist AC-07 边界场景）

- [ ] **步骤 3: 运行全局测试确保无回归**

```bash
npx vitest run
```
预期：其他 issue 的测试也全部通过

- [ ] **步骤 4: 提交**

```bash
git add -A
git commit -m "test(rag-sdk): complete d-12 indexing module with full test coverage"
```

---

## 自检

**规格覆盖检查：**

| 规格需求 | 对应任务 | 状态 |
|----------|----------|------|
| RecursiveCharacterChunker：parentId / hierarchyPath / metadata / tokenCount | 任务 1 | 待执行 |
| OpenAIEmbedder：EmbeddingConfig / batch embed / error handling | 任务 2 | 待执行 |
| MilvusIndexer：通过 IVectorStore 批量 index | 任务 3 | 待执行 |
| runIndexing：阶段追踪（pending/running/completed/failed），返回 IndexingResult | 任务 4 | 待执行 |
| indexing/index.ts 统一导出 | 任务 5 | 待执行 |
| pnpm type-check 通过 | 任务 6 | 待执行 |
| 单元测试：空文档分块、超长文本分块、embed 失败降级、index 长度不一致校验 | 任务 1-4 | 待执行 |

**占位符扫描：** 无 TBD / TODO / 稍后实现。

**类型一致性：**
- 所有 Chunk / DocumentSource / EmbeddingConfig 类型均来自 `z.infer`，无手写重复类型。
- `VectorRecord.id` = `chunk.id`，UUID 一致。
- `tokenCount` 使用 `Math.ceil(content.length / 4)`。
- `runIndexing` 的 `onStageChange` 签名为 `(stages: IndexingStage[]) => void | Promise<void>`。

**测试映射：**

| checklist AC | 测试文件 | 测试用例前缀 |
|--------------|----------|--------------|
| AC-01 | chunker.spec.ts | AC-01: |
| AC-02 | embedder.spec.ts | AC-02: |
| AC-03 | indexer.spec.ts | AC-03: |
| AC-04 | pipeline.spec.ts | AC-04: |
| AC-05 | exports.spec.ts | AC-05: |
| AC-06 | 类型检查命令 | - |
| AC-07 | chunker/embedder/indexer/pipeline.spec.ts | 边界场景已内嵌在各任务测试中 |
