# 集成测试指南

> NestJS API 模块级集成测试。真实数据库 + HTTP 请求（`app.inject()`），外部 IO 全部 mock。

## 1. 核心约束

| 规则 | 说明 |
|------|------|
| **文件位置** | `tests/integration/{feature}.spec.ts` |
| **环境** | `@vitest-environment node`，使用 `forks` 池隔离进程 |
| **数据库** | 每个 `it()` 独立创建/销毁数据库（`TestDatabaseManager`） |
| **外部 IO** | BullMQ / Redis / MinIO / pgvector 默认 mock 空实现 |
| **外部 API** | 使用 `nock` 或 `vi.spyOn(fetch)` mock |
| **用例命名** | `AC-XX: {行为描述} {预期结果}` |

## 2. 核心工具

| 工具 | 路径 | 职责 |
|------|------|------|
| `TestAppFactory` | `tests/integration/helpers/test-app.factory.ts` | 创建隔离 NestJS 应用 |
| `AuthFixtures` | `tests/integration/helpers/auth.fixtures.ts` | 创建用户 / 登录获取 JWT |
| `TestDatabaseManager` | `tests/integration/helpers/test-database.manager.ts` | 动态创建/销毁隔离数据库 |
| `ExternalServiceMocker` | `tests/integration/helpers/external-service.mocker.ts` | nock 封装，mock 外部 API |

## 3. 标准模板

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'

async function setupApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('test_suite')
  const app = await TestAppFactory.create(dbUrl)
  const user = await AuthFixtures.createUser(app, { email: 'test@gofer.bot', password: 'Test1234!', name: 'Test' })
  const token = await AuthFixtures.loginAs(app, { email: 'test@gofer.bot', password: 'Test1234!' })
  return { app, dbManager, dbUrl, token, user }
}

async function teardownApp(app: NestFastifyApplication, dbManager: TestDatabaseManager, dbUrl: string) {
  await app.close()
  await dbManager.dropDatabase(new URL(dbUrl).pathname.slice(1))
}

describe('XxxController', () => {
  it('AC-01: returns 200 for valid request', async () => {
    const { app, dbManager, dbUrl, token } = await setupApp()

    const res = await app.inject({
      method: 'GET',
      url: '/api/xxx',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    await teardownApp(app, dbManager, dbUrl)
  })

  it('AC-02: returns 401 without JWT', async () => {
    const { app, dbManager, dbUrl } = await setupApp()
    const res = await app.inject({ method: 'GET', url: '/api/xxx' })
    expect(res.statusCode).toBe(401)
    await teardownApp(app, dbManager, dbUrl)
  })
})
```

### 外部 API Mock（nock）

```ts
import nock from 'nock'

beforeAll(() => {
  nock('https://api.external')
    .post('/v1/embeddings')
    .reply(200, { data: [{ embedding: [0.1, 0.2] }] })
    .persist()
})

afterAll(() => nock.cleanAll())
```

## 4. 数据库生命周期模式

**标准模式（每个 it 独立 DB）**：
```
it() → createDatabase() → migrate → 测试 → app.close() → dropDatabase()
```

**共享模式（需要 Worker 异步处理的复杂场景）**：
```
beforeAll → createDatabase → migrate → createApp
beforeEach → TRUNCATE 所有表
afterAll → app.close() → dropDatabase()
```

## 5. 运行测试

```bash
pnpm test:integration
pnpm vitest run --config vitest.integration.config.ts tests/integration/chat.controller.spec.ts
pnpm vitest run --config vitest.integration.config.ts -t "AC-03"
```

### 前置条件

```bash
export TEST_DATABASE_ADMIN_URL="postgresql://user:pass@host:5432/postgres"
pnpm infra:up                           # 启动 PostgreSQL
pnpm --filter @goferbot/server prisma:generate
```

## 6. 必备用例清单

| 场景 | HTTP 状态 | 必测 |
|------|-----------|------|
| 正常请求 | 200/201 | 是 |
| 认证错误 | 401 | 是 |
| 权限错误 | 403 | 是 |
| 资源不存在 | 404 | 是 |
| 参数校验错误 | 400 | 是 |
| 空列表/空状态 | 200 | 视情况 |
| 边界值 | 200/400 | 视情况 |

## 7. 配置要点

```ts
// vitest.integration.config.ts 关键配置
{
  resolve: {
    alias: {
      '@server': path.resolve(__dirname, './packages/server/src'),
      '@rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src'),
      '@goferbot/rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    pool: 'forks',           // 进程隔离
    testTimeout: 60000,       // 数据库创建需要时间
    setupFiles: ['./tests/setup/integration-env.ts'],
  },
}
```
