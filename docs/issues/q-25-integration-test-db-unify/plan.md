---
id: q-25
issue: issue.md
version: 1
---

# 集成测试数据库隔离统一化实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将 4 个违规集成测试文件从直接连接 `goferbot_test` 共享库改造为使用 `TestDatabaseManager` 独立数据库隔离。

**架构：** 按集成测试指南的两种数据库生命周期模式改造——模式 A（每个 it 独立数据库）用于简单测试，模式 B（beforeAll 共享 + beforeEach TRUNCATE）用于需要 Worker 异步处理的复杂场景。`infra.spec.ts` 特殊处理，保持其 E2E 基础设施验证定位但使用独立数据库。

**技术栈：** Vitest + PostgreSQL + TestDatabaseManager + PrismaClient

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md)

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案、响应格式 | ✅ 符合 | 无新增 DTO/API，纯测试改造 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 不引入新依赖 |

---

## 文件结构

### 修改文件
- `tests/integration/prisma-vector-indexer.spec.ts` — 模式 A 改造（每个 it 独立数据库）
- `tests/integration/vector-service.spec.ts` — 模式 A 改造（每个 it 独立数据库）
- `tests/integration/pgvector-store.spec.ts` — 模式 A 改造（每个 it 独立数据库）
- `tests/integration/infra.spec.ts` — 模式 B 改造（beforeAll 共享 + beforeEach TRUNCATE）

### 不修改文件（合规参考）
- `tests/integration/auth.spec.ts` — 已合规，模式 A 参考
- `tests/integration/auth-kb-document.spec.ts` — 已合规，模式 B 参考
- `tests/integration/helpers/test-database.manager.ts` — 无需修改

---

## 任务分解

### 任务 1: prisma-vector-indexer.spec.ts 模式 A 改造

**文件：**
- 修改：`tests/integration/prisma-vector-indexer.spec.ts`

**规格引用：**
- 功能规格：[AC-01] 每个 it 使用独立数据库

- [ ] **步骤 1: 编写改造后的测试骨架（先验证当前测试通过）**

运行当前测试确认基线：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/prisma-vector-indexer.spec.ts
```
预期：PASS（基础设施可用时）或 SKIP（基础设施不可用时）

- [ ] **步骤 2: 改造为模式 A（每个 it 独立数据库）**

修改 `tests/integration/prisma-vector-indexer.spec.ts`：
1. 检查文件头部是否有 `// @vitest-environment node`，若无则添加
2. 检查 import 是否包含 `import { describe, it, expect } from 'vitest'`，若无则添加
3. 删除全局 `prisma` 和 `indexer` 变量
4. 删除 `beforeAll` 中的 `new PrismaClient()` 和 `new PrismaVectorIndexer()`
5. 每个 `it()` 内部：
   - `new TestDatabaseManager()`
   - `dbManager.createDatabase('prisma_vector_indexer')` 创建独立数据库（使用完整语义名）
   - `new PrismaClient({ datasources: { db: { url: dbUrl } } })` 连接独立库
   - `new PrismaVectorIndexer(prisma as any)`
   - 运行测试逻辑
   - `prisma.$disconnect()`
   - `dbManager.dropDatabase(dbName)` 销毁数据库
6. 保留 `checkInfrastructure` 和 `infraAvailable` 跳过逻辑
7. 删除 `beforeEach`（模式 A 不需要）
8. 删除 `afterAll`（模式 A 在每个 it 内清理）

**说明**：直接实例化 `PrismaClient` 而非通过 `TestAppFactory` 获取 `PrismaService`，因为这些测试不测试 HTTP API，无需 NestJS 应用实例。

参考模板（`auth.spec.ts` 模式 A）：
```typescript
it('AC-02: single transaction writes chunks and embeddings', async () => {
  if (!infraAvailable) { console.log('[SKIP]'); return }
  
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('prisma_vector_indexer')
  const dbName = new URL(dbUrl).pathname.slice(1)
  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
  const indexer = new PrismaVectorIndexer(prisma as any)
  
  try {
    // 原测试逻辑...
  } finally {
    await prisma.$disconnect()
    await dbManager.dropDatabase(dbName)
  }
})
```

- [ ] **步骤 3: 运行测试验证通过**

运行：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/prisma-vector-indexer.spec.ts
```
预期：PASS（所有 AC 通过，或基础设施不可用时优雅 SKIP）

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/prisma-vector-indexer.spec.ts
git commit -m "test(q-25): prisma-vector-indexer 改造为模式 A 独立数据库"
```

---

### 任务 2: vector-service.spec.ts 模式 A 改造

**文件：**
- 修改：`tests/integration/vector-service.spec.ts`

**规格引用：**
- 功能规格：[AC-02] vector-service 使用独立数据库

- [ ] **步骤 1: 编写改造后的测试骨架（先验证当前测试通过）**

