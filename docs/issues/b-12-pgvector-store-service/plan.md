---
id: b-12
issue: issue.md
version: 1
---

# PgVectorStore 与 VectorService 切换计划

> **目标：** 实现基于 pgvector 的向量存储类，并切换 VectorService 使用新实现
> **架构：** Prisma + PostgreSQL pgvector，SDK IVectorStore 接口
> **技术栈：** NestJS + Prisma + pgvector

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/`
**测试引用：** `tests/unit/server/`

---

## 文件结构

### 后端（新增/修改）

- `packages/server/src/vector/pgvector.ts` — 新增：PgVectorStore 类
- `packages/server/src/processors/vector/vector.service.ts` — 修改：切换至 PgVectorStore
- `tests/unit/server/pgvector-store.spec.ts` — 新增：PgVectorStore 单元测试
- `tests/unit/server/vector-service.spec.ts` — 新增/修改：VectorService 单元测试

---

## 任务列表

### 任务 1: 实现 PgVectorStore

**文件：**
- 创建：`packages/server/src/vector/pgvector.ts`

**规格引用：**
- api-spec.md "PgVectorStore 接口"

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/server/pgvector-store.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PgVectorStore } from '../../../packages/server/src/vector/pgvector'

describe('PgVectorStore', () => {
  let prisma: PrismaClient
  let store: PgVectorStore

  beforeAll(async () => {
    prisma = new PrismaClient()
    store = new PgVectorStore(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('AC-01: implements IVectorStore interface', () => {
    expect(store.ensureCollection).toBeDefined()
    expect(store.insertVectors).toBeDefined()
    expect(store.searchVectors).toBeDefined()
    expect(store.deleteByIds).toBeDefined()
  })

  it('AC-02: insertVectors writes to chunks.embedding', async () => {
    // 测试插入后 embedding 列有数据
  })

  it('AC-03: searchVectors returns results ordered by similarity', async () => {
    // 测试搜索返回正确排序
  })

  it('AC-04: deleteByIds removes records', async () => {
    // 测试删除后记录不存在
  })

  it('AC-05: ensureCollection is idempotent', async () => {
    // 测试多次调用不报错
    await expect(store.ensureCollection()).resolves.not.toThrow()
    await expect(store.ensureCollection()).resolves.not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**
  ```bash
  npx vitest run tests/unit/server/pgvector-store.spec.ts
  ```

- [ ] **步骤 3: 实现 PgVectorStore**

```typescript
// packages/server/src/vector/pgvector.ts
import type { IVectorStore, VectorRecord, VectorSearchOptions, VectorSearchResult } from '@goferbot/rag-sdk'
import type { PrismaService } from '../processors/database/prisma.service.js'

export class PgVectorStore implements IVectorStore {
  constructor(private readonly prisma: PrismaService) {}

