---
id: q-29
issue: issue.md
version: 1
---

# PRD 第二批 Controller 模块级集成测试补齐 实现计划

> **目标：** 为 SessionController、SettingsController、FolderController 建立模块级集成测试，覆盖所有端点和 error cases。
> **架构：** `@nestjs/testing` + Fastify `app.inject()`，每文件独立数据库（TestDatabaseManager），mock 模式（不依赖 MinIO/pgvector/Redis）。
> **技术栈：** Vitest + NestJS TestingModule + FastifyAdapter

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/feature-spec.md`
**测试引用：** `tests/integration/`

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案 | ✅ 符合 | 使用 ZodValidationPipe，测试验证其错误返回 |
| ADR 0001 | 响应格式 | ✅ 符合 | 测试验证 `{ data: T }` 和 `{ error: { code, message } }` 格式 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入新依赖，复用现有测试基础设施 |

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| SessionController — CRUD + rename | ✅ 已覆盖 | 任务 1，覆盖 GET /api/sessions、GET /api/sessions/:id、POST /api/sessions、POST /api/sessions/:id/rename、DELETE /api/sessions/:id |
| SettingsController — read / write + Zod 验证失败 | ✅ 已覆盖 | 任务 2，覆盖 GET /api/settings、POST /api/settings，含 Zod 验证失败 |
| FolderController — CRUD | ✅ 已覆盖 | 任务 3，覆盖 GET /api/knowledge-bases/:kbId/folders、POST /api/knowledge-bases/:kbId/folders、PATCH /api/knowledge-bases/:kbId/folders/:folderId、DELETE /api/knowledge-bases/:kbId/folders/:folderId |
| 6 类场景覆盖 | ✅ 已覆盖 | 每个 Controller 覆盖 happy path、Zod 验证失败、认证缺失/无效、资源不存在、权限不足、边界条件 |
| 全部测试在 `pnpm test:integration` 通过 | ✅ 已覆盖 | 每个任务末尾运行完整集成测试套件验证 |
| 测试数据库零残留 | ✅ 已覆盖 | 每个文件 afterAll 中调用 `dropDatabase` |

---

## 文件结构

### 新建文件
- `tests/integration/session.controller.spec.ts` — SessionController 集成测试（~14 个用例）
- `tests/integration/settings.controller.spec.ts` — SettingsController 集成测试（~8 个用例）
- `tests/integration/folder.controller.spec.ts` — FolderController 集成测试（~16 个用例）

### 复用基础设施（不修改）
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`
- `tests/integration/helpers/auth.fixtures.ts`

---

## 任务列表

### 任务 1: SessionController 集成测试

**文件：**
- 创建：`tests/integration/session.controller.spec.ts`