运行当前测试确认基线：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/vector-service.spec.ts
```
预期：PASS（基础设施可用时）或 SKIP（基础设施不可用时）

- [ ] **步骤 2: 改造为模式 A（每个 it 独立数据库）**

修改 `tests/integration/vector-service.spec.ts`：
1. 检查文件头部是否有 `// @vitest-environment node`，若无则添加
2. 检查 import 是否包含 `import { describe, it, expect } from 'vitest'`，若无则添加
3. 删除全局 `prisma` 和 `service` 变量
4. 删除 `beforeAll` 中的 `new PrismaClient()`、`new VectorService()`、`onModuleInit()`
5. 每个 `it()` 内部：
   - `new TestDatabaseManager()`
   - `dbManager.createDatabase('vector_service')` 创建独立数据库（使用完整语义名）
   - `new PrismaClient({ datasources: { db: { url: dbUrl } } })`
   - `new VectorService(prisma as any)`
   - `await service.onModuleInit()`
   - 运行测试逻辑
   - `prisma.$disconnect()`
   - `dbManager.dropDatabase(dbName)`
6. 保留 `checkInfrastructure` 和 `infraAvailable` 跳过逻辑
7. 删除 `beforeEach` 和 `afterAll`

- [ ] **步骤 3: 运行测试验证通过**

运行：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/vector-service.spec.ts
```
预期：PASS

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/vector-service.spec.ts
git commit -m "test(q-25): vector-service 改造为模式 A 独立数据库"
```

---

### 任务 3: pgvector-store.spec.ts 模式 A 改造

**文件：**
- 修改：`tests/integration/pgvector-store.spec.ts`

**规格引用：**
- 功能规格：[AC-03] pgvector-store 使用独立数据库

- [ ] **步骤 1: 编写改造后的测试骨架（先验证当前测试通过）**

运行当前测试确认基线：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/pgvector-store.spec.ts
```
预期：PASS（基础设施可用时）或 SKIP（基础设施不可用时）

- [ ] **步骤 2: 改造为模式 A（每个 it 独立数据库）**

修改 `tests/integration/pgvector-store.spec.ts`：
1. 检查文件头部是否有 `// @vitest-environment node`，若无则添加
2. 检查 import 是否包含 `import { describe, it, expect } from 'vitest'`，若无则添加
3. 删除全局 `prisma` 和 `store` 变量
4. 删除 `beforeAll` 中的 `new PrismaClient()`、`new PgVectorStore()`、`ensureCollection()`
5. 每个 `it()` 内部：
   - `new TestDatabaseManager()`
   - `dbManager.createDatabase('pgvector_store')` 创建独立数据库（使用完整语义名）
   - `new PrismaClient({ datasources: { db: { url: dbUrl } } })`
   - `new PgVectorStore(prisma as any)`
   - `await store.ensureCollection()`
   - 运行测试逻辑
   - `prisma.$disconnect()`
   - `dbManager.dropDatabase(dbName)`
6. 保留 `checkInfrastructure` 和 `infraAvailable` 跳过逻辑
7. 删除 `beforeEach` 和 `afterAll`

- [ ] **步骤 3: 运行测试验证通过**

运行：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/pgvector-store.spec.ts
```
预期：PASS

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/pgvector-store.spec.ts
git commit -m "test(q-25): pgvector-store 改造为模式 A 独立数据库"
```

---

### 任务 4: infra.spec.ts 模式 B 改造

**文件：**
- 修改：`tests/integration/infra.spec.ts`

**规格引用：**
- 功能规格：[AC-04] infra.spec.ts 使用模式 B（共享库 + TRUNCATE）

**分析：** `infra.spec.ts` 是 E2E 基础设施验证测试，测试数据库连接、后端健康检查、auth fixture、API client 等。它当前直接使用 `process.env.DATABASE_URL`（即 `goferbot_test`），并通过 `cleanupDatabase()` 清理。改造为模式 B：
1. `beforeAll` 创建独立数据库
2. `beforeEach` TRUNCATE 清理
3. 设置 `process.env.DATABASE_URL` 指向独立库（供 `cleanupDatabase()` 和 `createTestUser()` 使用）
4. `afterAll` 删除数据库

- [ ] **步骤 1: 编写改造后的测试骨架（先验证当前测试通过）**

运行当前测试确认基线：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/infra.spec.ts
```
预期：PASS（后端可用时）或部分 SKIP（后端不可用时）

- [ ] **步骤 2: 改造为模式 B（beforeAll 共享 + beforeEach TRUNCATE）**

修改 `tests/integration/infra.spec.ts`：
1. 检查文件头部是否有 `// @vitest-environment node`，若无则添加
2. 检查 import 是否包含 `import { describe, it, expect } from 'vitest'`，若无则添加
3. 导入 `TestDatabaseManager`
4. 添加 `dbManager`、`dbUrl`、`dbName`、`originalDatabaseUrl` 变量
5. `beforeAll`：
   - `dbManager = new TestDatabaseManager()`
   - `dbUrl = await dbManager.createDatabase('infra')`
   - `dbName = new URL(dbUrl).pathname.slice(1)`
   - `originalDatabaseUrl = process.env.DATABASE_URL`
   - `process.env.DATABASE_URL = dbUrl`（让 cleanupDatabase 和 createTestUser 使用独立库）
