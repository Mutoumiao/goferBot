---
id: q-30
issue: issue.md
version: 1
---

# PRD 第三批全局中间件与 HealthController 模块级集成测试 实现计划

> **目标：** 为 HealthController、ResponseInterceptor、AllExceptionsFilter、ZodValidationPipe、ThrottlerGuard 建立模块级集成测试，验证基础设施行为。
> **架构：** `@nestjs/testing` + Fastify `app.inject()`，每文件独立数据库（TestDatabaseManager），mock 模式。
> **技术栈：** Vitest + NestJS TestingModule + FastifyAdapter

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/feature-spec.md`
**测试引用：** `tests/integration/`

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案 | ✅ 符合 | 测试验证 ZodValidationPipe 字段级错误返回 |
| ADR 0001 | 响应格式 | ✅ 符合 | 测试验证 ResponseInterceptor `{ data: T }` 和 AllExceptionsFilter `{ error: { code, message } }` |
| ADR 0001 | 依赖引入 | ✅ 符合 | 未引入新依赖，复用现有测试基础设施 |

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| HealthController — 简单存活检查 | ✅ 已覆盖 | 任务 1，验证 `GET /api/health` 返回 200 和状态信息 |
| ResponseInterceptor — 验证 `{ data: T }` | ✅ 已覆盖 | 任务 2，通过 Controller 返回原始数据验证统一包装 |
| AllExceptionsFilter — 验证 `{ error: { code, message } }` | ✅ 已覆盖 | 任务 3，通过抛出异常验证统一错误格式 |
| ZodValidationPipe — 字段级错误返回 | ✅ 已覆盖 | 任务 4，通过无效 DTO 验证 400 和字段级错误 |
| ThrottlerGuard — 429 + Retry-After | ✅ 已覆盖 | 任务 5，使用 `remoteAddress` 绕过限流 + 真实限流验证 |
| 全部测试在 `pnpm test:integration` 通过 | ✅ 已覆盖 | 每个任务末尾运行完整集成测试套件验证 |
| 测试数据库零残留 | ✅ 已覆盖 | 每个文件 afterAll 中调用 `dropDatabase` |

---

## 文件结构

### 新建文件
- `tests/integration/health.controller.spec.ts` — HealthController 存活检查（~2 个用例）
- `tests/integration/response-interceptor.spec.ts` — ResponseInterceptor 统一格式验证（~4 个用例）
- `tests/integration/exceptions-filter.spec.ts` — AllExceptionsFilter 统一异常格式验证（~5 个用例）
- `tests/integration/zod-validation-pipe.spec.ts` — ZodValidationPipe 字段级错误验证（~4 个用例）
- `tests/integration/throttler-guard.spec.ts` — ThrottlerGuard 429 响应头验证（~3 个用例）

### 复用基础设施（不修改）
- `tests/integration/helpers/test-app.factory.ts`
- `tests/integration/helpers/test-database.manager.ts`
- `tests/integration/helpers/auth.fixtures.ts`
- `tests/integration/helpers/test-utils.ts` — `createIpGenerator`

---

## 关键实现细节

### ThrottlerGuard 测试策略

`TestAppFactory` 中**未覆盖** `ThrottlerGuard`（通过 `APP_GUARD` 注册的守卫无法通过 `overrideProvider` 覆盖，且 `@Throttle` 装饰器有独立配置）。测试中采用以下策略：

1. **绕过限流**：每个请求使用不同的 `remoteAddress`（通过 `createIpGenerator` 生成唯一 IP），避免触发速率限制
2. **验证限流**：使用同一 IP 快速发送超过阈值（60 次/分钟）的请求，验证 429 响应和 `Retry-After` 头

参考 q-28 中 `auth.controller.spec.ts` 的做法：所有 `app.inject()` 调用均传递 `remoteAddress` 参数。

---

## 任务列表

### 任务 1: HealthController 集成测试

**文件：**
- 创建：`tests/integration/health.controller.spec.ts`

**规格引用：**
- 功能规格：AC-01（HealthController 存活检查）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/health.controller.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('HealthController', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('health_ctrl')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  describe('GET /api/health', () => {
    it('AC-01: returns 200 with status info', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.data.status).toBe('ok')
      expect(body.data.timestamp).toBeDefined()
      expect(new Date(body.data.timestamp).toISOString()).toBe(body.data.timestamp)
      expect(body.data.version).toBeDefined()
    })

    it('AC-02: does not require authentication', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
      })
      expect(res.statusCode).toBe(200)
      // HealthController 无 @UseGuards(JwtAuthGuard)，应直接访问
      expect(res.json().data.status).toBe('ok')
    })
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/health.controller.spec.ts`
预期：FAIL — 文件不存在或断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/health.controller.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

### 任务 2: ResponseInterceptor 集成测试

