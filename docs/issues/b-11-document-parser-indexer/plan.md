---
id: b-11
issue: issue.md
version: 1
---

# 文档解析与索引写入实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 实现文档索引流水线的转换层组件：`DocumentParser`（buffer → text）和 `PrismaMilvusIndexer`（chunks + vectors → PG + Milvus）。

**架构：** `DocumentParser` 为无状态服务，按 MIME 类型解析；`PrismaMilvusIndexer` 实现 SDK `IIndexer`，使用 `chunk.id` 作为 Milvus 主键以消除 milvusId 回写事务。

**技术栈：** NestJS 10 + Prisma + Milvus + `@goferbot/rag-sdk`

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/api-spec.md](./specs/api-spec.md)

---

## 文件结构

- **新增：**
  - `packages/server/src/processors/parser/document.parser.ts`
  - `packages/server/src/processors/indexing/prisma-milvus.indexer.ts`
  - `packages/server/src/processors/parser/parser.module.ts`（可选，若需模块封装）
  - `packages/server/src/processors/indexing/indexing.module.ts`（可选）
- **修改：**
  - `packages/server/src/app.module.ts`（若新增模块需注册）
- **测试：**
  - `tests/issues/b-11-document-parser-indexer/document-parser.spec.ts`
  - `tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts`

---

## 任务 1: DocumentParser 实现

**文件：**
- 创建：`packages/server/src/processors/parser/document.parser.ts`
- 测试：`tests/issues/b-11-document-parser-indexer/document-parser.spec.ts`

**规格引用：**
- API 规格：[DocumentParser 契约]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-11-document-parser-indexer/document-parser.spec.ts
import { describe, it, expect } from 'vitest'
import { DocumentParser } from '../../../packages/server/src/processors/parser/document.parser.js'

