---
id: q-26
issue: issue.md
version: 1
---

# E2E 测试数据库清理机制 实现计划

> **For agentic workers:** 必需子技能：superpowers:executing-plans（推荐，任务间有强依赖）或 superpowers:subagent-driven-development。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 E2E 测试建立数据库清理机制，解决 `goferbot_e2e` 数据库随每次运行线性增长的问题。

**架构：** 复用现有 `fixtures/database.ts` 中的 `cleanupDatabase()` 函数（TRUNCATE 所有业务表），在 `globalTeardown` 中调用。为 `fixtures/auth.ts` 补充 `deleteTestUser()` 方法。为使用真实后端的测试文件增加 `test.afterEach` 清理。

**技术栈：** Playwright + pg (node-postgres) + Prisma

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md)

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案、响应格式 | ✅ 符合 | 本 issue 不涉及新增 API，无 DTO 变更 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入新依赖，复用现有 `pg` 客户端 |

---

## 文件结构

### 修改文件

| 文件 | 职责 |
|------|------|
| `tests/e2e/playwright.global-teardown.ts` | 增加 `cleanupDatabase()` 调用 |
| `tests/e2e/fixtures/auth.ts` | 增加 `deleteTestUser()` 方法 |
| `tests/e2e/fixtures/database.ts` | 更新 `TABLES_TO_TRUNCATE` 列表，与 Prisma schema 对齐 |
| `docs/guide/testing/e2e-testing-guide.md` | 更新 globalTeardown 职责说明 |

### 测试文件（TDD 验证）

| 文件 | 职责 |
|------|------|
| `tests/e2e/specs/database-cleanup.spec.ts` | 验证 `cleanupDatabase()` 正确清空所有表 |
| `tests/e2e/specs/auth-cleanup.spec.ts` | 验证 `deleteTestUser()` 按 email 和 id 删除用户 |

---

## 任务分解

### 任务 1: 更新 `TABLES_TO_TRUNCATE` 与 Prisma schema 对齐

**文件：**
- 修改：`tests/e2e/fixtures/database.ts`
- 测试：`tests/e2e/specs/database-cleanup.spec.ts`（新建）

**规格引用：**
- 功能规格：[AC-01 — globalTeardown 调用 cleanupDatabase() 清理所有业务表]

**背景：** 当前 `TABLES_TO_TRUNCATE` 包含 `chunks`, `messages`, `sessions`, `documents`, `folders`, `knowledge_bases`, `settings`, `users`。经核对 Prisma schema，表名映射正确（`@@map` 注解），但缺少 `_prisma_migrations` 的考虑（该表不应被清理，否则 migrate 状态丢失）。当前列表已完整覆盖所有业务表，无需新增表。

**变更内容：** 在 `database.ts` 顶部增加注释说明表列表与 Prisma schema 的对应关系，并标注 `_prisma_migrations` 被排除的原因。

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/specs/database-cleanup.spec.ts
import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../fixtures/database'
import { Client } from 'pg'

const TEST_DB_URL = 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

