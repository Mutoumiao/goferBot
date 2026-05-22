---
id: b-02
issue: issue.md
version: 1
---

# AuthController 测试实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 AuthController 编写模块级集成测试和 HTTP E2E 测试，覆盖 6 个端点 + 完整链路。

**架构：** 模块级测试使用 `Test.createTestingModule` + 真实 PostgreSQL 数据库（通过 TestDatabaseManager 动态创建）。E2E 测试使用 `TestAppFactory` 创建完整 NestJS 应用实例，通过 `app.inject()` 发送 HTTP 请求。`loginAs` helper 复用 i-01 的 `AuthFixtures.loginAs`，内部自动 RSA-OAEP 加密。

**技术栈：** Vitest + NestJS TestingModule + supertest（via Fastify inject）+ Prisma + PostgreSQL

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) · [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

```
tests/issues/b-02-auth-api-testing/
├── auth.controller.spec.ts    # 模块级集成测试（AC-01 ~ AC-15）
├── auth.e2e.spec.ts           # HTTP E2E 完整链路测试（AC-16）
```

复用基础设施（不修改）：
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`
- `tests/integration/helpers/auth.fixtures.ts`

---

## 任务 1: 编写模块级集成测试骨架（AC-01 ~ AC-06）

**文件：**
- 创建：`tests/issues/b-02-auth-api-testing/auth.controller.spec.ts`

**规格引用：**
- API 规格：[GET /api/auth/public-key] · [POST /api/auth/register]

- [ ] **步骤 0: 创建测试目录**

```bash
mkdir -p tests/issues/b-02-auth-api-testing
```

- [ ] **步骤 1: 编写测试**

> 注：AuthController 已实现，测试会直接通过（green）。这是**为已有代码补测试**的场景，TDD 严格 red-green 不适用。验证通过即确认测试代码正确。

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'

describe('AuthController integration', () => {
  const dbManager = new TestDatabaseManager()
  let dbUrl: string
  let app: Awaited<ReturnType<typeof TestAppFactory.create>>

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase('authctrl')
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-01: GET /api/auth/public-key returns RSA public key', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/public-key' })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.publicKey).toMatch(/^-----BEGIN PUBLIC KEY-----/)
    expect(data.algorithm).toBe('RSA-OAEP')
    expect(data.hash).toBe('SHA-256')
  })

  it('AC-02: POST /api/auth/register creates user and returns tokens', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac02@example.com', encryptedPassword, name: 'AC02' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json()
    const data = body.data ?? body
    expect(data.user.email).toBe('test-ac02@example.com')
    expect(data.user.name).toBe('AC02')
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
    expect(data.accessToken.split('.')).toHaveLength(3)
  })

  it('AC-03: POST /api/auth/register returns 400 for invalid email', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', encryptedPassword },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-04: POST /api/auth/register returns 400 for decrypt failure', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac04@example.com', encryptedPassword: 'invalid-base64!!!' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('DECRYPT_FAILED')
  })

  it('AC-05: POST /api/auth/register returns 400 for weak password', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, '123')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac05@example.com', encryptedPassword },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-06: POST /api/auth/register returns 409 for duplicate email', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac06@example.com', encryptedPassword },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'test-ac06@example.com', encryptedPassword },
    })
    expect(res.statusCode).toBe(409)
    const body = res.json()
    expect(body.error.code).toBe('USER_EXISTS')
  })
})
```

- [ ] **步骤 2: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-02-auth-api-testing/auth.controller.spec.ts`
预期：PASS — 所有测试通过（因实现已存在）。若失败，检查错误码是否与 api-spec 一致。

- [ ] **步骤 3: 审查测试结果**

确认 AC-06 返回 409 `USER_EXISTS`、AC-05 返回 400 `VALIDATION_ERROR`。若码不一致，回查 spec 审查修正记录。

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-02-auth-api-testing/auth.controller.spec.ts
git commit -m "test(b-02): add auth controller integration tests AC-01~AC-06"
```

---

## 任务 2: 补充模块级集成测试（AC-07 ~ AC-11）

**文件：**
- 修改：`tests/issues/b-02-auth-api-testing/auth.controller.spec.ts`

**规格引用：**
- API 规格：[POST /api/auth/login] · [POST /api/auth/refresh]

- [ ] **步骤 1: 编写失败测试**

在 `auth.controller.spec.ts` 同一 `describe` 块内追加：

```typescript
  it('AC-07: POST /api/auth/login returns tokens for valid credentials', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac07@example.com', password: 'Test1234!', name: 'AC07' })
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test-ac07@example.com', encryptedPassword },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.user.email).toBe('test-ac07@example.com')
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
  })

  it('AC-08: POST /api/auth/login returns 400 for invalid input', async () => {
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'bad-email', encryptedPassword },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-09: POST /api/auth/login returns 404 for wrong password', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac09@example.com', password: 'Test1234!', name: 'AC09' })
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'WrongPass1!')
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test-ac09@example.com', encryptedPassword },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_FAIL')
  })

  it('AC-10: POST /api/auth/refresh returns new token pair', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac10@example.com', password: 'Test1234!', name: 'AC10' })
    const encryptedPassword = await AuthFixtures.encryptPassword(app, 'Test1234!')
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'test-ac10@example.com', encryptedPassword },
    })
    const { refreshToken } = (loginRes.json().data ?? loginRes.json())

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(typeof data.accessToken).toBe('string')
    expect(typeof data.refreshToken).toBe('string')
    expect(data.accessToken).not.toBe(refreshToken)
  })

  it('AC-11: POST /api/auth/refresh returns 401 for invalid token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken: 'totally.invalid.token' },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('INVALID_REFRESH_TOKEN')
  })
```

- [ ] **步骤 2: 运行测试验证**

运行：`npx vitest run tests/issues/b-02-auth-api-testing/auth.controller.spec.ts`
预期：PASS（AC-07~AC-11 全部通过）

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-02-auth-api-testing/auth.controller.spec.ts
git commit -m "test(b-02): add auth controller integration tests AC-07~AC-11"
```

---

## 任务 3: 补充模块级集成测试（AC-12 ~ AC-15）

**文件：**
- 修改：`tests/issues/b-02-auth-api-testing/auth.controller.spec.ts`

**规格引用：**
- API 规格：[POST /api/auth/logout] · [GET /api/auth/me]

- [ ] **步骤 1: 编写失败测试**

在 `auth.controller.spec.ts` 同一 `describe` 块内追加：

```typescript
  it('AC-12: POST /api/auth/logout returns success with valid token', async () => {
    const accessToken = await AuthFixtures.loginAs(app, { email: 'test-ac12@example.com', password: 'Test1234!' })
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.success).toBe(true)
  })

  it('AC-13: POST /api/auth/logout returns 401 without token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_ERROR')
  })

  it('AC-14: GET /api/auth/me returns current user', async () => {
    await AuthFixtures.createUser(app, { email: 'test-ac14@example.com', password: 'Test1234!', name: 'AC14' })
    const accessToken = await AuthFixtures.loginAs(app, { email: 'test-ac14@example.com', password: 'Test1234!' })
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    const data = body.data ?? body
    expect(data.email).toBe('test-ac14@example.com')
    expect(data.name).toBe('AC14')
  })

  it('AC-15: GET /api/auth/me returns 401 for invalid token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid.token.here' },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_ERROR')
  })