6. `beforeEach`：
   - 保留 `if (!backendOk) return`
   - 使用 `cleanupDatabase()`（现在会清理独立库）
7. `afterAll`：
   - `process.env.DATABASE_URL = originalDatabaseUrl`（恢复原始值）
   - `await dbManager.dropDatabase(dbName)`
8. AC-08 修改：验证 `dbUrl` 包含独立数据库名（而非硬编码验证 `goferbot`）

```typescript
import { TestDatabaseManager } from './helpers/test-database.manager.js'

let dbManager: TestDatabaseManager
let dbUrl: string
let dbName: string
let originalDatabaseUrl: string | undefined

describe('E2E Infrastructure (q-16)', () => {
  beforeAll(async () => {
    backendOk = await isBackendAvailable()
    
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('infra')
    dbName = new URL(dbUrl).pathname.slice(1)
    originalDatabaseUrl = process.env.DATABASE_URL
    process.env.DATABASE_URL = dbUrl
  })

  beforeEach(async () => {
    if (!backendOk) return
    await cleanupDatabase()
  })

  afterAll(async () => {
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
    if (dbManager && dbName) {
      await dbManager.dropDatabase(dbName)
    }
  })
  
  // AC-08 改为验证当前 DATABASE_URL 有效
  it('AC-08: DATABASE_URL points to isolated test database', () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeDefined()
    expect(dbUrl).toContain('goferbot_test_infra_')
  })
})
```

- [ ] **步骤 3: 运行测试验证通过**

运行：
```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/infra.spec.ts
```
预期：PASS

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/infra.spec.ts
git commit -m "test(q-25): infra.spec.ts 改造为模式 B 独立数据库"
```

---

### 任务 5: 全量集成测试回归

**规格引用：**
- 功能规格：[AC-05] 全部集成测试通过

- [ ] **步骤 1: 运行全部集成测试**

```bash
pnpm test:integration
```

- [ ] **步骤 2: 验证结果**

预期：所有测试通过（或基础设施不可用时优雅 SKIP），无失败。

- [ ] **步骤 3: 提交（如有必要）**

```bash
git commit -m "test(q-25): 全量集成测试回归验证通过"
```

---

### 任务 6: 清理 goferbot_test 残留数据

**规格引用：**
- 功能规格：[AC-06] goferbot_test 数据库无测试残留数据

- [ ] **步骤 1: 检查 goferbot_test 数据库中的残留表**

```bash
npx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;
EOF
```

- [ ] **步骤 2: 检查各表数据量**

```bash
npx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
SELECT 'users' as table_name, COUNT(*) as count FROM users
UNION ALL SELECT 'chunks', COUNT(*) FROM chunks
UNION ALL SELECT 'documents', COUNT(*) FROM documents
UNION ALL SELECT 'knowledge_bases', COUNT(*) FROM knowledge_bases
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'messages', COUNT(*) FROM messages
UNION ALL SELECT 'folders', COUNT(*) FROM folders
UNION ALL SELECT 'settings', COUNT(*) FROM settings;
EOF
```

- [ ] **步骤 3: 清理残留数据**

```bash
npx prisma db execute --url="$DATABASE_URL" --stdin <<EOF
TRUNCATE TABLE chunks, documents, knowledge_bases, sessions, messages, folders, settings, users RESTART IDENTITY CASCADE;
EOF
```

- [ ] **步骤 4: 验证清理结果**

重新运行步骤 2 的查询，确认所有表 count 为 0。

- [ ] **步骤 5: 提交**

```bash
git commit --allow-empty -m "test(q-25): 清理 goferbot_test 残留测试数据"
```

---

## 规格覆盖检查

| AC | 对应任务 | 验证方式 |
|----|---------|----------|
| AC-01 | 任务 1 | prisma-vector-indexer.spec.ts 运行通过 |
| AC-02 | 任务 2 | vector-service.spec.ts 运行通过 |
| AC-03 | 任务 3 | pgvector-store.spec.ts 运行通过 |
| AC-04 | 任务 4 | infra.spec.ts 运行通过 |
| AC-05 | 任务 5 | pnpm test:integration 全部通过 |
| AC-06 | 任务 6 | SQL 查询确认 goferbot_test 无残留 |

---

## 风险与注意事项

1. **数据库创建开销**：模式 A 每个 it 创建/销毁数据库，会增加测试时间。当前 4 个文件共约 20 个 it，预计增加 60-120 秒。
2. **Prisma 迁移开销**：`TestDatabaseManager.createDatabase` 已包含 `prisma migrate deploy`，无需额外处理。
3. **infra.spec.ts 环境变量覆盖**：临时修改 `process.env.DATABASE_URL` 可能影响并发测试。由于 vitest 集成测试使用 `pool: 'forks'`（进程隔离），此风险可控。
4. **基础设施不可用时**：保留 `checkInfrastructure` 和 `infraAvailable` 跳过逻辑，确保 CI 环境无基础设施时测试不失败。