**规格引用：**
- 功能规格：AC-01（SessionController 覆盖所有端点和 error cases）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/session.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('SessionController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string
  let userId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('session_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `session-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Session Test',
    })
    userId = user.id
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/sessions', () => {
    it('AC-01: returns session list with pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.items).toBeInstanceOf(Array)
      expect(body.data.pagination).toBeDefined()
    })

    it('AC-02: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('GET /api/sessions/:id', () => {
    it('AC-03: returns session by id', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Test Session' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.id).toBe(created.id)
      expect(body.data.title).toBe('Test Session')
    })

    it('AC-04: returns 404 for non-existent session', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/non-existent-id',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-05: returns 403 for other user session', async () => {
      const otherUser = await AuthFixtures.createUser(app, {
        email: `other-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Other',
      })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherUser.email, password: 'Test1234!' })

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Private Session' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'GET',
        url: `/api/sessions/${created.id}`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('AC-06: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sessions/some-id',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/sessions', () => {
    it('AC-07: creates session with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Session', provider: 'openai', model: 'gpt-4' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.title).toBe('New Session')
      expect(body.data.provider).toBe('openai')
      expect(body.data.userId).toBe(userId)
    })

    it('AC-08: creates session with default title when empty', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: {},
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.title).toBe('新对话')
    })

    it('AC-09: returns 400 for invalid title (too long)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'a'.repeat(101) },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-10: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: { title: 'Test' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/sessions/:id/rename', () => {
    it('AC-11: renames session', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Old Name' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${created.id}/rename`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Name' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.title).toBe('New Name')
    })

    it('AC-12: returns 400 for empty title', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Rename Test' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${created.id}/rename`,
        headers: { authorization: `Bearer ${token}` },
        payload: { title: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-13: returns 404 for non-existent session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/sessions/non-existent-id/rename',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'New Name' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-14: returns 403 for other user session', async () => {
      const otherUser = await AuthFixtures.createUser(app, {
        email: `other2-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Other2',
      })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherUser.email, password: 'Test1234!' })

      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'Private' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'POST',
        url: `/api/sessions/${created.id}/rename`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { title: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('DELETE /api/sessions/:id', () => {
    it('AC-15: deletes session', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/sessions',
        headers: { authorization: `Bearer ${token}` },
        payload: { title: 'To Delete' },
      })
      const { data: created } = createRes.json()

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/sessions/${created.id}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-16: returns 404 for non-existent session', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/sessions/non-existent-id',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-17: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/sessions/some-id',
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/session.controller.spec.ts`
预期：FAIL — 文件不存在或测试失败（因为被测代码已存在，预期断言失败 RED）

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建，或因为被测 Controller 已存在但测试断言正确失败。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/session.controller.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

> **注意**：任务完成后不提交。所有任务完成后统一审查、统一提交。

---

### 任务 2: SettingsController 集成测试

**文件：**
- 创建：`tests/integration/settings.controller.spec.ts`

**规格引用：**
- 功能规格：AC-02（SettingsController 覆盖所有端点和 error cases）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/settings.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('SettingsController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('settings_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `settings-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Settings Test',
    })
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  const validSettings = {
    providers: {
      openai: { apiKey: 'sk-test', model: 'gpt-4', baseUrl: '' },
      claude: { apiKey: 'sk-test', model: 'claude-3', baseUrl: '' },
      deepseek: { apiKey: 'sk-test', model: 'deepseek-chat', baseUrl: '' },
      custom: { apiKey: 'sk-test', model: 'custom', baseUrl: '' },
      ollama: { enabled: false, url: 'http://localhost:11434', model: 'llama2', baseUrl: '' },
    },
    embeddingProvider: { provider: 'openai', apiKey: 'sk-test', model: 'text-embedding-3', baseUrl: '' },
    temperature: 0.7,
    defaultChatProvider: 'openai',
  }

  describe('GET /api/settings', () => {
    it('AC-18: returns settings for authenticated user', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: validSettings,
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toBeDefined()
      expect(body.data.defaultChatProvider).toBe('openai')
    })

    it('AC-19: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/settings',
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/settings', () => {
    it('AC-20: saves settings with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: validSettings,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.defaultChatProvider).toBe('openai')
      expect(body.data.temperature).toBe(0.7)
    })

    it('AC-21: returns 400 for missing providers', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validSettings, providers: undefined },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-22: returns 400 for invalid temperature (out of range)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validSettings, temperature: 3 },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-23: returns 400 for invalid defaultChatProvider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: { ...validSettings, defaultChatProvider: 'invalid-provider' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-24: returns 400 for invalid baseUrl (SSRF)', async () => {
      const badSettings = {
        ...validSettings,
        providers: {
          ...validSettings.providers,
          openai: { apiKey: 'sk-test', model: 'gpt-4', baseUrl: 'http://192.168.1.1' },
        },
      }
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        headers: { authorization: `Bearer ${token}` },
        payload: badSettings,
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-25: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/settings',
        payload: validSettings,
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/settings.controller.spec.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/settings.controller.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

### 任务 3: FolderController 集成测试

**文件：**
- 创建：`tests/integration/folder.controller.spec.ts`

**规格引用：**
- 功能规格：AC-03（FolderController 覆盖所有端点和 error cases）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/folder.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('FolderController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string
  let userId: string
  let kbId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('folder_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `folder-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Folder Test',
    })
    userId = user.id
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' })

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test KB', description: 'For folder tests' },
    })
    kbId = kbRes.json().data.id
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/knowledge-bases/:kbId/folders', () => {
    it('AC-26: returns folder list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data).toBeInstanceOf(Array)
    })

    it('AC-27: returns 404 for non-existent kb', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases/non-existent-kb/folders',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-28: returns 403 for other user kb', async () => {
      const otherUser = await AuthFixtures.createUser(app, {
        email: `other-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Other',
      })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherUser.email, password: 'Test1234!' })

      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Other KB' },
      })
      const otherKbId = otherKbRes.json().data.id

      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${otherKbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('AC-29: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/folders`,
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/knowledge-bases/:kbId/folders', () => {
    it('AC-30: creates folder with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'New Folder' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('New Folder')
      expect(body.data.kbId).toBe(kbId)
    })

    it('AC-31: creates subfolder with parentId', async () => {
      const parentRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Parent Folder' },
      })
      const parentId = parentRes.json().data.id

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Child Folder', parentId },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.parentId).toBe(parentId)
    })

    it('AC-32: returns 400 for empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-33: returns 400 for invalid parentId format', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test', parentId: 'not-uuid' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-34: returns 404 for non-existent parentId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test', parentId: '00000000-0000-0000-0000-000000000000' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-35: returns 404 for non-existent kb', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases/non-existent-kb/folders',
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Test' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-36: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        payload: { name: 'Test' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('PATCH /api/knowledge-bases/:kbId/folders/:folderId', () => {
    it('AC-37: updates folder name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Old Name' },
      })
      const folderId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated Name' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.name).toBe('Updated Name')
    })

    it('AC-38: returns 400 for empty name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Rename Test' },
      })
      const folderId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-39: returns 404 for non-existent folder', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/folders/non-existent-folder`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-40: returns 403 for other user kb', async () => {
      const otherUser = await AuthFixtures.createUser(app, {
        email: `other2-${Date.now()}@test.gofer`,
        password: 'Test1234!',
        name: 'Other2',
      })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherUser.email, password: 'Test1234!' })

      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Other KB 2' },
      })
      const otherKbId = otherKbRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${otherKbId}/folders/some-id`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('DELETE /api/knowledge-bases/:kbId/folders/:folderId', () => {
    it('AC-41: deletes folder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/folders`,
        headers: { authorization: `Bearer ${token}` },
        payload: { name: 'To Delete' },
      })
      const folderId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/${folderId}`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-42: returns 404 for non-existent folder', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/non-existent-folder`,
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(404)
      const body = res.json()
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('AC-43: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/folders/some-id`,
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/folder.controller.spec.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/folder.controller.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

## 自检清单

- [ ] PRD 一致性：第二批所有 3 个 Controller 均已覆盖
- [ ] 规格覆盖：feature-spec.md 中所有验收标准（AC-01 ~ AC-43）都有对应任务
- [ ] 测试覆盖：每个任务都有对应的 `tests/integration/{name}.controller.spec.ts` 文件
- [ ] 占位符扫描：无 "TODO" / "TBD" / "稍后实现"
- [ ] 类型一致性：所有测试中使用的类型、方法与代码库一致
- [ ] ADR 合规：未引入新依赖，复用现有测试基础设施
- [ ] 6 类场景：每个 Controller 覆盖 happy path、Zod 验证失败、认证缺失/无效、资源不存在、权限不足、边界条件