describe('DocumentParser', () => {
  const parser = new DocumentParser()

  it('AC-01: parses text/plain buffer to utf-8 string', async () => {
    const buffer = Buffer.from('Hello GoferBot')
    const result = await parser.parse(buffer, 'text/plain')
    expect(result).toBe('Hello GoferBot')
  })

  it('AC-02: parses text/markdown buffer to utf-8 string', async () => {
    const buffer = Buffer.from('# Title\n\nContent')
    const result = await parser.parse(buffer, 'text/markdown')
    expect(result).toBe('# Title\n\nContent')
  })

  it('AC-03: throws error for application/pdf mimeType', async () => {
    const buffer = Buffer.from('pdf-binary')
    await expect(parser.parse(buffer, 'application/pdf')).rejects.toThrow('PDF parsing not yet implemented')
  })

  it('AC-04: falls back to utf-8 for unknown mimeType', async () => {
    const buffer = Buffer.from('unknown content')
    const result = await parser.parse(buffer, 'application/octet-stream')
    expect(result).toBe('unknown content')
  })

  it('AC-05: returns empty string for empty buffer', async () => {
    const result = await parser.parse(Buffer.from(''), 'text/plain')
    expect(result).toBe('')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-11-document-parser-indexer/document-parser.spec.ts`
预期：FAIL — `Cannot find module .../document.parser.js`

- [ ] **步骤 3: 实现 DocumentParser**

创建 `packages/server/src/processors/parser/document.parser.ts`：
```typescript
import { Injectable } from '@nestjs/common'

@Injectable()
export class DocumentParser {
  async parse(buffer: Buffer, mimeType: string): Promise<string> {
    switch (mimeType) {
      case 'text/plain':
      case 'text/markdown':
      case 'text/x-markdown':
        return buffer.toString('utf-8')
      case 'application/pdf':
        throw new Error('PDF parsing not yet implemented')
      default:
        // 未知类型降级为 utf-8
        return buffer.toString('utf-8')
    }
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-11-document-parser-indexer/document-parser.spec.ts`
预期：PASS（AC-01~AC-05 全部通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/parser/document.parser.ts \
  tests/issues/b-11-document-parser-indexer/document-parser.spec.ts
git commit -m "feat(b-11): add DocumentParser with MIME type support"
```

---

## 任务 2: PrismaMilvusIndexer 实现

**文件：**
- 创建：`packages/server/src/processors/indexing/prisma-milvus.indexer.ts`
- 测试：`tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts`

**规格引用：**
- API 规格：[PrismaMilvusIndexer 契约]、[Chunk 创建字段映射]、[VectorRecord 字段映射]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PrismaMilvusIndexer } from '../../../packages/server/src/processors/indexing/prisma-milvus.indexer.js'
import { ValidationError } from '../../../packages/rag-sdk/src/errors.js'
import type { Chunk } from '@goferbot/rag-sdk'

describe('PrismaMilvusIndexer', () => {
  let indexer: PrismaMilvusIndexer
  let mockPrisma: any
  let mockVectorService: any

  beforeEach(() => {
    mockPrisma = {
      $transaction: vi.fn((ops) => Promise.all(ops)),
      chunk: { create: vi.fn((args) => Promise.resolve({ id: args.data.id })) },
    }
    mockVectorService = { insertVectors: vi.fn().mockResolvedValue(undefined) }
    indexer = new PrismaMilvusIndexer(mockPrisma, mockVectorService)
  })

  it('AC-06: creates chunks and inserts vectors with chunk.id as milvus id', async () => {
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'hello', chunkIndex: 0 },
    ]
    const vectors = [[0.1, 0.2, 0.3]]

    await indexer.index(chunks, vectors)

    expect(mockPrisma.$transaction).toHaveBeenCalled()
    expect(mockVectorService.insertVectors).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'c1', chunkId: 'c1', kbId: 'kb1', fileId: 'd1', embedding: [0.1, 0.2, 0.3] }),
    ])
  })

  it('AC-07: throws ValidationError when lengths mismatch', async () => {
    const chunks: Chunk[] = [{ id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'a', chunkIndex: 0 }]
    await expect(indexer.index(chunks, [])).rejects.toThrow(ValidationError)
  })

  it('AC-08: uses per-chunk TokenUsage when available', async () => {
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'hello', chunkIndex: 0 },
    ]
    const vectors = [[0.1]]
    const usage = [{ promptTokens: 5, totalTokens: 5 }]

    await indexer.index(chunks, vectors, usage)

    const txCalls = mockPrisma.$transaction.mock.calls[0][0]
    expect(txCalls[0].data.tokenCount).toBe(5)
  })

  it('AC-09: falls back to chunk.tokenCount or length/4 estimate', async () => {
    const chunks: Chunk[] = [
      { id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'hello world', chunkIndex: 0, tokenCount: 3 },
    ]
    const vectors = [[0.1]]

    await indexer.index(chunks, vectors)

    const txCalls = mockPrisma.$transaction.mock.calls[0][0]
    expect(txCalls[0].data.tokenCount).toBe(3)
  })

  it('AC-10: leaves orphan chunks when vector insert fails, cleaned by deleteByFileId', async () => {
    mockVectorService.insertVectors.mockRejectedValue(new Error('Milvus down'))
    const chunks: Chunk[] = [{ id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'a', chunkIndex: 0 }]
    const vectors = [[0.1]]

    await expect(indexer.index(chunks, vectors)).rejects.toThrow('Milvus down')
    expect(mockPrisma.$transaction).toHaveBeenCalled()
  })

  it('AC-11: does not insert vectors if chunk creation fails', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('PG constraint'))
    const chunks: Chunk[] = [{ id: 'c1', documentId: 'd1', kbId: 'kb1', content: 'a', chunkIndex: 0 }]
    const vectors = [[0.1]]

    await expect(indexer.index(chunks, vectors)).rejects.toThrow('PG constraint')
    expect(mockVectorService.insertVectors).not.toHaveBeenCalled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts`
预期：FAIL — `Cannot find module .../prisma-milvus.indexer.js`

- [ ] **步骤 3: 实现 PrismaMilvusIndexer**

创建 `packages/server/src/processors/indexing/prisma-milvus.indexer.ts`：
```typescript
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service.js'
import { VectorService } from '../vector/vector.service.js'
import type { IIndexer, Chunk } from '@goferbot/rag-sdk'
import type { TokenUsage } from '@goferbot/rag-sdk'
import { ValidationError } from '@goferbot/rag-sdk'

