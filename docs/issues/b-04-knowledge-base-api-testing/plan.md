---
id: b-04
issue: issue.md
version: 1
---

# KnowledgeBaseController 测试实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 KnowledgeBaseController 全部 4 个端点编写模块级集成测试，覆盖 CRUD、DTO 校验、权限控制和多用户隔离。

**架构：** 使用 `TestAppFactory.create()` 启动完整 NestJS 应用（已含 StorageService mock），每个测试独立创建/销毁数据库。测试通过 `app.inject()` 发送 HTTP 请求，验证响应状态码和结构。无需额外 mock。

**技术栈：** Vitest + NestJS TestingModule + Fastify Adapter + Prisma

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) | [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts` | 主测试文件，15 条 AC 用例 |

---

## 前置依赖

- `TEST_DATABASE_ADMIN_URL` 环境变量已设置
- `b-03-document-api-testing` 已完成（`TestAppFactory` 已包含 StorageService mock）
- `i-01` 已完成（测试基础设施就绪）

---

## 任务 1: 搭建测试骨架

**文件：**
- 创建：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`

**规格引用：**
- API 规格：[测试映射 - 全部 AC]

- [ ] **步骤 1: 编写失败测试（骨架）**

创建测试文件，导入依赖，编写所有 15 个 `it` 块（仅包含 `expect(true).toBe(false)` 占位）。

```typescript
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

describe('KnowledgeBaseController', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-01: lists knowledge bases for current user', async () => {
    expect(true).toBe(false)
  })

  it('AC-02: creates knowledge base with valid data', async () => {
    expect(true).toBe(false)
  })

  // ... 其余 13 个 AC 占位
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`
预期：FAIL — 15 个测试全部失败（`expected true to be false`）

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts
git commit -m "test(b-04): add KnowledgeBaseController test skeleton with 15 AC placeholders"
```

---

## 任务 2: AC-01 ~ AC-05 — 正常流程 + 空列表

**文件：**
- 修改：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`

**规格引用：**
- API 规格：[GET 200]、[POST 201]、[PATCH 200]、[DELETE 200]

- [ ] **步骤 1: 编写失败测试（AC-01 ~ AC-05）**

```typescript
it('AC-01: lists knowledge bases for current user', async () => {
  const dbUrl = await dbManager.createDatabase('kb_list')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a1@gofer.bot', password: 'Test1234!', name: 'A1' })
  const token = await AuthFixtures.loginAs(app, { email: 'a1@gofer.bot', password: 'Test1234!' })

  const createRes1 = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'kb1' },
  })
  expect(createRes1.statusCode).toBe(201)

  const createRes2 = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'kb2' },
  })
  expect(createRes2.statusCode).toBe(201)

  const listRes = await app.inject({
    method: 'GET',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(listRes.statusCode).toBe(200)
  const body = listRes.json()
  const kbs = body.data
  expect(Array.isArray(kbs)).toBe(true)
  expect(kbs).toHaveLength(2)
  expect(kbs[0].name).toBe('kb1')
  expect(kbs[1].name).toBe('kb2')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-02: creates knowledge base with valid data', async () => {
  const dbUrl = await dbManager.createDatabase('kb_create')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a2@gofer.bot', password: 'Test1234!', name: 'A2' })
  const token = await AuthFixtures.loginAs(app, { email: 'a2@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'new-kb', description: 'test desc', icon: 'star' },
  })
  expect(res.statusCode).toBe(201)
  const body = res.json()
  const kb = body.data
  expect(kb.name).toBe('new-kb')
  expect(kb.description).toBe('test desc')
  expect(kb.icon).toBe('star')
  expect(kb.isPinned).toBe(false)
  expect(kb.sortOrder).toBeGreaterThanOrEqual(0)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-03: updates knowledge base with valid data', async () => {
  const dbUrl = await dbManager.createDatabase('kb_update')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a3@gofer.bot', password: 'Test1234!', name: 'A3' })
  const token = await AuthFixtures.loginAs(app, { email: 'a3@gofer.bot', password: 'Test1234!' })

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'old-name' },
  })
  const kb = createRes.json().data

  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/knowledge-bases/${kb.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'new-name' },
  })
  expect(updateRes.statusCode).toBe(200)
  const updated = updateRes.json().data
  expect(updated.name).toBe('new-name')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-04: deletes knowledge base and returns confirmation', async () => {
  const dbUrl = await dbManager.createDatabase('kb_delete')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a4@gofer.bot', password: 'Test1234!', name: 'A4' })
  const token = await AuthFixtures.loginAs(app, { email: 'a4@gofer.bot', password: 'Test1234!' })

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'to-delete' },
  })
  const kb = createRes.json().data

  const deleteRes = await app.inject({
    method: 'DELETE',
    url: `/api/knowledge-bases/${kb.id}`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(deleteRes.statusCode).toBe(200)
  const result = deleteRes.json().data
  expect(result.id).toBe(kb.id)
  expect(result.deleted).toBe(true)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-05: returns empty array when no knowledge bases exist', async () => {
  const dbUrl = await dbManager.createDatabase('kb_empty')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a5@gofer.bot', password: 'Test1234!', name: 'A5' })
  const token = await AuthFixtures.loginAs(app, { email: 'a5@gofer.bot', password: 'Test1234!' })

  const listRes = await app.inject({
    method: 'GET',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
  })
  expect(listRes.statusCode).toBe(200)
  const kbs = listRes.json().data
  expect(Array.isArray(kbs)).toBe(true)
  expect(kbs).toHaveLength(0)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败（RED）**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts --reporter=verbose`
预期：FAIL — AC-01~AC-05 因测试断言与生产代码实际行为不匹配而失败。必须观察到失败后再继续。

- [ ] **步骤 3: 运行测试验证通过（GREEN）**

运行：同上
预期：PASS — AC-01~AC-05 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts
git commit -m "test(b-04): AC-01~AC-05 normal flow tests for KnowledgeBaseController"
```

---

## 任务 3: AC-06 ~ AC-07 — 边界场景

**文件：**
- 修改：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`

**规格引用：**
- API 规格：[PATCH 空 body][PATCH isPinned/sortOrder]

- [ ] **步骤 1: 编写失败测试（AC-06 ~ AC-07）**

```typescript
it('AC-06: updates with empty body returns unchanged', async () => {
  const dbUrl = await dbManager.createDatabase('kb_empty_body')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a6@gofer.bot', password: 'Test1234!', name: 'A6' })
  const token = await AuthFixtures.loginAs(app, { email: 'a6@gofer.bot', password: 'Test1234!' })

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'unchanged' },
  })
  const kb = createRes.json().data

  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/knowledge-bases/${kb.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: {},
  })
  expect(updateRes.statusCode).toBe(200)
  const updated = updateRes.json().data
  expect(updated.name).toBe('unchanged')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-07: updates isPinned and sortOrder', async () => {
  const dbUrl = await dbManager.createDatabase('kb_pin_sort')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a7@gofer.bot', password: 'Test1234!', name: 'A7' })
  const token = await AuthFixtures.loginAs(app, { email: 'a7@gofer.bot', password: 'Test1234!' })

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'sortable' },
  })
  const kb = createRes.json().data

  const updateRes = await app.inject({
    method: 'PATCH',
    url: `/api/knowledge-bases/${kb.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { isPinned: true, sortOrder: 5 },
  })
  expect(updateRes.statusCode).toBe(200)
  const updated = updateRes.json().data
  expect(updated.isPinned).toBe(true)
  expect(updated.sortOrder).toBe(5)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts --reporter=verbose`
预期：FAIL — AC-06~AC-07 因断言不匹配而失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上
预期：PASS — AC-06~AC-07 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts
git commit -m "test(b-04): AC-06~AC-07 boundary tests for KnowledgeBaseController"
```

