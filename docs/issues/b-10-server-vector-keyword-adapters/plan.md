---
id: b-10
issue: issue.md
version: 1
---

# Server 向量与关键词存储适配实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 让 server 的存储层实现 SDK 定义的 `IVectorStore` 和 `IKeywordStore` 接口，删除冗余自有接口。

**架构：** `VectorService` 和 `MilvusVectorStore` 改为从 `@goferbot/rag-sdk` 导入类型；新增 `KeywordService` 基于 PostgreSQL FTS 实现 `IKeywordStore`；`DocumentService.remove()` 同步删除向量。

**技术栈：** NestJS 10 + Prisma + PostgreSQL (zhparser/simple FTS) + Milvus

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/api-spec.md](./specs/api-spec.md)

---

## 文件结构

- **修改：**
  - `packages/server/src/processors/vector/vector.service.ts` — 改 import 来源为 `@goferbot/rag-sdk`
  - `packages/server/src/vector/milvus.ts` — 改 import 来源为 `@goferbot/rag-sdk`
  - `packages/server/src/modules/knowledge-base/document.service.ts` — `remove()` 添加 `deleteByFileId` 调用
  - `packages/server/src/app.module.ts` — 新增 `KeywordModule`
  - `packages/server/package.json` — 新增 `@goferbot/rag-sdk` 依赖
- **删除：**
  - `packages/server/src/interfaces/IVectorStore.ts` — 与 SDK 接口完全重复
- **新增：**
  - `packages/server/src/processors/keyword/keyword.service.ts`
  - `packages/server/src/processors/keyword/keyword.module.ts`
- **测试：**
  - `tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts`
  - `tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts`
  - `tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts`

---

## 任务 1: VectorService 适配 SDK IVectorStore

**文件：**
- 修改：`packages/server/src/processors/vector/vector.service.ts`
- 修改：`packages/server/src/vector/milvus.ts`
- 删除：`packages/server/src/interfaces/IVectorStore.ts`
- 测试：`tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts`

**规格引用：**
- API 规格：[第 1.1 节 VectorService]、[第 1.2 节 MilvusVectorStore]、[第 6.2 节 删除文件]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts
import { describe, it, expect, beforeAll } from 'vitest'
import { VectorService } from '../../../packages/server/src/processors/vector/vector.service.js'