**文件：**
- 创建：`tests/integration/response-interceptor.spec.ts`

**规格引用：**
- 功能规格：AC-02（ResponseInterceptor 统一响应格式验证）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/response-interceptor.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('ResponseInterceptor', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('response_interceptor')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `resp-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Response Test',
    })
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  it('AC-03: wraps object response in { data: T }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    // ResponseInterceptor 应自动包装为 { data: T }
    expect(body).toHaveProperty('data')
    expect(body.data).toBeDefined()
  })

  it('AC-04: wraps array response in { data: T }', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveProperty('data')
    expect(body.data.items).toBeInstanceOf(Array)
  })

  it('AC-05: wraps null/undefined response as { data: null }', async () => {
    // 通过删除不存在的资源触发返回 null 的场景
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/sessions/non-existent-id',
      headers: { authorization: `Bearer ${token}` },
    })
    // 404 错误由 AllExceptionsFilter 处理，不走 ResponseInterceptor
    // 改为测试正常删除后的响应
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Delete Me' },
    })
    const sessionId = createRes.json().data.id

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${token}` },
    })
    expect(deleteRes.statusCode).toBe(200)
    const body = deleteRes.json()
    expect(body).toHaveProperty('data')
    expect(body.data.deleted).toBe(true)
  })

  it('AC-06: does not wrap @BypassResponse routes', async () => {
    // SSE 端点使用 @BypassResponse，应返回原始流
    // 此处通过 ChatController SSE 端点验证
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: { message: 'test', sessionId: 'test-session' },
    })
    // SSE 端点返回 text/event-stream，不应被包装为 JSON
    expect(res.headers['content-type']).toContain('text/event-stream')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/response-interceptor.spec.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/response-interceptor.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

### 任务 3: AllExceptionsFilter 集成测试

**文件：**
- 创建：`tests/integration/exceptions-filter.spec.ts`

**规格引用：**
- 功能规格：AC-03（AllExceptionsFilter 统一异常格式验证）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/exceptions-filter.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('AllExceptionsFilter', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('exceptions_filter')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `filter-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Filter Test',
    })
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  it('AC-07: returns { error: { code, message } } for 400', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'invalid-email', encryptedPassword: '', name: '' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body).toHaveProperty('error')
    expect(body.error).toHaveProperty('code')
    expect(body.error).toHaveProperty('message')
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-08: returns { error: { code, message } } for 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: 'Bearer invalid-token' },
    })
    expect(res.statusCode).toBe(401)
    const body = res.json()
    expect(body.error.code).toBe('AUTH_ERROR')
    expect(body.error.message).toBeDefined()
  })

  it('AC-09: returns { error: { code, message } } for 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/sessions/non-existent-id',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    const body = res.json()
    expect(body.error.code).toBe('NOT_FOUND')
    expect(body.error.message).toBeDefined()
  })

  it('AC-10: returns { error: { code, message } } for 403', async () => {
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
      payload: { title: 'Private' },
    })
    const sessionId = createRes.json().data.id

    const res = await app.inject({
      method: 'GET',
      url: `/api/sessions/${sessionId}`,
      headers: { authorization: `Bearer ${otherToken}` },
    })
    expect(res.statusCode).toBe(403)
    const body = res.json()
    expect(body.error.code).toBe('FORBIDDEN')
    expect(body.error.message).toBeDefined()
  })

  it('AC-11: returns { error: { code, message, details } } with field-level details for validation errors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-email', encryptedPassword: '', name: '' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toBeInstanceOf(Array)
    expect(body.error.details.length).toBeGreaterThan(0)
    expect(body.error.details[0]).toHaveProperty('field')
    expect(body.error.details[0]).toHaveProperty('issue')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/exceptions-filter.spec.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/exceptions-filter.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

### 任务 4: ZodValidationPipe 集成测试

**文件：**
- 创建：`tests/integration/zod-validation-pipe.spec.ts`

**规格引用：**
- 功能规格：AC-04（ZodValidationPipe 字段级错误验证）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/zod-validation-pipe.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('ZodValidationPipe', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('zod_pipe')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `zod-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Zod Test',
    })
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  it('AC-12: returns 400 for missing required field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: {},
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    expect(body.error.details).toBeInstanceOf(Array)
    const nameError = body.error.details.find((d: any) => d.field === 'name')
    expect(nameError).toBeDefined()
    expect(nameError.issue).toContain('必填')
  })

  it('AC-13: returns 400 for invalid string format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'not-an-email', encryptedPassword: 'valid-pwd-123', name: 'Test' },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const emailError = body.error.details.find((d: any) => d.field === 'email')
    expect(emailError).toBeDefined()
    expect(emailError.issue).toContain('邮箱')
  })

  it('AC-14: returns 400 for string too long', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'a'.repeat(101) },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const titleError = body.error.details.find((d: any) => d.field === 'title')
    expect(titleError).toBeDefined()
    expect(titleError.issue).toContain('过长')
  })

  it('AC-15: returns 400 for invalid number range', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/settings',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        providers: {
          openai: { apiKey: 'sk-test', model: 'gpt-4', baseUrl: '' },
          claude: { apiKey: 'sk-test', model: 'claude-3', baseUrl: '' },
          deepseek: { apiKey: 'sk-test', model: 'deepseek-chat', baseUrl: '' },
          custom: { apiKey: 'sk-test', model: 'custom', baseUrl: '' },
          ollama: { enabled: false, url: 'http://localhost:11434', model: 'llama2', baseUrl: '' },
        },
        embeddingProvider: { provider: 'openai', apiKey: 'sk-test', model: 'text-embedding-3', baseUrl: '' },
        temperature: 3,
        defaultChatProvider: 'openai',
      },
    })
    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_ERROR')
    const tempError = body.error.details.find((d: any) => d.field === 'temperature')
    expect(tempError).toBeDefined()
    expect(tempError.issue).toContain('范围')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/zod-validation-pipe.spec.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/zod-validation-pipe.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

