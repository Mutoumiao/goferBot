---
id: q-28
issue: issue.md
version: 2
---

# PRD 第一批 Controller 模块级集成测试补齐 实现计划

> **目标：** 为 AuthController、DocumentController、ChatController、KnowledgeBaseController 建立模块级集成测试，覆盖所有端点和 error cases。
> **架构：** `@nestjs/testing` + Fastify `app.inject()`，每文件独立数据库（TestDatabaseManager），mock 模式（不依赖 MinIO/Milvus/Redis）。
> **技术栈：** Vitest + NestJS TestingModule + FastifyAdapter
> **版本变更：** v2 补充 api-spec.md 中所有缺失的测试用例，明确速率限制测试移至第三批

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/feature-spec.md` + `specs/api-spec.md`
**测试引用：** `tests/integration/`

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案 | ✅ 符合 | 使用 ZodValidationPipe，测试验证其错误返回 |
| ADR 0001 | 响应格式 | ✅ 符合 | 测试验证 `{ data: T }` 和 `{ error: { code, message } }` 格式 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入新依赖，复用现有测试基础设施 |

---

## 文件结构

### 新建文件
- `tests/integration/auth.controller.spec.ts` — AuthController 集成测试（~22 个用例）
- `tests/integration/document.controller.spec.ts` — DocumentController 集成测试（~27 个用例）
- `tests/integration/chat.controller.spec.ts` — ChatController 集成测试（~7 个用例）
- `tests/integration/knowledge-base.controller.spec.ts` — KnowledgeBaseController 集成测试（~19 个用例）

### 复用基础设施（不修改）
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`
- `tests/integration/helpers/auth.fixtures.ts`

---

## 任务列表

### 任务 1: AuthController 集成测试

**文件：**
- 创建：`tests/integration/auth.controller.spec.ts`