describe('VectorService', () => {
  it('AC-01: implements SDK IVectorStore interface', () => {
    // 类型编译测试：VectorService 必须能被赋值给 SDK IVectorStore
    const svc: import('@goferbot/rag-sdk').IVectorStore = {} as VectorService
    expect(svc).toBeDefined()
  })

  it('AC-02: deleteByFileId and deleteByKbId remain as extension methods', () => {
    const proto = VectorService.prototype as any
    expect(typeof proto.deleteByFileId).toBe('function')
    expect(typeof proto.deleteByKbId).toBe('function')
    // 扩展方法不在 SDK IVectorStore 接口中，但 TypeScript 允许
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts`
预期：FAIL — `Cannot find module '@goferbot/rag-sdk'` 或 `VectorService` 未实现 SDK 接口

- [ ] **步骤 3: 修改 import 来源并删除冗余接口**

修改 `packages/server/src/processors/vector/vector.service.ts`：
```typescript
// 旧：import type { IVectorStore, ... } from '../../interfaces/IVectorStore.js'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
```

修改 `packages/server/src/vector/milvus.ts`：
```typescript
// 旧：import type { IVectorStore, ... } from '../interfaces/IVectorStore.js'
import type {
  IVectorStore,
  VectorRecord,
  VectorSearchOptions,
  VectorSearchResult,
} from '@goferbot/rag-sdk'
```

删除 `packages/server/src/interfaces/IVectorStore.ts`。

在 `packages/server/package.json` 的 `dependencies` 中新增：
```json
"@goferbot/rag-sdk": "workspace:*"
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts`
预期：PASS（类型编译通过，扩展方法存在）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/vector/vector.service.ts \
  packages/server/src/vector/milvus.ts \
  packages/server/package.json \
  tests/issues/b-10-server-vector-keyword-adapters/vector-service.spec.ts
git rm packages/server/src/interfaces/IVectorStore.ts
git commit -m "feat(b-10): VectorService adapts to SDK IVectorStore, remove redundant interface"
```

---

## 任务 2: KeywordService 实现 SDK IKeywordStore

**文件：**
- 创建：`packages/server/src/processors/keyword/keyword.service.ts`
- 创建：`packages/server/src/processors/keyword/keyword.module.ts`
- 测试：`tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts`

**规格引用：**
- API 规格：[第 1.3 节 KeywordService]、[第 1.4 节 KeywordModule]、[第 2 节 SQL 策略]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { KeywordService } from '../../../packages/server/src/processors/keyword/keyword.service.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'

describe('KeywordService', () => {
  let keywordService: KeywordService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
    }
    keywordService = new KeywordService(mockPrisma)
  })

  it('AC-03: search returns RetrievalCandidate[] ordered by rank desc', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { id: 'c1', document_id: 'd1', kb_id: 'kb-1', content: 'hello', chunk_index: 0, rank: 0.9 },
      { id: 'c2', document_id: 'd2', kb_id: 'kb-1', content: 'world', chunk_index: 0, rank: 0.5 },
    ])
    const result = await keywordService.search('test', ['kb-1'], 5)
    expect(Array.isArray(result)).toBe(true)
    result.forEach((r, i) => {
      if (i > 0) expect(r.score).toBeLessThanOrEqual(result[i - 1].score)
      expect(r.source).toBe('keyword')
      expect(r.chunk).toHaveProperty('id')
      expect(r.chunk).toHaveProperty('content')
    })
  })

  it('AC-04: search filters by kbIds', async () => {
    await keywordService.search('hello', ['kb-a', 'kb-b'], 3)
    const sql = mockPrisma.$queryRaw.mock.calls[0][0] as any
    expect(sql.strings.join('')).toContain('kb_id = ANY')
  })

  it('AC-05: search returns empty array for empty query', async () => {
    const result = await keywordService.search('', ['kb-1'])
    expect(result).toEqual([])
  })

  it('AC-06: search returns empty array for empty kbIds', async () => {
    const result = await keywordService.search('hello', [])
    expect(result).toEqual([])
  })

  it('AC-07: falls back to simple config when zhparser is not installed', async () => {
    // onModuleInit 后 configChecked = true, useChineseConfig = false
    await keywordService.onModuleInit()
    expect((keywordService as any).useChineseConfig).toBe(false)
    expect((keywordService as any).configChecked).toBe(true)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts`
预期：FAIL — `Cannot find module .../keyword.service.js`

- [ ] **步骤 3: 实现 KeywordService 和 KeywordModule**

创建 `packages/server/src/processors/keyword/keyword.service.ts`：
```typescript
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service.js'
import type { IKeywordStore, RetrievalCandidate } from '@goferbot/rag-sdk'

@Injectable()
export class KeywordService implements IKeywordStore {
  private readonly logger = new Logger(KeywordService.name)
  private useChineseConfig = false
  private configChecked = false

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.detectZhparser()
  }

  private async detectZhparser(): Promise<void> {
    try {
      const result = await this.prisma.$queryRaw<Array<{ extname: string }>>`
        SELECT extname FROM pg_extension WHERE extname = 'zhparser'
      `
      this.useChineseConfig = result.length > 0
      if (this.useChineseConfig) {
        this.logger.log('zhparser detected, using chinese config')
      } else {
        this.logger.warn('zhparser not installed, falling back to simple config')
      }
    } catch (err) {
      this.logger.warn(`zhparser detection failed: ${err instanceof Error ? err.message : String(err)}`)
      this.useChineseConfig = false
    } finally {
      this.configChecked = true
    }
  }

  async search(query: string, kbIds: string[], topK?: number): Promise<RetrievalCandidate[]> {
    if (!query || query.trim() === '') return []
    if (!kbIds || kbIds.length === 0) return []

    const config = this.useChineseConfig ? 'chinese' : 'simple'
    const limit = topK ?? 10
    const trimmedQuery = query.trim()

    const results = await this.prisma.$queryRaw<Array<{
      id: string
      document_id: string
      kb_id: string
      content: string
      chunk_index: number
      rank: number
    }>>`
      SELECT id, document_id, kb_id, content, chunk_index,
        ts_rank_cd(to_tsvector(${config}, content), plainto_tsquery(${config}, ${trimmedQuery})) as rank
      FROM chunks
      WHERE kb_id = ANY(${kbIds}::uuid[])
        AND to_tsvector(${config}, content) @@ plainto_tsquery(${config}, ${trimmedQuery})
      ORDER BY rank DESC
      LIMIT ${limit}
    `

    return results.map(r => ({
      chunk: {
        id: r.id,
        documentId: r.document_id,
        kbId: r.kb_id,
        content: r.content,
        chunkIndex: r.chunk_index,
      },
      score: Math.min(1, Number(r.rank)),
      source: 'keyword' as const,
    }))
  }
}
```

创建 `packages/server/src/processors/keyword/keyword.module.ts`：
```typescript
import { Global, Module } from '@nestjs/common'
import { KeywordService } from './keyword.service.js'

@Global()
@Module({
  providers: [KeywordService],
  exports: [KeywordService],
})
export class KeywordModule {}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts`
预期：PASS（所有 AC-03~AC-07 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/processors/keyword/ \
  tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts
git commit -m "feat(b-10): add KeywordService implementing SDK IKeywordStore"
```

---

## 任务 3: DocumentService.remove() 同步删除向量

**文件：**
- 修改：`packages/server/src/modules/knowledge-base/document.service.ts`
- 修改：`packages/server/src/modules/knowledge-base/knowledge-base.module.ts`（注入 VectorService）
- 测试：`tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts`

**规格引用：**
- API 规格：[第 1.5 节 DocumentService.remove()]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts
import { describe, it, expect, vi } from 'vitest'
import { DocumentService } from '../../../packages/server/src/modules/knowledge-base/document.service.js'

describe('DocumentService.remove with vector deletion', () => {
  it('AC-08: remove calls deleteByFileId before deleting document record', async () => {
    const mockPrisma = {
      knowledgeBase: { findUnique: vi.fn().mockResolvedValue({ userId: 'u1' }) },
      document: {
        findUnique: vi.fn().mockResolvedValue({ id: 'd1', kbId: 'kb1' }),
        delete: vi.fn().mockResolvedValue({}),
      },
    } as any
    const mockStorage = {} as any
    const mockVector = { deleteByFileId: vi.fn().mockResolvedValue(undefined) } as any

    const service = new DocumentService(mockPrisma, mockStorage, mockVector)
    await service.remove('u1', 'kb1', 'd1')

    expect(mockVector.deleteByFileId).toHaveBeenCalledWith('d1')
    expect(mockPrisma.document.delete).toHaveBeenCalledWith({ where: { id: 'd1' } })
    // 验证调用顺序：deleteByFileId 在 document.delete 之前
    const deleteCallOrder = mockVector.deleteByFileId.mock.invocationCallOrder[0]
    const docDeleteCallOrder = mockPrisma.document.delete.mock.invocationCallOrder[0]
    expect(deleteCallOrder).toBeLessThan(docDeleteCallOrder)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts`
预期：FAIL — `deleteByFileId` 未被调用（当前 DocumentService 构造函数只有 2 个参数）

- [ ] **步骤 3: 修改 DocumentService 构造函数和 remove 方法**

修改 `packages/server/src/modules/knowledge-base/document.service.ts`：
```typescript
import { VectorService } from '../../processors/vector/vector.service.js'

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly vectorService: VectorService,
  ) {}

  async remove(userId: string, kbId: string, docId: string) {
    await this.ensureOwnership(userId, kbId)
    const doc = await this.prisma.document.findUnique({ where: { id: docId } })
    if (!doc || doc.kbId !== kbId) throw new NotFoundException('文档不存在')

    await this.vectorService.deleteByFileId(docId)
    await this.prisma.document.delete({ where: { id: docId } })
    return { id: docId, deleted: true }
  }
}
```

修改 `packages/server/src/modules/knowledge-base/knowledge-base.module.ts`：
确保 `VectorModule` 已导入（通常已在 `AppModule` 全局导入，若模块级需显式导入则添加）。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts`
预期：PASS（AC-08 通过）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/modules/knowledge-base/document.service.ts \
  tests/issues/b-10-server-vector-keyword-adapters/document-service.spec.ts
git commit -m "feat(b-10): DocumentService.remove calls deleteByFileId before PG delete"
```

---

## 任务 4: 注册 KeywordModule 到 AppModule

**文件：**
- 修改：`packages/server/src/app.module.ts`
- 测试：通过集成测试验证

**规格引用：**
- API 规格：[第 1.6 节 AppModule]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts（追加）
import { KeywordModule } from '../../../packages/server/src/processors/keyword/keyword.module.js'

describe('KeywordModule', () => {
  it('AC-08: KeywordModule is a global module with KeywordService provider', () => {
    expect(KeywordModule).toBeDefined()
    const moduleMeta = Reflect.getMetadata('providers', KeywordModule)
    expect(moduleMeta).toContain(KeywordService)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/b-10-server-vector-keyword-adapters/keyword-service.spec.ts -t "AC-08"`
预期：FAIL — 若未注册到 AppModule，模块元数据测试可能通过但启动测试会失败

- [ ] **步骤 3: 注册 KeywordModule**

修改 `packages/server/src/app.module.ts`：
```typescript
import { KeywordModule } from './processors/keyword/keyword.module.js'

@Module({
  imports: [
    // ... 现有模块 ...
    VectorModule,
    KeywordModule, // 新增
    QueueModule.forRoot(),
    // ...
  ],
})
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm type-check`
预期：PASS（0 错误）

- [ ] **步骤 5: 提交**

```bash
git add packages/server/src/app.module.ts
git commit -m "feat(b-10): register KeywordModule in AppModule"
```

---

## 任务 5: 全量测试与类型检查

- [ ] **步骤 1: 运行本 issue 所有单元测试**

```bash
npx vitest run tests/issues/b-10-server-vector-keyword-adapters/
```
预期：全部通过（AC-01~AC-08）

- [ ] **步骤 2: 运行类型检查**

```bash
pnpm type-check
```
预期：0 错误，0 警告

- [ ] **步骤 3: 运行集成测试（如有）**

```bash
npx vitest run tests/integration/vector-keyword-adapters.spec.ts
```
预期：通过（AC-09~AC-10，需真实 PostgreSQL + Milvus）

- [ ] **步骤 4: 提交**

```bash
git add -A
git commit -m "test(b-10): verify all tests pass and type-check clean"
```

---

## 自检

1. **规格覆盖：**
   - [x] VectorService 改实现 SDK IVectorStore — 任务 1
   - [x] 删除 server 自有 IVectorStore.ts — 任务 1
   - [x] KeywordService 实现 IKeywordStore — 任务 2
   - [x] zhparser 降级策略 — 任务 2（AC-07）
   - [x] DocumentService.remove 调用 deleteByFileId — 任务 3
   - [x] KeywordModule 注册到 AppModule — 任务 4
   - [x] pnpm type-check 通过 — 任务 5

2. **占位符扫描：** 无 TBD/TODO/稍后实现。

3. **类型一致性：** `IVectorStore`、`VectorRecord` 等类型全部来自 `@goferbot/rag-sdk`，与 SDK 一致。