```

- [ ] **步骤 2: 运行测试验证**

运行：`npx vitest run tests/issues/b-02-auth-api-testing/auth.controller.spec.ts`
预期：PASS（AC-01~AC-15 全部通过）

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-02-auth-api-testing/auth.controller.spec.ts
git commit -m "test(b-02): add auth controller integration tests AC-12~AC-15"
```

---

## 任务 4: 编写 E2E 完整链路测试（AC-16）

**文件：**
- 创建：`tests/issues/b-02-auth-api-testing/auth.e2e.spec.ts`

**规格引用：**
- API 规格：[E2E 完整链路]
- Feature 规格：Auth 核心链路 HTTP E2E（注册 → 登录 → me → 刷新 → 登出）

- [ ] **步骤 1: 编写测试**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'

describe('Auth E2E flow', () => {
  const dbManager = new TestDatabaseManager()
  let dbUrl: string
  let app: Awaited<ReturnType<typeof TestAppFactory.create>>

  beforeAll(async () => {
    dbUrl = await dbManager.createDatabase('authe2e')
    app = await TestAppFactory.create(dbUrl)
  })

  afterAll(async () => {
    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-16: full auth flow (register → login → me → refresh → logout)', async () => {
    const email = 'e2e-user@example.com'
    const password = 'E2ePass123!'

    // 1. register
    const encryptedPassword = await AuthFixtures.encryptPassword(app, password)
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email, encryptedPassword, name: 'E2E User' },
    })
    expect(registerRes.statusCode).toBe(201)
    const registerData = registerRes.json().data ?? registerRes.json()
    expect(registerData.user.email).toBe(email)

    // 2. login
    const loginEncrypted = await AuthFixtures.encryptPassword(app, password)
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, encryptedPassword: loginEncrypted },
    })
    expect(loginRes.statusCode).toBe(200)
    const loginData = loginRes.json().data ?? loginRes.json()
    expect(typeof loginData.accessToken).toBe('string')
    expect(typeof loginData.refreshToken).toBe('string')
    const { accessToken, refreshToken } = loginData

    // 3. me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    })
    expect(meRes.statusCode).toBe(200)
    const meData = meRes.json().data ?? meRes.json()
    expect(meData.email).toBe(email)

    // 4. refresh
    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      payload: { refreshToken },
    })
    expect(refreshRes.statusCode).toBe(200)
    const refreshData = refreshRes.json().data ?? refreshRes.json()
    expect(typeof refreshData.accessToken).toBe('string')
    expect(typeof refreshData.refreshToken).toBe('string')

    // 5. logout
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${refreshData.accessToken}` },
    })
    expect(logoutRes.statusCode).toBe(200)
    const logoutData = logoutRes.json().data ?? logoutRes.json()
    expect(logoutData.success).toBe(true)
  })
})
```

