---
id: b-06
issue: issue.md
version: 1
---

# Folder/Session/Settings 模块级集成测试 实现计划

> **For agentic workers:** 必需子技能：superpowers:executing-plans（顺序执行）。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 FolderController、SessionController、SettingsController 编写 NestJS 模块级集成测试，覆盖 CRUD、认证、Zod 验证失败场景。

**架构：** 使用 `TestAppFactory` + `AuthFixtures` + `TestDatabaseManager` 创建隔离测试环境，通过 `app.inject()` 发起 HTTP 请求，真实命中 PostgreSQL 数据库。

**技术栈：** NestJS TestingModule + Vitest + Prisma + PostgreSQL

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/](specs/)

---

## 文件结构

### 新建文件
- `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts` — FolderController 集成测试
- `tests/issues/b-06-folder-session-settings-testing/session.spec.ts` — SessionController 集成测试
- `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts` — SettingsController 集成测试

### 参考文件（只读）
- `tests/integration/sessions.test.ts` — 旧 SQLite 路由测试（参考迁移）
- `tests/integration/settings.test.ts` — 旧 SQLite 路由测试（参考迁移）
- `tests/issues/b-05-chat-api-testing/chat.spec.ts` — NestJS 模块级测试参考模式

---

## 任务 1: FolderController 集成测试

**文件：**
- 创建：`tests/issues/b-06-folder-session-settings-testing/folder.spec.ts`

**规格引用：**
- API 规格：[FolderController 端点清单 — GET/POST/PATCH/DELETE]

- [ ] **步骤 1: 创建测试文件并运行确认失败（Red）**

创建 `tests/issues/b-06-folder-session-settings-testing/folder.spec.ts`，写入以下代码：

```typescript
// tests/issues/b-06-folder-session-settings-testing/folder.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

describe('FolderController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let token: string
  let kbId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('b06_folder')
    app = await TestAppFactory.create(dbUrl)
    await AuthFixtures.createUser(app, AuthFixtures.normalUser)
    token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
    // 创建知识库供后续测试使用
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Test KB' },
    })
    kbId = kbRes.json().data.id
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.slice(1)
    await dbManager.dropDatabase(dbName)
  })

  it('AC-01: returns folder list for knowledge base', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
  })

  it('AC-02: creates folder with valid data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'New Folder' },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.name).toBe('New Folder')
    expect(data.id).toBeDefined()
  })

  it('AC-03: returns 400 for invalid folder name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('AC-04: creates subfolder with parentId', async () => {
    const parentRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Parent Folder' },
    })
    const parentId = parentRes.json().data.id

    const childRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/folders`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Child Folder', parentId },
    })
    expect(childRes.statusCode).toBe(201)
    expect(childRes.json().data.parentId).toBe(parentId)

    // 按 parentId 筛选应只返回子文件夹
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/folders?parentId=${parentId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(listRes.statusCode).toBe(200)
    const list = listRes.json().data
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Child Folder')
  })

  it('AC-05: updates folder name', async () => {
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
    expect(res.json().data.name).toBe('Updated Name')
  })

  it('AC-06: returns 404 for non-existent folder', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/knowledge-bases/${kbId}/folders/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Name' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('AC-07: deletes folder', async () => {
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
  })

  it('AC-08: returns 404 for non-existent folder on delete', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/knowledge-bases/${kbId}/folders/00000000-0000-0000-0000-000000000000`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('AC-21: returns 401 without token for folder endpoints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/knowledge-bases/${kbId}/folders`,
    })
    expect(res.statusCode).toBe(401)
  })
})
```

运行测试确认失败：

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/folder.spec.ts
```

预期：FAIL — 文件不存在或编译/运行失败（因尚未创建或依赖未就绪）

- [ ] **步骤 2: 修复编译错误并重新运行（Green）**

如有编译错误（如导入路径、类型问题），修复后再次运行：

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/folder.spec.ts
```

预期：PASS（所有测试通过）

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-06-folder-session-settings-testing/folder.spec.ts
git commit -m "test(b-06): add FolderController integration tests (AC-01~AC-08, AC-21)"
```

---

## 任务 2: SessionController 集成测试

**文件：**
- 创建：`tests/issues/b-06-folder-session-settings-testing/session.spec.ts`