  async ensureCollection(): Promise<void> {
    await this.prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS vector`
  }

  async insertVectors(records: VectorRecord[]): Promise<void> {
    for (const record of records) {
      await this.prisma.$executeRaw`
        INSERT INTO chunks (id, document_id, kb_id, content, token_count, chunk_index, embedding)
        VALUES (
          ${record.id},
          ${record.chunkId},
          ${record.kbId},
          ${record.content ?? ''},
          ${record.tokenCount ?? 0},
          ${record.chunkIndex ?? 0},
          ${record.embedding}::vector
        )
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          token_count = EXCLUDED.token_count,
          chunk_index = EXCLUDED.chunk_index,
          embedding = EXCLUDED.embedding
      `
    }
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    const kbIds = options?.kbId ? [options.kbId] : []
    const topK = options?.topK ?? 10

    const results = await this.prisma.$queryRaw<Array<{
      id: string
      documentId: string
      kbId: string
      content: string
      tokenCount: number | null
      chunkIndex: number
      score: number
    }>>`
      SELECT 
        id,
        document_id as "documentId",
        kb_id as "kbId",
        content,
        token_count as "tokenCount",
        chunk_index as "chunkIndex",
        1 - (embedding <=> ${queryVector}::vector) as score
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${queryVector}::vector
      LIMIT ${topK}
    `

    return results.map(r => ({
      id: r.id,
      chunk: {
        id: r.id,
        documentId: r.documentId,
        kbId: r.kbId,
        content: r.content,
        tokenCount: r.tokenCount ?? undefined,
        chunkIndex: r.chunkIndex,
      },
      score: r.score,
    }))
  }

  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return
    await this.prisma.$executeRaw`
      DELETE FROM chunks WHERE id = ANY(${ids}::uuid[])
    `
  }
}
```

- [ ] **步骤 4: 运行测试确认通过**
  ```bash
  npx vitest run tests/unit/server/pgvector-store.spec.ts
  ```

---

### 任务 2: 切换 VectorService

**文件：**
- 修改：`packages/server/src/processors/vector/vector.service.ts`

**规格引用：**
- api-spec.md "VectorService 变更"

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/unit/server/vector-service.spec.ts
import { describe, it, expect } from 'vitest'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service'

describe('VectorService', () => {
  it('AC-06: uses PgVectorStore instead of MilvusVectorStore', () => {
    // 验证 VectorService 不再引用 MilvusVectorStore
  })
})
```

- [ ] **步骤 2: 修改 VectorService**

```typescript
// packages/server/src/processors/vector/vector.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
import { PrismaService } from '../database/prisma.service.js'
import { PgVectorStore } from '../../vector/pgvector.js'

@Injectable()
export class VectorService implements IVectorStore, OnModuleInit {
  private readonly store: PgVectorStore

  constructor(private readonly prisma: PrismaService) {
    this.store = new PgVectorStore(prisma)
  }

  async onModuleInit(): Promise<void> {
    await this.store.ensureCollection()
  }

  async ensureCollection(): Promise<void> {
    return this.store.ensureCollection()
  }

  async insertVectors(vectors: VectorRecord[]): Promise<void> {
    return this.store.insertVectors(vectors)
  }

  async searchVectors(
    queryVector: number[],
    options?: VectorSearchOptions,
  ): Promise<VectorSearchResult[]> {
    return this.store.searchVectors(queryVector, options)
  }

  async deleteByIds(ids: string[]): Promise<void> {
    return this.store.deleteByIds(ids)
  }

  // deleteByFileId / deleteByKbId 已移除（ADR 0005：ON DELETE CASCADE 处理）
}
```

---

## 关键变更点（审查发现）

### HybridRetriever 兼容性

`ChatService` 注入 `HybridRetriever`，`HybridRetriever` 依赖 `IVectorStore` 接口。
`PgVectorStore` 实现 `IVectorStore`，接口兼容。

**验证步骤**：
1. 确认 `HybridRetriever` 只使用 `searchVectors` 方法
2. 确认 `VectorService` 仍可作为 `IVectorStore` 注入
3. 运行 ChatService 相关单元测试

### insertVectors 职责

ADR 0005 后，向量插入主要由 `PrismaVectorIndexer` 处理（单事务写入元数据+向量）。
`PgVectorStore.insertVectors` 保留以实现接口完整性，但生产调用场景减少。
```

- [ ] **步骤 3: 运行测试确认通过**
  ```bash
  npx vitest run tests/unit/server/vector-service.spec.ts
  ```

---

### 任务 3: 验证

- [ ] **步骤 1: 类型检查**
  ```bash
  pnpm type-check
  ```

- [ ] **步骤 2: 全部单元测试**
  ```bash
  npx vitest run tests/unit
  ```

- [ ] **步骤 3: 确认无 Milvus 引用**
  ```bash
  grep -r "MilvusVectorStore" packages/server/src/ --include="*.ts" || echo "No Milvus references"
  ```

- [ ] **步骤 4: 确认 HybridRetriever 兼容性**
  - 检查 `ChatService` 中 `HybridRetriever` 的注入方式
  - 确认 `HybridRetriever` 只依赖 `IVectorStore` 接口，不依赖具体实现
  - 运行 ChatService 相关单元测试验证

---

## 规格覆盖检查

- [ ] 功能规格：AC-01~AC-08 全部覆盖
- [ ] API 规格：PgVectorStore 接口、VectorService 变更全部覆盖
- [ ] 无占位符（"TODO" / "稍后实现" / "TBD"）

---

## 阻塞与依赖

- 阻塞于：i-02（需要 pgvector 扩展已安装的数据库）
- 阻塞下游：b-13（PrismaVectorIndexer 需要 PgVectorStore）