@Injectable()
export class PrismaMilvusIndexer implements IIndexer {
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
  ) {}

  async index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(`chunks length ${chunks.length} != vectors length ${vectors.length}`)
    }
    if (chunks.length === 0) return

    const tokenCounts = this.computeTokenCounts(chunks, usage)

    await this.prisma.$transaction(
      chunks.map((chunk, i) =>
        this.prisma.chunk.create({
          data: {
            id: chunk.id,
            documentId: chunk.documentId,
            kbId: chunk.kbId,
            content: chunk.content,
            tokenCount: tokenCounts[i],
            chunkIndex: chunk.chunkIndex,
          },
        })
      )
    )

    const records = chunks.map((chunk, i) => ({
      id: chunk.id,
      chunkId: chunk.id,
      kbId: chunk.kbId,
      fileId: chunk.documentId,
      embedding: vectors[i],
    }))

    await this.vectorService.insertVectors(records)
  }

  private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
    if (usage && usage.length === chunks.length) {
      return usage.map(u => u.promptTokens)
    }
    return chunks.map(c => c.tokenCount ?? Math.ceil(c.content.length / 4))
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts`
预期：PASS（AC-06~AC-11 全部通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/indexing/prisma-milvus.indexer.ts \
  tests/issues/b-11-document-parser-indexer/prisma-milvus-indexer.spec.ts
git commit -m "feat(b-11): add PrismaMilvusIndexer with chunk.id as milvus id"
```

---

## 任务 3: 模块注册与类型检查

**文件：**
- 修改：`packages/server/src/app.module.ts`（若需显式注册新模块）

**规格引用：**
- 依赖声明：模块导入关系

- [ ] **步骤 1: 创建 Parser/Indexing 模块（可选）**

若 `IndexingWorker` 通过构造函数直接注入 `DocumentParser` 和 `PrismaMilvusIndexer`，则无需单独模块。否则创建：

```typescript
// packages/server/src/processors/parser/parser.module.ts
import { Module } from '@nestjs/common'
import { DocumentParser } from './document.parser.js'

@Module({ providers: [DocumentParser], exports: [DocumentParser] })
export class ParserModule {}
```

```typescript
// packages/server/src/processors/indexing/indexing.module.ts
import { Module } from '@nestjs/common'
import { PrismaMilvusIndexer } from './prisma-milvus.indexer.js'

@Module({ providers: [PrismaMilvusIndexer], exports: [PrismaMilvusIndexer] })
export class IndexingModule {}
```

- [ ] **步骤 2: 运行类型检查**

```bash
pnpm type-check
```
预期：0 错误

- [ ] **步骤 3: 运行全量测试**

```bash
npx vitest run tests/issues/b-11-document-parser-indexer/
```
预期：全部通过

- [ ] **步骤 4: 提交**

```bash
git add -A
git commit -m "chore(b-11): register parser/indexer modules and verify types"
```

---

## 自检

1. **规格覆盖：**
   - [x] DocumentParser text/plain — 任务 1（AC-01）
   - [x] DocumentParser text/markdown — 任务 1（AC-02）
   - [x] DocumentParser PDF 占位抛错 — 任务 1（AC-03）
   - [x] DocumentParser 未知类型降级 — 任务 1（AC-04）
   - [x] DocumentParser 空 buffer — 任务 1（AC-05）
   - [x] PrismaMilvusIndexer 正常写入 — 任务 2（AC-06）
   - [x] chunks/vectors 长度不一致 — 任务 2（AC-07）
   - [x] 优先使用 TokenUsage — 任务 2（AC-08）
   - [x] 无 usage 回退 — 任务 2（AC-09）
   - [x] Milvus 失败 orphan chunks — 任务 2（AC-10）
   - [x] chunk 创建失败不插入向量 — 任务 2（AC-11）
   - [x] chunk.id 作为 Milvus 主键，无需 milvusId 回写 — 任务 2（AC-06 隐含）

2. **占位符扫描：** 无 TBD/TODO/稍后实现。

3. **类型一致性：** `chunk.id` 同时作为 PG 主键和 Milvus `VectorRecord.id`，无需 `milvusId` 回写。