---

## 任务 4: AC-08 ~ AC-11 — DTO 校验错误测试

**文件：**
- 修改：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`

**规格引用：**
- API 规格：[POST 400]、[PATCH 400]

- [ ] **步骤 1: 编写失败测试（AC-08 ~ AC-11）**

```typescript
it('AC-08: returns 400 when name is empty string', async () => {
  const dbUrl = await dbManager.createDatabase('kb_name_empty')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a8@gofer.bot', password: 'Test1234!', name: 'A8' })
  const token = await AuthFixtures.loginAs(app, { email: 'a8@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: '' },
  })
  expect(res.statusCode).toBe(400)
  const body = res.json()
  expect(body.error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-09: returns 400 when name exceeds 100 chars', async () => {
  const dbUrl = await dbManager.createDatabase('kb_name_long')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a9@gofer.bot', password: 'Test1234!', name: 'A9' })
  const token = await AuthFixtures.loginAs(app, { email: 'a9@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'a'.repeat(101) },
  })
  expect(res.statusCode).toBe(400)
  const body = res.json()
  expect(body.error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-10: returns 400 when description exceeds 500 chars', async () => {
  const dbUrl = await dbManager.createDatabase('kb_desc_long')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a10@gofer.bot', password: 'Test1234!', name: 'A10' })
  const token = await AuthFixtures.loginAs(app, { email: 'a10@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'valid', description: 'a'.repeat(501) },
  })
  expect(res.statusCode).toBe(400)
  const body = res.json()
  expect(body.error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-11: returns 400 when sortOrder is negative', async () => {
  const dbUrl = await dbManager.createDatabase('kb_sort_neg')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a11@gofer.bot', password: 'Test1234!', name: 'A11' })
  const token = await AuthFixtures.loginAs(app, { email: 'a11@gofer.bot', password: 'Test1234!' })

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'kb' },
  })
  const kb = createRes.json().data

  const res = await app.inject({
    method: 'PATCH',
    url: `/api/knowledge-bases/${kb.id}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { sortOrder: -1 },
  })
  expect(res.statusCode).toBe(400)
  const body = res.json()
  expect(body.error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts --reporter=verbose`
预期：FAIL — 400 错误码验证失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上
预期：PASS — AC-08~AC-11 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts
git commit -m "test(b-04): AC-08~AC-11 DTO validation error tests"
```

---

## 任务 5: AC-12 ~ AC-14 — 认证、权限、资源不存在

**文件：**
- 修改：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`

**规格引用：**
- API 规格：[401 场景]、[403 场景]、[404 场景]

- [ ] **步骤 1: 编写失败测试（AC-12 ~ AC-14）**

```typescript
it('AC-12: returns 401 without valid JWT', async () => {
  const dbUrl = await dbManager.createDatabase('kb_401')
  const app = await TestAppFactory.create(dbUrl)

  const res = await app.inject({
    method: 'GET',
    url: '/api/knowledge-bases',
  })
  expect(res.statusCode).toBe(401)
  const body = res.json()
  expect(body.error.code).toBe('AUTH_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-13: returns 403 for non-owner access', async () => {
  const dbUrl = await dbManager.createDatabase('kb_403')
  const app = await TestAppFactory.create(dbUrl)

  const userA = await AuthFixtures.createUser(app, { email: 'owner@gofer.bot', password: 'Test1234!', name: 'Owner' })
  const tokenA = await AuthFixtures.loginAs(app, { email: 'owner@gofer.bot', password: 'Test1234!' })
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { name: 'kb-a' },
  })
  const kb = createRes.json().data

  const userB = await AuthFixtures.createUser(app, { email: 'intruder@gofer.bot', password: 'Test1234!', name: 'Intruder' })
  const tokenB = await AuthFixtures.loginAs(app, { email: 'intruder@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'DELETE',
    url: `/api/knowledge-bases/${kb.id}`,
    headers: { authorization: `Bearer ${tokenB}` },
  })
  expect(res.statusCode).toBe(403)
  const body = res.json()
  expect(body.error.code).toBe('FORBIDDEN')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

it('AC-14: returns 404 for non-existent knowledge base', async () => {
  const dbUrl = await dbManager.createDatabase('kb_404')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'a14@gofer.bot', password: 'Test1234!', name: 'A14' })
  const token = await AuthFixtures.loginAs(app, { email: 'a14@gofer.bot', password: 'Test1234!' })

  const fakeId = '00000000-0000-0000-0000-000000000000'
  const res = await app.inject({
    method: 'PATCH',
    url: `/api/knowledge-bases/${fakeId}`,
    headers: { authorization: `Bearer ${token}` },
    payload: { name: 'ghost' },
  })
  expect(res.statusCode).toBe(404)
  const body = res.json()
  expect(body.error.code).toBe('NOT_FOUND')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts --reporter=verbose`
预期：FAIL — 401/403/404 错误码验证失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上
预期：PASS — AC-12~AC-14 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts
git commit -m "test(b-04): AC-12~AC-14 authentication, authorization and not-found tests"
```

---

## 任务 6: AC-15 — 多用户隔离测试

**文件：**
- 修改：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`

**规格引用：**
- API 规格：[测试映射 - AC-15]

- [ ] **步骤 1: 编写失败测试（AC-15）**

```typescript
it('AC-15: user A cannot see user B knowledge bases', async () => {
  const dbUrl = await dbManager.createDatabase('kb_isolation')
  const app = await TestAppFactory.create(dbUrl)

  const userA = await AuthFixtures.createUser(app, { email: 'alice@gofer.bot', password: 'Test1234!', name: 'Alice' })
  const tokenA = await AuthFixtures.loginAs(app, { email: 'alice@gofer.bot', password: 'Test1234!' })

  const createRes = await app.inject({
    method: 'POST',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${tokenA}` },
    payload: { name: 'alice-kb' },
  })
  expect(createRes.statusCode).toBe(201)

  const userB = await AuthFixtures.createUser(app, { email: 'bob@gofer.bot', password: 'Test1234!', name: 'Bob' })
  const tokenB = await AuthFixtures.loginAs(app, { email: 'bob@gofer.bot', password: 'Test1234!' })

  const listRes = await app.inject({
    method: 'GET',
    url: '/api/knowledge-bases',
    headers: { authorization: `Bearer ${tokenB}` },
  })
  expect(listRes.statusCode).toBe(200)
  const kbs = listRes.json().data
  expect(Array.isArray(kbs)).toBe(true)
  expect(kbs.some((kb: { name: string }) => kb.name === 'alice-kb')).toBe(false)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts --reporter=verbose`
预期：FAIL — AC-15 断言失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上
预期：PASS — AC-15 通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts
git commit -m "test(b-04): AC-15 multi-user isolation test"
```

---

## 任务 7: 最终验证与清理

**文件：**
- 修改：`tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts`（如有清理需求）

- [ ] **步骤 1: 全量运行测试**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-04-knowledge-base-api-testing/knowledge-base.spec.ts --reporter=verbose`
预期：PASS — 15/15 测试全部通过

- [ ] **步骤 2: 运行相关测试无回归**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/i-01-testing-infra-setup/ tests/issues/b-02-auth-api-testing/ tests/issues/b-03-document-api-testing/ --reporter=verbose`
预期：PASS — 已有测试不受影响

- [ ] **步骤 3: 类型检查**

运行：`pnpm type-check`
预期：0 错误

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-04-knowledge-base-api-testing/
git commit -m "test(b-04): complete KnowledgeBaseController integration tests (15 ACs)"
```

---

## 自检

### 规格覆盖检查

| Spec 需求 | 对应任务 | AC |
|-----------|----------|-----|
| GET list 正常 | 任务 2 | AC-01 |
| POST create 正常 | 任务 2 | AC-02 |
| PATCH update 正常 | 任务 2 | AC-03 |
| DELETE remove 正常 | 任务 2 | AC-04 |
| 空列表 | 任务 2 | AC-05 |
| 空 body 更新 | 任务 3 | AC-06 |
| isPinned/sortOrder | 任务 3 | AC-07 |
| name 为空 | 任务 4 | AC-08 |
| name 超长 | 任务 4 | AC-09 |
| description 超长 | 任务 4 | AC-10 |
| sortOrder 负数 | 任务 4 | AC-11 |
| 未认证 | 任务 5 | AC-12 |
| 非所有者 | 任务 5 | AC-13 |
| KB 不存在 | 任务 5 | AC-14 |
| 多用户隔离 | 任务 6 | AC-15 |

### 占位符扫描

- [x] 无 "TBD" / "TODO" / "稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 无 "类似于任务 N" 的引用
- [x] 每个任务都有具体代码块
- [x] 每个任务都以测试开始，以测试通过结束

### 类型一致性

- [x] 响应体解析使用 `body.data`（统一 `{ data: T }` 格式）
- [x] 数据库清理模式统一（`app.close()` → `dropDatabase`）
- [x] 所有测试 email 唯一不冲突