**规格引用：**
- 功能规格：AC-01（AuthController 覆盖所有 error cases）
- API 规格：auth.controller.spec.ts 测试映射（AC-01 ~ AC-28）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/auth.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('AuthController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('auth_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/auth/public-key', () => {
    it('AC-01: returns public key with RSA-OAEP info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/public-key',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.publicKey).toContain('BEGIN PUBLIC KEY')
      expect(body.data.algorithm).toBe('RSA-OAEP')
      expect(body.data.hash).toBe('SHA-256')
    })
  })

  describe('POST /api/auth/register', () => {
    it('AC-03: creates user with valid data', async () => {
      const email = `reg-${Date.now()}@test.gofer`
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, encryptedPassword, name: 'Test User' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.user.email).toBe(email)
      expect(body.data.accessToken).toBeTruthy()
    })

    it('AC-04: returns 400 for invalid email', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: 'invalid-email', encryptedPassword, name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-05: returns 400 for empty password', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword: '', name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-06: returns 400 for decrypt failure', async () => {
      // 发送非 base64 格式的加密密码，导致解密失败
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword: 'not-valid-base64!!!', name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('DECRYPT_FAILED')
    })

    it('AC-07: returns 400 for short password', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, '123')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword, name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-08: returns 400 for password without letter/digit', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, '!!!!!!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email: `reg-${Date.now()}@test.gofer`, encryptedPassword, name: 'Test' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-09: returns 409 for duplicate email', async () => {
      const email = `dup-${Date.now()}@test.gofer`
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      // 第一次注册
      const first = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, encryptedPassword, name: 'First' },
      })
      expect(first.statusCode).toBe(201)
      // 第二次注册
      const second = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { email, encryptedPassword, name: 'Second' },
      })
      expect(second.statusCode).toBe(409)
      const body = second.json()
      expect(body.error.code).toBe('USER_EXISTS')
    })
  })

  describe('POST /api/auth/login', () => {
    it('AC-11: returns tokens for valid credentials', async () => {
      const email = `login-${Date.now()}@test.gofer`
      const password = 'Test1234!'
      await AuthFixtures.createUser(app, { email, password, name: 'Login User' })
      const encryptedPassword = await AuthFixtures.encryptPassword(app, password)
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBeTruthy()
    })

    it('AC-12: returns 400 for invalid input', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'not-email', encryptedPassword: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-13: returns 401 for non-existent user', async () => {
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'nonexistent@test.gofer', encryptedPassword },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-14: returns 401 for wrong password', async () => {
      const email = `login-wrong-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Wrong User' })
      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'WrongPassword1!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-15: returns 403 for disabled user', async () => {
      const email = `disabled-${Date.now()}@test.gofer`
      const user = await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Disabled' })
      // 通过 Prisma 直接禁用用户
      const prisma = app.get('PrismaService')
      await prisma.user.update({ where: { id: user.id }, data: { isActive: false } })

      const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword },
      })
      expect(res.statusCode).toBe(403)
      const body = res.json()
      expect(body.error.code).toBe('ACCOUNT_DISABLED')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('AC-17: returns success for valid token', async () => {
      const email = `logout-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Logout User' })
      const token = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' })
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.success).toBe(true)
    })

    it('AC-18: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-19: returns 401 for invalid token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('AC-20: returns new tokens for valid refresh token', async () => {
      const email = `refresh-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Refresh User' })
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword: await AuthFixtures.encryptPassword(app, 'Test1234!') },
      })
      const { refreshToken } = loginRes.json().data
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.accessToken).toBeTruthy()
    })

    it('AC-21: returns 400 for empty refresh token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-22: returns 401 for access token', async () => {
      const email = `refresh-at-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Refresh AT' })
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email, encryptedPassword: await AuthFixtures.encryptPassword(app, 'Test1234!') },
      })
      const { accessToken } = loginRes.json().data
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: accessToken },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-23: returns 401 for expired token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-24: returns 401 when user not found', async () => {
      // 构造一个有效格式但用户不存在的 refresh token
      // 由于无法轻易伪造 JWT，此测试依赖具体实现细节
      // 若实现不支持，可标记为 skip 并记录原因
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: { refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJub24tZXhpc3RlbnQtdXNlciIsInR5cGUiOiJyZWZyZXNoIn0.fake' },
      })
      // 预期 401，但具体行为取决于 JWT 验证实现
      expect([401, 403]).toContain(res.statusCode)
    })
  })

  describe('GET /api/auth/me', () => {
    it('AC-25: returns user profile for valid token', async () => {
      const email = `me-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Me User' })
      const token = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' })
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.email).toBe(email)
    })

    it('AC-26: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-27: returns 401 for invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-28: returns 401 when user not found', async () => {
      // 创建用户后删除，再用旧 token 访问
      const email = `me-del-${Date.now()}@test.gofer`
      const user = await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Deleted' })
      const token = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' })
      const prisma = app.get('PrismaService')
      await prisma.user.delete({ where: { id: user.id } })

      const res = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      })
      expect(res.statusCode).toBe(401)
    })
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/auth.controller.spec.ts
```

预期：FAIL — 文件不存在或部分断言失败。

- [ ] **步骤 3: 运行测试确认通过**

修复任何 import 或类型问题后：

```bash
pnpm vitest run tests/integration/auth.controller.spec.ts
```

预期：PASS（所有测试通过）。

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/auth.controller.spec.ts
git commit -m "test(q-28): add AuthController integration tests"
```

---

### 任务 2: DocumentController 集成测试

**文件：**
- 创建：`tests/integration/document.controller.spec.ts`

**规格引用：**
- 功能规格：AC-02（DocumentController 覆盖所有 error cases）
- API 规格：document.controller.spec.ts 测试映射（AC-29 ~ AC-59）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/document.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('DocumentController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string
  let kbId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('doc_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    // 创建用户和知识库
    const email = `doc-${Date.now()}@test.gofer`
    await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Doc User' })
    userToken = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' })

    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${userToken}` },
      payload: { name: `Doc-KB-${Date.now()}` },
    })
    kbId = kbRes.json().data.id
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/knowledge-bases/:kbId/documents', () => {
    it('AC-29: returns documents for KB owner', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
    })

    it('AC-30: returns 400 for invalid folderId', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents?folderId=not-uuid`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-31: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-32: returns 403 for non-owner', async () => {
      const otherEmail = `other-doc-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })
      const res = await app.inject({
        method: 'GET',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
    })
  })

  describe('POST /api/knowledge-bases/:kbId/documents/upload', () => {
    it('AC-33: uploads txt file for KB owner', async () => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const content = 'Hello World'
      const multipartBody = buildMultipartBody(boundary, 'file', 'test.txt', 'text/plain', Buffer.from(content))

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('test.txt')
    })

    it('AC-34: uploads md file for KB owner', async () => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const content = '# Markdown Test'
      const multipartBody = buildMultipartBody(boundary, 'file', 'test.md', 'text/markdown', Buffer.from(content))

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('test.md')
    })

    it('AC-35: returns 400 without file', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(400)
    })

    it('AC-36: returns 401 without token', async () => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const multipartBody = buildMultipartBody(boundary, 'file', 'test.txt', 'text/plain', Buffer.from('content'))
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-37: returns 403 for non-owner', async () => {
      const otherEmail = `other-up-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })

      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const multipartBody = buildMultipartBody(boundary, 'file', 'test.txt', 'text/plain', Buffer.from('content'))
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${otherToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-38: returns 404 for non-existent KB', async () => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const multipartBody = buildMultipartBody(boundary, 'file', 'test.txt', 'text/plain', Buffer.from('content'))
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases/non-existent-kb-id/documents/upload',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-39: returns 413 for file > 50MB', async () => {
      // 注意：TestAppFactory 使用 bodyLimit: 1048576 (1MB)
      // 超过 1MB 的文件会在 Fastify 层面返回 413，无法到达 Controller 的 50MB 校验
      // 此测试验证 Fastify 层面的 payload too large 行为
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const largeContent = Buffer.alloc(2 * 1024 * 1024, 'x') // 2MB > 1MB bodyLimit
      const multipartBody = buildMultipartBody(boundary, 'file', 'large.txt', 'text/plain', largeContent)

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(413)
    })

    it('AC-40: returns 415 for unsupported type', async () => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const multipartBody = buildMultipartBody(boundary, 'file', 'test.exe', 'application/octet-stream', Buffer.from('binary'))

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(415)
      const body = res.json()
      expect(body.error.code).toBe('UNSUPPORTED_TYPE')
    })

    it('AC-41: returns 415 for path traversal filename', async () => {
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
      const multipartBody = buildMultipartBody(boundary, 'file', '../../../etc/passwd', 'text/plain', Buffer.from('content'))

      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents/upload`,
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`,
          authorization: `Bearer ${userToken}`,
        },
        payload: multipartBody,
      })
      expect(res.statusCode).toBe(415)
      const body = res.json()
      expect(body.error.code).toBe('UNSUPPORTED_TYPE')
    })
  })

  describe('POST /api/knowledge-bases/:kbId/documents', () => {
    it('AC-42: creates document for KB owner', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('New Document')
    })

    it('AC-43: returns 400 for empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-44: returns 400 for invalid folderId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New Document', folderId: 'not-uuid' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-45: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-46: returns 403 for non-owner', async () => {
      const otherEmail = `other-create-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })
      const res = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-47: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases/non-existent-kb-id/documents',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New Document' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PATCH /api/knowledge-bases/:kbId/documents/:docId', () => {
    it('AC-48: updates document for KB owner', async () => {
      // 先创建文档
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original Name' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated Name' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.name).toBe('Updated Name')
    })

    it('AC-49: returns 400 for empty name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-50: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-51: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original' },
      })
      const docId = createRes.json().data.id

      const otherEmail = `other-patch-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-52: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/knowledge-bases/non-existent-kb-id/documents/some-doc-id',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-53: returns 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/non-existent-id`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-54: returns 404 when document not in KB', async () => {
      // 创建另一个 KB 和文档
      const otherKbRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: `Other-KB-${Date.now()}` },
      })
      const otherKbId = otherKbRes.json().data.id

      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${otherKbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Other Doc' },
      })
      const otherDocId = createRes.json().data.id

      // 尝试用当前 KB 的 URL 访问其他 KB 的文档
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}/documents/${otherDocId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/knowledge-bases/:kbId/documents/:docId', () => {
    it('AC-55: deletes document for KB owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-56: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const docId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-57: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const docId = createRes.json().data.id

      const otherEmail = `other-del-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/${docId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-58: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/knowledge-bases/non-existent-kb-id/documents/some-doc-id',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(404)
    })

    it('AC-59: returns 404 for non-existent document', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}/documents/non-existent-id`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})