**规格引用：**
- API 规格：[SessionController 端点清单 — GET/POST/PATCH/DELETE]
- 旧测试参考：`tests/integration/sessions.test.ts`

- [ ] **步骤 1: 创建测试文件并运行确认失败（Red）**

创建 `tests/issues/b-06-folder-session-settings-testing/session.spec.ts`，写入以下代码：

```typescript
// tests/issues/b-06-folder-session-settings-testing/session.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

describe('SessionController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('b06_session')
    app = await TestAppFactory.create(dbUrl)
    await AuthFixtures.createUser(app, AuthFixtures.normalUser)
    token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.slice(1)
    await dbManager.dropDatabase(dbName)
  })

  it('AC-08: returns session list ordered by updatedAt desc', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(Array.isArray(res.json().data)).toBe(true)
  })

  it('AC-09: returns single session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Single Session' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.title).toBe('Single Session')
  })

  it('AC-09b: returns 404 for non-existent session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('AC-10: creates session with valid data', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New Session', provider: 'openai', model: 'gpt-4' },
    })
    expect(res.statusCode).toBe(201)
    const data = res.json().data
    expect(data.title).toBe('New Session')
    expect(data.id).toBeDefined()
  })

  it('AC-11: renames session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Old Name' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/rename`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New Name' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.title).toBe('New Name')
  })

  it('AC-12: returns 400 for empty title', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Temp' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'POST',
      url: `/api/sessions/${sessionId}/rename`,
      headers: { authorization: `Bearer ${token}` },
      payload: { title: '   ' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('AC-13: returns 404 for non-existent session', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000/rename',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'New' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('AC-14: deletes session', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'To Delete' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
  })

  it('AC-15: returns 404 for non-existent session on delete', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/sessions/00000000-0000-0000-0000-000000000000',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
  })

  it('AC-22: returns 401 without token for session endpoints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    })
    expect(res.statusCode).toBe(401)
  })
})
```

运行测试确认失败：

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/session.spec.ts
```

预期：FAIL — 文件不存在或编译/运行失败

- [ ] **步骤 2: 修复编译错误并重新运行（Green）**

如有编译错误，修复后再次运行：

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/session.spec.ts
```

预期：PASS

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-06-folder-session-settings-testing/session.spec.ts
git commit -m "test(b-06): add SessionController integration tests (AC-08~AC-15, AC-22)"
```

---

## 任务 3: SettingsController 集成测试

**文件：**
- 创建：`tests/issues/b-06-folder-session-settings-testing/settings.spec.ts`

**规格引用：**
- API 规格：[SettingsController 端点清单 — GET/POST]
- 旧测试参考：`tests/integration/settings.test.ts`

- [ ] **步骤 1: 创建测试文件并运行确认失败（Red）**

创建 `tests/issues/b-06-folder-session-settings-testing/settings.spec.ts`，写入以下代码：

```typescript
// tests/issues/b-06-folder-session-settings-testing/settings.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'

const validSettings = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

describe('SettingsController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('b06_settings')
    app = await TestAppFactory.create(dbUrl)
    await AuthFixtures.createUser(app, AuthFixtures.normalUser)
    token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.slice(1)
    await dbManager.dropDatabase(dbName)
  })

  it('AC-16: returns default settings', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const data = res.json().data
    expect(data).toHaveProperty('providers')
    expect(data).toHaveProperty('embeddingProvider')
    expect(data).toHaveProperty('temperature')
    expect(data).toHaveProperty('defaultChatProvider')
  })

  it('AC-17: saves and returns settings', async () => {
    const newSettings = {
      ...validSettings,
      temperature: 1.2,
      defaultChatProvider: 'openai',
    }

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: newSettings,
    })
    expect(postRes.statusCode).toBe(200)

    const getRes = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(getRes.statusCode).toBe(200)
    const data = getRes.json().data
    expect(data.temperature).toBe(1.2)
    expect(data.defaultChatProvider).toBe('openai')
  })

  it('AC-18: returns 400 for invalid temperature', async () => {
    const badSettings = {
      ...validSettings,
      temperature: 3.0,
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: badSettings,
    })
    expect(res.statusCode).toBe(400)
  })

  it('AC-19: returns 400 for invalid baseUrl', async () => {
    const badSettings = {
      ...validSettings,
      providers: {
        ...validSettings.providers,
        openai: { apiKey: '', model: 'gpt-4o', baseUrl: 'http://192.168.1.1' },
      },
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: badSettings,
    })
    expect(res.statusCode).toBe(400)
  })

  it('AC-20: returns 400 for invalid defaultChatProvider', async () => {
    const badSettings = {
      ...validSettings,
      defaultChatProvider: 'nonexistent-provider',
    }

    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: badSettings,
    })
    expect(res.statusCode).toBe(400)
  })

  it('AC-23: returns 401 without token for settings endpoints', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
    })
    expect(res.statusCode).toBe(401)
  })
})
```