- [ ] **步骤 2: 运行测试验证通过**

运行：`npx vitest run tests/issues/b-02-auth-api-testing/auth.e2e.spec.ts`
预期：PASS — E2E 链路完整通过

- [ ] **步骤 3: 审查测试结果**

确认 5 个步骤全部通过。若失败，检查 token 传递或端点路径。

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-02-auth-api-testing/auth.e2e.spec.ts
git commit -m "test(b-02): add auth E2E flow test AC-16"
```

---

## 任务 5: 全量测试验证与回归检查

**文件：**
- 无新增文件

- [ ] **步骤 1: 运行 b-02 全部测试**

运行：`npx vitest run tests/issues/b-02-auth-api-testing/`
预期：PASS（16 条用例全部通过）

- [ ] **步骤 2: 运行类型检查**

运行：`pnpm type-check`
预期：0 错误

- [ ] **步骤 3: 运行全部单元测试防止回归**

运行：`npx vitest run tests/issues/`
预期：b-02 + i-01 全部通过，无新增失败

- [ ] **步骤 4: 提交（如需要）**

```bash
git commit -m "test(b-02): verify all auth tests pass with no regressions"
```

---

## 自检

**1. 规格覆盖：**
- [x] GET /api/auth/public-key → 任务 1 AC-01
- [x] POST /api/auth/register (happy + 400 Zod + 400 decrypt + 400 password + 409) → 任务 1 AC-02~AC-06
- [x] POST /api/auth/login (happy + 400 + 404) → 任务 2 AC-07~AC-09
- [x] POST /api/auth/refresh (happy + 401) → 任务 2 AC-10~AC-11
- [x] POST /api/auth/logout (happy + 401) → 任务 3 AC-12~AC-13
- [x] GET /api/auth/me (happy + 401) → 任务 3 AC-14~AC-15
- [x] E2E 完整链路 → 任务 4 AC-16

**2. 占位符扫描：** 无 TBD / TODO / 稍后实现。

**3. 类型一致性：** `AuthFixtures` 方法签名与 i-01 一致；`app.inject()` 返回类型一致；错误码与 api-spec 审查后版本一致。

**4. TDD 合规：** 每个任务以编写测试开始，以运行测试验证结束。