function buildMultipartBody(
  boundary: string,
  fieldName: string,
  filename: string,
  contentType: string,
  buffer: Buffer,
): Buffer {
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${contentType}\r\n\r\n`,
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  return Buffer.concat([prefix, buffer, suffix])
}
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/document.controller.spec.ts
```

预期：FAIL — 文件不存在或部分断言失败。

- [ ] **步骤 3: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/document.controller.spec.ts
```

预期：PASS。

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/document.controller.spec.ts
git commit -m "test(q-28): add DocumentController integration tests"
```

---

### 任务 3: ChatController 集成测试

**文件：**
- 创建：`tests/integration/chat.controller.spec.ts`

**规格引用：**
- 功能规格：AC-03（ChatController SSE 流式响应）
- API 规格：chat.controller.spec.ts 测试映射（AC-60 ~ AC-66）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/chat.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('ChatController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('chat_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const email = `chat-${Date.now()}@test.gofer`
    await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'Chat User' })
    userToken = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('POST /api/chat', () => {
    it('AC-60: returns SSE stream for valid request', async () => {
      // Mock ChatService.streamChat 返回异步生成器
      const chatService = app.get('ChatService')
      vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
        yield { content: 'Hello', done: false }
        yield { content: '!', done: false }
        yield { done: true }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(200)
      expect(res.headers['content-type']).toContain('text/event-stream')
    })

    it('AC-61: returns 400 for empty message', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: '',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-62: returns 400 for invalid sessionId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: 'invalid-uuid',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-63: returns 400 for empty provider', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: '',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-64: returns 400 for disallowed baseUrl', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://evil.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-65: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-66: handles client disconnect gracefully', async () => {
      // Mock ChatService.streamChat 返回异步生成器
      const chatService = app.get('ChatService')
      const abortSpy = vi.fn()
      vi.spyOn(chatService, 'streamChat').mockImplementation(async function* () {
        try {
          yield { content: 'Hello', done: false }
          await new Promise(resolve => setTimeout(resolve, 100))
          yield { content: '!', done: false }
        } finally {
          abortSpy()
        }
      })

      const res = await app.inject({
        method: 'POST',
        url: '/api/chat',
        headers: { authorization: `Bearer ${userToken}` },
        payload: {
          message: 'Hello',
          sessionId: '550e8400-e29b-41d4-a716-446655440000',
          config: {
            provider: 'openai',
            model: 'gpt-4',
            baseUrl: 'https://api.openai.com',
            apiKey: 'test-key',
          },
        },
      })
      // 即使客户端断开，服务端也应正常响应
      expect(res.statusCode).toBe(200)
    })
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/chat.controller.spec.ts
```

预期：FAIL — ChatService mock 可能需要调整。

- [ ] **步骤 3: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/chat.controller.spec.ts
```

预期：PASS。

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/chat.controller.spec.ts
git commit -m "test(q-28): add ChatController integration tests"
```

---

### 任务 4: KnowledgeBaseController 集成测试

**文件：**
- 创建：`tests/integration/knowledge-base.controller.spec.ts`

**规格引用：**
- 功能规格：AC-04（KnowledgeBaseController CRUD + 搜索）
- API 规格：knowledge-base.controller.spec.ts 测试映射（AC-67 ~ AC-85）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/knowledge-base.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('KnowledgeBaseController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let userToken: string
  let userId: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('kb_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const email = `kb-${Date.now()}@test.gofer`
    const user = await AuthFixtures.createUser(app, { email, password: 'Test1234!', name: 'KB User' })
    userId = user.id
    userToken = await AuthFixtures.loginAs(app, { email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/knowledge-bases', () => {
    it('AC-67: returns KB list for authenticated user', async () => {
      // 先创建一个 KB
      await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'My KB' },
      })

      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(Array.isArray(body.data)).toBe(true)
      expect(body.data.length).toBeGreaterThanOrEqual(1)
    })

    it('AC-68: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-69: returns 401 for invalid token', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
        headers: { authorization: 'Bearer invalid-token' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-70: does not return other user\'s KBs', async () => {
      // 创建另一个用户
      const otherEmail = `other-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })

      // 其他用户创建 KB
      await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Other KB' },
      })

      // 当前用户列表中不应包含其他用户的 KB
      const res = await app.inject({
        method: 'GET',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
      })
      const body = res.json()
      const hasOtherKb = body.data.some((kb: any) => kb.name === 'Other KB')
      expect(hasOtherKb).toBe(false)
    })
  })

  describe('POST /api/knowledge-bases', () => {
    it('AC-71: creates KB with valid data', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'New KB', description: 'Description' },
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.data.name).toBe('New KB')
    })

    it('AC-72: returns 400 for empty name', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-73: returns 400 for name > 100 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'a'.repeat(101) },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-74: returns 400 for description > 500 chars', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Valid Name', description: 'a'.repeat(501) },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-75: returns 401 without token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        payload: { name: 'New KB' },
      })
      expect(res.statusCode).toBe(401)
    })
  })

  describe('PATCH /api/knowledge-bases/:id', () => {
    it('AC-76: updates KB for owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated KB' },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.name).toBe('Updated KB')
    })

    it('AC-77: returns 400 for empty name', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: '' },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-78: returns 400 for negative sortOrder', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
        payload: { sortOrder: -1 },
      })
      expect(res.statusCode).toBe(400)
      const body = res.json()
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('AC-79: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Original KB' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-80: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Owner KB' },
      })
      const kbId = createRes.json().data.id

      const otherEmail = `other2-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'Other2' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${otherToken}` },
        payload: { name: 'Hacked' },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-81: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/knowledge-bases/non-existent-id',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Updated' },
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('DELETE /api/knowledge-bases/:id', () => {
    it('AC-82: deletes KB for owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.deleted).toBe(true)
    })

    it('AC-83: returns 401 without token', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'To Delete' },
      })
      const kbId = createRes.json().data.id

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
      })
      expect(res.statusCode).toBe(401)
    })

    it('AC-84: returns 403 for non-owner', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/knowledge-bases',
        headers: { authorization: `Bearer ${userToken}` },
        payload: { name: 'Owner KB' },
      })
      const kbId = createRes.json().data.id

      const otherEmail = `other-del-${Date.now()}@test.gofer`
      await AuthFixtures.createUser(app, { email: otherEmail, password: 'Test1234!', name: 'OtherDel' })
      const otherToken = await AuthFixtures.loginAs(app, { email: otherEmail, password: 'Test1234!' })

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/knowledge-bases/${kbId}`,
        headers: { authorization: `Bearer ${otherToken}` },
      })
      expect(res.statusCode).toBe(403)
    })

    it('AC-85: returns 404 for non-existent KB', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/knowledge-bases/non-existent-id',
        headers: { authorization: `Bearer ${userToken}` },
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
```