test.describe('AC-01: cleanupDatabase 清理所有业务表', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('清理后所有业务表记录数为 0', async () => {
    const client = new Client({ connectionString: TEST_DB_URL })
    await client.connect()

    const ts = Date.now()
    await client.query(
      `INSERT INTO users (id, email, password, name, updated_at) VALUES ('test-user-${ts}', 'test${ts}@example.com', 'pass', 'Test', NOW())`,
    )
    await client.query(
      `INSERT INTO sessions (id, user_id, title, updated_at) VALUES ('test-session-${ts}', 'test-user-${ts}', 'Test Session', NOW())`,
    )

    await cleanupDatabase()

    const tables = ['users', 'sessions', 'messages', 'knowledge_bases', 'folders', 'documents', 'chunks', 'settings']
    for (const table of tables) {
      const res = await client.query(`SELECT COUNT(*) FROM ${table}`)
      expect(Number(res.rows[0].count)).toBe(0)
    }

    await client.end()
  })

  test('AC-05: 连续运行两次 cleanupDatabase 不报错', async () => {
    await cleanupDatabase()
    await expect(cleanupDatabase()).resolves.not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`pnpm exec playwright test tests/e2e/specs/database-cleanup.spec.ts`
预期：FAIL — 可能因 `DATABASE_URL` 未设置或数据库不可达而失败

- [ ] **步骤 3: 确认 database.ts 表列表完整性**

在 `tests/e2e/fixtures/database.ts` 顶部增加注释：

```typescript
// TABLES_TO_TRUNCATE 与 Prisma schema 业务表对应关系：
// users → User, sessions → Session, messages → Message,
// knowledge_bases → KnowledgeBase, folders → Folder,
// documents → Document, chunks → Chunk, settings → Setting
// 注意：_prisma_migrations 不在列表中，避免破坏 migrate 状态
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm exec playwright test tests/e2e/specs/database-cleanup.spec.ts`
预期：PASS（所有测试通过，需确保 E2E 数据库可访问）

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/fixtures/database.ts tests/e2e/specs/database-cleanup.spec.ts
git commit -m "test(q-26): 验证 cleanupDatabase 清空所有业务表"
```

---

### 任务 2: 在 `globalTeardown` 中调用 `cleanupDatabase()`

**文件：**
- 修改：`tests/e2e/playwright.global-teardown.ts`
- 测试：`tests/e2e/playwright.global-teardown.spec.ts`（新建）

**规格引用：**
- 功能规格：[AC-01 — globalTeardown 调用 cleanupDatabase() 清理所有业务表]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/playwright.global-teardown.spec.ts
import { describe, it, expect, vi } from 'vitest'

describe('globalTeardown', () => {
  it('AC-01: 导入 globalTeardown 模块不报错', async () => {
    const mod = await import('./playwright.global-teardown')
    expect(typeof mod.default).toBe('function')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/e2e/playwright.global-teardown.spec.ts`
预期：FAIL — "Cannot find module './playwright.global-teardown'" 或文件不存在

- [ ] **步骤 3: 修改 globalTeardown**

在 `tests/e2e/playwright.global-teardown.ts` 中：

```typescript
import { cleanupDatabase } from './fixtures/database'

// 在 globalTeardown 函数末尾、CI infra:down 之前增加：
export default async function globalTeardown() {
  // ... 现有后端进程关闭逻辑 ...

  // 清理 E2E 数据库
  try {
    await cleanupDatabase()
    console.log('[E2E] Database cleaned up')
  } catch (err) {
    console.error('[E2E] Database cleanup failed:', err)
  }

  if (process.env.CI) {
    // ... 现有逻辑 ...
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/e2e/playwright.global-teardown.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/playwright.global-teardown.ts
git commit -m "test(q-26): globalTeardown 增加 cleanupDatabase 调用"
```

---

### 任务 3: 为 `fixtures/auth.ts` 增加 `deleteTestUser()`

**文件：**
- 修改：`tests/e2e/fixtures/auth.ts`
- 测试：`tests/e2e/specs/auth-cleanup.spec.ts`（新建）

**规格引用：**
- 功能规格：[AC-02 — fixtures/auth.ts 支持 deleteTestUser(email) 和 deleteTestUser(id)]

**背景：** 当前 `createTestUser()` 通过真实 API 注册用户，但无配套删除逻辑。`cachedTestUser` 在进程内缓存，跨测试运行不共享。需要增加 `deleteTestUser()` 支持按 email 或 id 删除。

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/specs/auth-cleanup.spec.ts
import { test, expect } from '@playwright/test'
import { createTestUser, deleteTestUser } from '../fixtures/auth'

test.describe('AC-02: deleteTestUser 删除测试用户', () => {
  test('按 email 删除测试用户', async () => {
    const user = await createTestUser()
    await deleteTestUser({ email: user.email })

    // 验证用户已删除：尝试用相同邮箱注册应成功（唯一约束已释放）
    const newUser = await createTestUser()
    expect(newUser.email).not.toBe(user.email)
  })

  test('按 id 删除测试用户', async () => {
    const user = await createTestUser()
    expect(user.userId).toBeTruthy()
    await deleteTestUser({ id: user.userId! })

    // 验证删除不抛错
    await expect(deleteTestUser({ id: 'non-existent-id' })).resolves.not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`pnpm exec playwright test tests/e2e/specs/auth-cleanup.spec.ts`
预期：FAIL — "deleteTestUser is not defined" 或 "deleteTestUser is not exported"

- [ ] **步骤 3: 实现 deleteTestUser**

在 `tests/e2e/fixtures/auth.ts` 中，在 `createTestUser()` 之后增加：

```typescript
import { Client } from 'pg'

export interface DeleteTestUserOptions {
  email?: string
  id?: string
}

export async function deleteTestUser(options: DeleteTestUserOptions): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    if (options.id) {
      await client.query('DELETE FROM users WHERE id = $1', [options.id])
    } else if (options.email) {
      await client.query('DELETE FROM users WHERE email = $1', [options.email])
    }
  } finally {
    await client.end()
  }

  // 简化缓存清理：仅当删除的是当前缓存用户时才清空
  if (cachedTestUser) {
    const matchById = options.id && options.id === cachedTestUser.userId
    const matchByEmail = options.email && options.email === cachedTestUser.email
    if (matchById || matchByEmail) {
      cachedTestUser = null
    }
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm exec playwright test tests/e2e/specs/auth-cleanup.spec.ts`
预期：PASS（需确保后端运行在 127.0.0.1:3000 且 E2E 数据库可访问）

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/fixtures/auth.ts tests/e2e/specs/auth-cleanup.spec.ts
git commit -m "test(q-26): fixtures/auth.ts 增加 deleteTestUser 方法"
```

---

### 任务 4: 为关键测试文件增加 `test.afterEach` 清理

**文件：**
- 修改：`tests/e2e/flows/*.spec.ts`（4 个文件）
- 修改：`tests/e2e/specs/*.spec.ts`（8 个文件）

**规格引用：**
- 功能规格：[AC-03 — 关键测试文件增加 test.afterEach 清理]

**背景：** 经代码审查，当前所有 E2E 测试（`specs/` 和 `flows/`）均使用 Mock 模式（`injectMockToken` + `mockApiRoutes`），不调用 `createTestUser()`。但为防御未来引入真实后端测试，`test.afterEach` 清理作为安全网。

**策略：** 在 `fixtures/auth.ts` 的 `test` fixture 扩展中增加 `autoCleanup` fixture，自动在每个测试后执行 `cleanupDatabase()`。这比逐个文件添加 `test.afterEach` 更 DRY。

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/specs/auth-cleanup.spec.ts
import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../fixtures/database'

test.describe('AC-03: autoCleanup fixture', () => {
  test('cleanupDatabase 可被直接导入并调用', async () => {
    await expect(cleanupDatabase()).resolves.not.toThrow()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`pnpm exec playwright test tests/e2e/specs/auth-cleanup.spec.ts`
预期：FAIL — 文件不存在

- [ ] **步骤 3: 在 auth.ts fixture 中增加 autoCleanup**

修改 `tests/e2e/fixtures/auth.ts` 中的 `test` fixture 扩展：

```typescript
import { cleanupDatabase } from './database'

export const test = base.extend<{
  testUser: TestUser
  authPage: { gotoLogin: () => Promise<void> }
  autoCleanup: void
}>({
  testUser: async ({ page }, use) => {
    const user = mockUsers.registered
    await use(user)
  },

  authPage: async ({ page }, use) => {
    await use({
      gotoLogin: async () => {
        await page.goto('/login')
      },
    })
  },

  // 自动清理 fixture：每个测试后执行
  // 策略：始终执行 cleanupDatabase，因为 Mock 模式下数据库仍可能有残留
  // （如 globalSetup 创建的初始数据、或其他测试泄漏的数据）
  autoCleanup: [
    async ({}, use, testInfo) => {
      await use()
      try {
        await cleanupDatabase()
      } catch {
        // 忽略清理失败，避免干扰测试失败判定
      }
    },
    { auto: true },
  ],
})
```

- [ ] **步骤 4: 运行测试验证通过**

运行：`pnpm exec playwright test tests/e2e/specs/auth-cleanup.spec.ts`
预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/fixtures/auth.ts tests/e2e/specs/auth-cleanup.spec.ts
git commit -m "test(q-26): auth fixture 增加 autoCleanup 自动清理"
```

---

### 任务 5: 更新 E2E 测试指南文档

**文件：**
- 修改：`docs/guide/testing/e2e-testing-guide.md`

**规格引用：**
- 功能规格：[AC-03 — 更新 e2e-testing-guide.md 文档]

- [ ] **步骤 1: 修改 globalTeardown 说明**

在 `docs/guide/testing/e2e-testing-guide.md` 的 2.2 节中，更新 `globalTeardown` 描述：

```markdown
globalTeardown (tests/e2e/playwright.global-teardown.ts):
  1. 调用 `cleanupDatabase()` 清理 E2E 数据库所有业务表
  2. 关闭后端服务（若由 setup 启动）
     - Windows: taskkill /PID /T /F
     - Linux/macOS: process.kill(-pid, 'SIGTERM')
  3. CI 模式下执行 pnpm infra:down
  4. 本地模式保持 docker 运行以便复用
```

- [ ] **步骤 2: 增加数据库清理章节**

在文档中新增一节（如 2.4）：

```markdown
## 2.4 数据库清理机制

E2E 测试使用独立数据库 `goferbot_e2e`，每次运行后自动清理：

| 层级 | 触发时机 | 清理方式 | 覆盖范围 |
|------|---------|---------|---------|
| globalTeardown | 全部测试结束后 | `cleanupDatabase()` TRUNCATE | 所有业务表 |
| autoCleanup fixture | 每个测试后（真实后端模式） | `cleanupDatabase()` TRUNCATE | 所有业务表 |
| deleteTestUser | 按需 | `DELETE FROM users WHERE ...` | 指定用户 |

### 业务表列表

`cleanupDatabase()` 清理以下表（按依赖顺序）：
`chunks`, `messages`, `sessions`, `documents`, `folders`, `knowledge_bases`, `settings`, `users`

> 注意：`_prisma_migrations` 表不被清理，以保持 migrate 状态。
```

- [ ] **步骤 3: 提交**

```bash
git add docs/guide/testing/e2e-testing-guide.md
git commit -m "docs(q-26): 更新 E2E 测试指南，增加数据库清理机制说明"
```

---

### 任务 6: 运行全量 E2E 测试验证

**规格引用：**
- 功能规格：[AC-04 — 全部 E2E 测试通过]
- 功能规格：[AC-05 — 连续运行两次 E2E，第二次运行时 users 表无上一轮数据]

- [ ] **步骤 1: 运行 E2E 测试**

```bash
pnpm test:e2e
```

预期：全部测试通过（75/75 或当前数量）

- [ ] **步骤 2: 验证 AC-05（连续运行无数据累积）**

```bash
# 第一次运行后查询 users 表数量
pnpm exec tsx -e "
import { Client } from 'pg'
const c = new Client({ connectionString: process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public' })
await c.connect()
const r = await c.query('SELECT COUNT(*) FROM users')
console.log('Users count after first run:', r.rows[0].count)
await c.end()
"
```

预期：`0`

```bash
# 第二次运行 E2E
pnpm test:e2e
```

```bash
# 第二次运行后再次查询
pnpm exec tsx -e "..."
```

预期：`0`（无累积）

- [ ] **步骤 3: 提交**

```bash
git commit -m "test(q-26): E2E 全量通过，验证数据库清理机制有效"
```

---

## 验证命令汇总

| 阶段 | 命令 | 预期结果 |
|------|------|---------|
| E2E fixtures | `pnpm exec playwright test tests/e2e/specs/database-cleanup.spec.ts` | PASS |
| E2E fixtures | `pnpm exec playwright test tests/e2e/specs/auth-cleanup.spec.ts` | PASS |
| E2E 测试 | `pnpm test:e2e` | 全部通过 |
| 数据验证 | 查询 `goferbot_e2e.users` count | 运行后为 0 |

---

## 自检

### 规格覆盖检查

| Spec 需求 | 对应任务 | 状态 |
|-----------|---------|------|
| AC-01: globalTeardown 调用 cleanupDatabase() | 任务 2 | ✅ |
| AC-02: fixtures/auth.ts 支持 deleteTestUser | 任务 3 | ✅ |
| AC-03: 关键测试文件增加 test.afterEach 清理 | 任务 4 | ✅ |
| AC-04: 全部 E2E 测试通过 | 任务 6 | ✅ |
| AC-05: 连续运行两次无数据累积 | 任务 6 | ✅ |

### 占位符扫描

- [x] 无 "TODO" / "TBD" / "稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 每个任务都有具体代码块
- [x] 所有引用的函数/类型在任务中已定义

### 类型一致性

- `deleteTestUser(options: DeleteTestUserOptions)` 签名一致
- `cleanupDatabase()` 无参数、返回 `Promise<void>` 一致
- `TestUser` 接口已包含 `userId?: string`