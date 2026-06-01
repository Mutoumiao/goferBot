---
id: b-13
issue: issue.md
version: 1
---

# PrismaVectorIndexer 重写计划

> **目标：** 将 PrismaMilvusIndexer 重写为 PrismaVectorIndexer，实现单事务写入
> **架构：** Prisma + PostgreSQL pgvector，SDK IIndexer 接口
> **技术栈：** NestJS + Prisma + pgvector

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`
**测试引用：** `tests/unit/server/`

---

## 文件结构

### 后端（新增/修改）

- `packages/server/src/processors/indexing/prisma-vector.indexer.ts` — 新增：PrismaVectorIndexer 类
- `packages/server/src/processors/indexing/prisma-milvus.indexer.ts` — 保留（i-03 删除）
- `tests/unit/server/prisma-vector-indexer.spec.ts` — 新增：单元测试

---

## 任务列表

### 任务 1: 实现 PrismaVectorIndexer

**文件：**
- 创建：`packages/server/src/processors/indexing/prisma-vector.indexer.ts`

**规格引用：**
- api-spec.md "PrismaVectorIndexer 接口"

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/server/prisma-vector-indexer.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaVectorIndexer } from '../../../packages/server/src/processors/indexing/prisma-vector.indexer'
import type { Chunk } from '@goferbot/rag-sdk'

describe('PrismaVectorIndexer', () => {
  let prisma: PrismaClient
  let indexer: PrismaVectorIndexer

  beforeAll(async () => {
    prisma = new PrismaClient()
    indexer = new PrismaVectorIndexer(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('AC-01: implements IIndexer interface', () => {
    expect(indexer.index).toBeDefined()
  })

  it('AC-02: single transaction writes chunks and embeddings', async () => {
    // 测试单事务写入
  })

  it('AC-03: uses exact tokenCount from usage', async () => {
    // 测试精确 tokenCount
  })

  it('AC-04: falls back to estimated tokenCount', async () => {
    // 测试回退估算
  })

  it('AC-05: ON CONFLICT handles retry', async () => {
    // 测试重试场景
  })

  it('AC-07: empty chunks returns without error', async () => {
    await expect(indexer.index([], [])).resolves.not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**
  ```bash
  npx vitest run tests/unit/server/prisma-vector-indexer.spec.ts
  ```

- [ ] **步骤 3: 实现 PrismaVectorIndexer**

```typescript
// packages/server/src/processors/indexing/prisma-vector.indexer.ts
import { Injectable } from '@nestjs/common'
import type { IIndexer, Chunk } from '@goferbot/rag-sdk'
import { ValidationError } from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'

export interface TokenUsage {
  promptTokens: number
  totalTokens: number
}

@Injectable()
export class PrismaVectorIndexer implements IIndexer {
  constructor(private readonly prisma: PrismaService) {}

  async index(chunks: Chunk[], vectors: number[][], usage?: TokenUsage[]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new ValidationError(`chunks length ${chunks.length} != vectors length ${vectors.length}`)
    }
    if (chunks.length === 0) return

    const tokenCounts = this.computeTokenCounts(chunks, usage)