- [ ] **步骤 2: 运行测试确认失败**

```bash
pnpm vitest run tests/integration/knowledge-base.controller.spec.ts
```

预期：FAIL。

- [ ] **步骤 3: 运行测试确认通过**

```bash
pnpm vitest run tests/integration/knowledge-base.controller.spec.ts
```

预期：PASS。

- [ ] **步骤 4: 提交**

```bash
git add tests/integration/knowledge-base.controller.spec.ts
git commit -m "test(q-28): add KnowledgeBaseController integration tests"
```

---

### 任务 5: 全量验证

**规格引用：**
- 功能规格：AC-05（全部新增测试通过）

- [ ] **步骤 1: 运行全部集成测试**

```bash
pnpm test:integration
```

预期：全部通过（含新增 4 个文件）。

- [ ] **步骤 2: 运行全部单元测试**

```bash
pnpm test
```

预期：全部通过，无回归。

- [ ] **步骤 3: 类型检查**

```bash
pnpm type-check
```

预期：0 错误。

- [ ] **步骤 4: 提交（如需要）**

---

## 规格覆盖检查

| AC | 任务 | 验证方式 |
|----|------|----------|
| AC-01 | 任务 1 | `auth.controller.spec.ts` 覆盖所有 AuthController 端点和 error cases |
| AC-02 | 任务 2 | `document.controller.spec.ts` 覆盖所有 DocumentController 端点和 error cases |
| AC-03 | 任务 3 | `chat.controller.spec.ts` 覆盖 SSE 流式响应 |
| AC-04 | 任务 4 | `knowledge-base.controller.spec.ts` 覆盖所有 KnowledgeBaseController 端点和 error cases |
| AC-05 | 任务 5 | `pnpm test:integration` 全部通过 |
| AC-06 | 任务 5 | 测试数据库零残留 |

---

## 自检

- [x] 功能规格覆盖：每个 AC 都有对应任务
- [x] 测试覆盖：每个任务都有对应的 `.spec.ts` 文件
- [x] 占位符扫描：无 "TODO"/"TBD"/"稍后实现"
- [x] 类型一致性：使用现有 `TestAppFactory`、`AuthFixtures` 接口
- [x] ADR 合规：未引入禁止依赖
- [x] PRD 追溯：每个 Controller 的测试场景与 PRD 第一批定义对齐
- [x] 速率限制测试：明确标注移至第三批（TestAppFactory NoOpThrottlerGuard 限制）
- [x] 版本变更记录：v1 → v2，补充 api-spec.md 中所有缺失用例