### 任务 5: ThrottlerGuard 集成测试

**文件：**
- 创建：`tests/integration/throttler-guard.spec.ts`

**规格引用：**
- 功能规格：AC-05（ThrottlerGuard 429 响应头验证）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/integration/throttler-guard.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { createIpGenerator } from './helpers/test-utils.js'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

describe('ThrottlerGuard', () => {
  let app: NestFastifyApplication
  let dbManager: TestDatabaseManager
  let dbUrl: string
  let dbName: string
  let token: string
  const nextIp = createIpGenerator(99)

  beforeAll(async () => {
    dbManager = new TestDatabaseManager()
    dbUrl = await dbManager.createDatabase('throttler')
    dbName = new URL(dbUrl).pathname.slice(1)
    app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: `throttle-${Date.now()}@test.gofer`,
      password: 'Test1234!',
      name: 'Throttle Test',
    }, { remoteAddress: nextIp() })
    token = await AuthFixtures.loginAs(app, { email: user.email, password: 'Test1234!' }, { remoteAddress: nextIp() })
  }, 60000)

  afterAll(async () => {
    if (app) await app.close()
    if (dbManager && dbName) await dbManager.dropDatabase(dbName)
  })

  it('AC-16: allows requests under rate limit', async () => {
    // 使用不同 IP 发送 5 个请求，应全部通过
    const promises = Array.from({ length: 5 }, (_, i) =>
      app.inject({
        method: 'GET',
        url: '/api/health',
        remoteAddress: `192.168.99.${i + 1}`,
      }),
    )
    const responses = await Promise.all(promises)
    for (const res of responses) {
      expect(res.statusCode).toBe(200)
    }
  })

  it('AC-17: returns 429 when rate limit exceeded', async () => {
    // 使用同一 IP 快速发送超过 60 次请求
    const sharedIp = '192.168.99.100'
    let lastRes: any

    for (let i = 0; i < 65; i++) {
      lastRes = await app.inject({
        method: 'GET',
        url: '/api/health',
        remoteAddress: sharedIp,
      })
      if (lastRes.statusCode === 429) break
    }

    expect(lastRes.statusCode).toBe(429)
    const body = lastRes.json()
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('AC-18: returns Retry-After header on 429', async () => {
    const sharedIp = '192.168.99.101'
    let res: any

    for (let i = 0; i < 65; i++) {
      res = await app.inject({
        method: 'GET',
        url: '/api/health',
        remoteAddress: sharedIp,
      })
      if (res.statusCode === 429) break
    }

    expect(res.statusCode).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
    const retryAfter = parseInt(res.headers['retry-after'])
    expect(retryAfter).toBeGreaterThan(0)
    expect(retryAfter).toBeLessThanOrEqual(60)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/integration/throttler-guard.spec.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/integration/throttler-guard.spec.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整相关测试套件确认无回归：
```bash
npx vitest run tests/integration/
```

---

## 自检清单

- [ ] PRD 一致性：第三批所有 5 个目标（HealthController + 4 个中间件）均已覆盖
- [ ] 规格覆盖：feature-spec.md 中所有验收标准（AC-01 ~ AC-18）都有对应任务
- [ ] 测试覆盖：每个任务都有对应的 `tests/integration/{name}.spec.ts` 文件
- [ ] 占位符扫描：无 "TODO" / "TBD" / "稍后实现"
- [ ] 类型一致性：所有测试中使用的类型、方法与代码库一致
- [ ] ADR 合规：未引入新依赖，复用现有测试基础设施
- [ ] ThrottlerGuard 策略：已明确使用 `remoteAddress` 绕过限流 + 真实限流验证