    await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < chunks.length; i++) {
        await tx.$executeRaw`
          INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
          VALUES (
            ${chunks[i].id},
            ${chunks[i].documentId},
            ${chunks[i].kbId},
            ${chunks[i].content},
            ${tokenCounts[i]},
            ${chunks[i].chunkIndex},
            ${vectors[i]}::vector
          )
          ON CONFLICT (id) DO UPDATE SET
            document_id = EXCLUDED.document_id,
            kb_id = EXCLUDED.kb_id,
            content = EXCLUDED.content,
            token_count = EXCLUDED.token_count,
            chunk_index = EXCLUDED.chunk_index,
            embedding = EXCLUDED.embedding
        `
      }
    })
  }

  private computeTokenCounts(chunks: Chunk[], usage?: TokenUsage[]): number[] {
    // 方案 A：embedder 提供了逐条 usage
    if (usage && usage.length === chunks.length) {
      return usage.map(u => u.promptTokens)
    }

    // 方案 B：embedder 提供了总量，按文本长度比例分配
    if (usage && usage.length === 1) {
      const totalTokens = usage[0].promptTokens
      const totalLength = chunks.reduce((sum, c) => sum + c.content.length, 0)
      return chunks.map(c =>
        Math.round((c.content.length / totalLength) * totalTokens)
      )
    }

    // 方案 C（回退）：使用 chunker 的估算值
    return chunks.map(c =>
      c.tokenCount ?? Math.ceil(c.content.length / 4)
    )
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**
  ```bash
  npx vitest run tests/unit/server/prisma-vector-indexer.spec.ts
  ```

---

### 任务 2: 修改 IndexingWorker

**文件：**
- 修改：`packages/server/src/processors/queue/indexing.worker.ts`

**规格引用：**
- api-spec.md "调用方适配"

- [ ] **步骤 1: 修改导入**
  ```typescript
  // 旧
  import { PrismaMilvusIndexer } from '../indexing/prisma-milvus.indexer.js'
  
  // 新
  import { PrismaVectorIndexer } from '../indexing/prisma-vector.indexer.js'
  ```

- [ ] **步骤 2: 修改构造函数注入**
  ```typescript
  // 旧
  constructor(
    private readonly prisma: PrismaService,
    private readonly vectorService: VectorService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaMilvusIndexer,
    private readonly config: ConfigService,
  ) {}
  
  // 新
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly parser: DocumentParser,
    private readonly indexer: PrismaVectorIndexer,
    private readonly config: ConfigService,
  ) {}
  ```
  - 移除 `vectorService` 注入（PrismaVectorIndexer 不需要）

- [ ] **步骤 3: 验证 runIndexing 调用**
  - 确认 `this.indexer` 类型兼容（PrismaVectorIndexer 同样实现 IIndexer）

---

### 任务 3: 修改 QueueModule

**文件：**
- 修改：`packages/server/src/processors/queue/queue.module.ts`

**规格引用：**
- api-spec.md "调用方适配"

- [ ] **步骤 1: 修改导入**
  ```typescript
  // 旧
  import { PrismaMilvusIndexer } from '../indexing/prisma-milvus.indexer.js'
  
  // 新
  import { PrismaVectorIndexer } from '../indexing/prisma-vector.indexer.js'
  ```

- [ ] **步骤 2: 修改 providers 数组**
  ```typescript
  // 旧
  PrismaMilvusIndexer,
  
  // 新
  PrismaVectorIndexer,
  ```

---

### 任务 4: 确认 DocumentService.remove() 无需修改

- [ ] **步骤 1: 验证 ON DELETE CASCADE**
  - 确认 Prisma Schema 中 chunks 表有 `onDelete: Cascade`
  - 确认 DocumentService.remove() 只需执行 `prisma.document.delete()`

---

### 任务 5: 全局验证

- [ ] **步骤 1: 类型检查**
  ```bash
  pnpm type-check
  ```

- [ ] **步骤 2: 全部单元测试**
  ```bash
  npx vitest run tests/unit
  ```

- [ ] **步骤 3: 确认 PrismaMilvusIndexer 仍保留**
  ```bash
  ls packages/server/src/processors/indexing/prisma-milvus.indexer.ts
  ```

---

## 规格覆盖检查

- [ ] 功能规格：AC-01~AC-09 全部覆盖
- [ ] API 规格：PrismaVectorIndexer 接口、调用方适配全部覆盖
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：b-12（需要 PgVectorStore 和 pgvector 数据库就绪）
- 阻塞下游：q-23（集成测试需要 Indexer 正确工作）

---

## 关键变更点（审查发现）

### IndexingWorker 构造函数变更

| 参数 | 旧 | 新 |
|------|----|----|
| `vectorService` | 注入 | **移除** |
| `indexer` | `PrismaMilvusIndexer` | `PrismaVectorIndexer` |

### QueueModule providers 变更

| Provider | 旧 | 新 |
|----------|----|----|
| Indexer | `PrismaMilvusIndexer` | `PrismaVectorIndexer` |