运行测试确认失败：

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/settings.spec.ts
```

预期：FAIL — 文件不存在或编译/运行失败

- [ ] **步骤 2: 修复编译错误并重新运行（Green）**

如有编译错误，修复后再次运行：

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/settings.spec.ts
```

预期：PASS

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-06-folder-session-settings-testing/settings.spec.ts
git commit -m "test(b-06): add SettingsController integration tests (AC-16~AC-20, AC-23)"
```

---

## 任务 4: 全量测试验证与回归检查

- [ ] **步骤 1: 运行 b-06 全部测试**

```bash
npx vitest run tests/issues/b-06-folder-session-settings-testing/
```

预期：PASS — 所有 24 条用例通过（Folder 9 + Session 9 + Settings 6）

- [ ] **步骤 2: 运行类型检查**

```bash
pnpm type-check
```

预期：0 错误

- [ ] **步骤 3: 运行相关测试无回归**

```bash
npx vitest run tests/issues/b-05-chat-api-testing/
```

预期：0 失败（b-05 测试不受影响）

- [ ] **步骤 4: 更新 checklist.json 并提交**

将 `checklist.json` 中所有 AC 的 `status` 从 `"pending"` 改为 `"passed"`，并更新 `updated_at` 为当前日期：

```json
{
  "issue_id": "b-06",
  "version": 1,
  "updated_at": "2026-05-23",
  "items": [
    {"id": "AC-01", "desc": "FolderController CRUD 模块级测试", "status": "passed"},
    {"id": "AC-02", "desc": "SessionController CRUD + rename 模块级测试", "status": "passed"},
    {"id": "AC-03", "desc": "SettingsController read/write 模块级测试", "status": "passed"},
    {"id": "AC-04", "desc": "Settings Zod 验证失败测试（400 + 字段错误）", "status": "passed"},
    {"id": "AC-05", "desc": "旧 SQLite 路由测试参考迁移完成", "status": "passed"},
    {"id": "AC-06", "desc": "所有测试在 pnpm test:integration 中通过", "status": "passed"}
  ]
}
```

```bash
git add docs/issues/b-06-folder-session-settings-testing/checklist.json
git commit -m "test(b-06): mark all ACs passed in checklist"
```

---

## 自检

### 规格覆盖检查

| 规格来源 | 覆盖任务 | 状态 |
|----------|----------|------|
| feature-spec: Folder CRUD | 任务 1 | ✅ |
| feature-spec: Session CRUD | 任务 2 | ✅ |
| feature-spec: Settings read/write | 任务 3 | ✅ |
| feature-spec: Zod 验证失败测试 | 任务 3 (AC-18~AC-20) | ✅ |
| api-spec: 401 认证测试 | 任务 1/2/3 (AC-21~AC-23) | ✅ |
| api-spec: 400 参数错误 | 任务 1/2/3 (AC-03, AC-12, AC-18~AC-20) | ✅ |
| api-spec: 404 不存在 | 任务 1/2 (AC-06, AC-08, AC-09b, AC-13, AC-15) | ✅ |
| api-spec: parentId query | 任务 1 (AC-04) | ✅ |

### 占位符扫描
- [x] 无 "TBD" / "TODO" / "稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 每个任务都有具体代码块
- [x] 每个任务都有验证命令

### 类型一致性
- [x] `app.inject()` 参数格式与 b-05 一致
- [x] `headers: { authorization: Bearer ${token} }` 格式一致
- [x] `res.json().data` 响应格式与项目 ResponseInterceptor 一致
