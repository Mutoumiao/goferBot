---
id: i-01
issue: issue.md
version: 1
---

# API 测试共享基础设施 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 搭建 PRD 中定义的两层 API 测试体系的共享基础设施，包括五个核心工具、vitest 配置、`.env.test`、package.json 脚本，并通过 Smoke 测试验证全部可用。

**架构：** 模块级测试使用 `@nestjs/testing` + Fastify `app.inject()`，每文件独立 CREATE/DROP PG 数据库；E2E 使用真实 NestJS 进程 + axios。五个共享辅助工具位于 `tests/integration/helpers/`。

**技术栈：** Vitest v4、NestJS 10 Testing、Fastify、Prisma、nock、pg（node-postgres）。

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/feature-spec.md](./specs/feature-spec.md) · [specs/api-spec.md](./specs/api-spec.md)

---

## 文件规划

| 职责 | 路径 | 操作 |
|------|------|------|
| 数据库管理工具 | `tests/integration/helpers/test-database.manager.ts` | 新建 |
| 存储清理工具 | `tests/integration/helpers/storage-cleaner.ts` | 新建 |
| 测试应用工厂 | `tests/integration/helpers/test-app.factory.ts` | 新建 |
| 认证 fixtures | `tests/integration/helpers/auth.fixtures.ts` | 新建 |
| 外部服务 mock | `tests/integration/helpers/external-service.mocker.ts` | 新建 |
| 环境变量 | `.env.test` | 新建 |
| 模块级测试配置 | `vitest.integration.config.ts` | 修改 |
| E2E API 测试配置 | `vitest.e2e-api.config.ts` | 新建 |
| 测试脚本 | `package.json` | 修改 |
| 数据库管理测试 | `tests/issues/i-01-testing-infra-setup/test-database.manager.spec.ts` | 新建 |
| 存储清理测试 | `tests/issues/i-01-testing-infra-setup/storage-cleaner.spec.ts` | 新建 |
| 应用工厂测试 | `tests/issues/i-01-testing-infra-setup/test-app.factory.spec.ts` | 新建 |
| 认证 fixtures 测试 | `tests/issues/i-01-testing-infra-setup/auth.fixtures.spec.ts` | 新建 |
| 外部服务 mock 测试 | `tests/issues/i-01-testing-infra-setup/external-service.mocker.spec.ts` | 新建 |
| 配置验证测试 | `tests/issues/i-01-testing-infra-setup/config.spec.ts` | 新建 |
| Smoke 集成测试 | `tests/issues/i-01-testing-infra-setup/smoke.spec.ts` | 新建 |

---

## 任务 1: TestDatabaseManager

**规格引用：** api-spec.md §1 — TestDatabaseManager

**文件：**
- 创建：`tests/integration/helpers/test-database.manager.ts`
- 测试：`tests/issues/i-01-testing-infra-setup/test-database.manager.spec.ts`

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/test-database.manager.spec.ts
import { describe, it, expect } from 'vitest'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('TestDatabaseManager', () => {
  const manager = new TestDatabaseManager()

  it('AC-01: creates and drops a test database', async () => {
    const dbUrl = await manager.createDatabase('smoke')
    expect(dbUrl).toContain('goferbot_test_smoke_')
    expect(dbUrl).toContain('postgresql://')

    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await expect(manager.dropDatabase(dbName)).resolves.toBeUndefined()
  })

  it('AC-01: migrate deploy creates expected tables', async () => {
    const dbUrl = await manager.createDatabase('schema')
    const { Client } = await import('pg')
    const client = new Client({ connectionString: dbUrl })
    await client.connect()
    const result = await client.query(`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `)
    await client.end()

    const tables = result.rows.map((r) => r.tablename)
    expect(tables).toContain('users')
    expect(tables).toContain('knowledge_bases')

    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await manager.dropDatabase(dbName)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/test-database.manager.spec.ts
```

预期：FAIL — `TestDatabaseManager is not defined` 或 `Cannot find module`

- [ ] **步骤 3: 编写最小实现**

```typescript
// tests/integration/helpers/test-database.manager.ts
import { execSync } from 'child_process'
import { Client } from 'pg'

export class TestDatabaseManager {
  async createDatabase(suffix: string): Promise<string> {
    const random = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const dbName = `goferbot_test_${suffix}_${random}`
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL!

    const client = new Client({ connectionString: adminUrl })
    await client.connect()
    await client.query(`CREATE DATABASE "${dbName}"`)
    await client.end()

    const adminUrlObj = new URL(adminUrl)
    adminUrlObj.pathname = `/${dbName}`
    adminUrlObj.search = '?schema=public'
    const dbUrl = adminUrlObj.toString()
    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      cwd: 'packages/server',
      stdio: 'pipe',
    })

    return dbUrl
  }

  async dropDatabase(dbName: string): Promise<void> {
    const adminUrl = process.env.TEST_DATABASE_ADMIN_URL!
    const client = new Client({ connectionString: adminUrl })
    await client.connect()
    await client.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`)
    await client.end()
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/test-database.manager.spec.ts
```

预期：PASS（两个测试通过，数据库正常创建和删除）

- [ ] **步骤 5: 提交**

```bash
git add tests/integration/helpers/test-database.manager.ts tests/issues/i-01-testing-infra-setup/test-database.manager.spec.ts
git commit -m "feat(test-infra): add TestDatabaseManager with TDD"
```

---

## 任务 2: StorageCleaner

**规格引用：** api-spec.md §5 — StorageCleaner

**文件：**
- 创建：`tests/integration/helpers/storage-cleaner.ts`
- 测试：`tests/issues/i-01-testing-infra-setup/storage-cleaner.spec.ts`

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/storage-cleaner.spec.ts
import { describe, it, expect } from 'vitest'
import { StorageCleaner } from '../../integration/helpers/storage-cleaner'
import { PrismaClient } from '@prisma/client'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('StorageCleaner', () => {
  const manager = new TestDatabaseManager()
  const cleaner = new StorageCleaner()

  it('AC-05: truncates all tables and restarts identity', async () => {
    const dbUrl = await manager.createDatabase('cleaner')
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })

    await prisma.user.create({
      data: { email: 'test@gofer.bot', password: 'hash', name: 'Test' },
    })
    const before = await prisma.user.count()
    expect(before).toBe(1)

    await cleaner.truncateAllTables(prisma)
    const after = await prisma.user.count()
    expect(after).toBe(0)

    await prisma.$disconnect()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await manager.dropDatabase(dbName)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/storage-cleaner.spec.ts
```

预期：FAIL — `StorageCleaner is not defined`

- [ ] **步骤 3: 编写最小实现**

```typescript
// tests/integration/helpers/storage-cleaner.ts
import { PrismaClient } from '@prisma/client'

export class StorageCleaner {
  async truncateAllTables(prisma: PrismaClient): Promise<void> {
    const result = await prisma.$queryRawUnsafe<{ tablename: string }[]>(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `)
    const tables = result.map((r) => `"${r.tablename}"`).join(', ')
    if (tables) {
      await prisma.$executeRawUnsafe(
        `TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`
      )
    }
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/storage-cleaner.spec.ts
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/integration/helpers/storage-cleaner.ts tests/issues/i-01-testing-infra-setup/storage-cleaner.spec.ts
git commit -m "feat(test-infra): add StorageCleaner with TDD"
```

---

## 任务 3: TestAppFactory

**规格引用：** api-spec.md §2 — TestAppFactory

**文件：**
- 创建：`tests/integration/helpers/test-app.factory.ts`
- 测试：`tests/issues/i-01-testing-infra-setup/test-app.factory.spec.ts`

**前置条件：** 任务 1 完成（TestDatabaseManager 可用）。

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/test-app.factory.spec.ts
import { describe, it, expect } from 'vitest'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('TestAppFactory', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-02: creates NestJS app with overridden PrismaService', async () => {
    const dbUrl = await dbManager.createDatabase('appfactory')
    const app = await TestAppFactory.create(dbUrl)

    expect(app).toBeDefined()

    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/test-app.factory.spec.ts
```

预期：FAIL — `TestAppFactory is not defined`

- [ ] **步骤 3: 编写最小实现**

```typescript
// tests/integration/helpers/test-app.factory.ts
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { FastifyAdapter } from '@nestjs/platform-fastify'
import { AppModule } from '../../../packages/server/src/app.module'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service'

export class TestAppFactory {
  static async create(dbUrl: string): Promise<INestApplication> {
    const testPrisma = new PrismaService({
      datasources: { db: { url: dbUrl } },
    })

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(testPrisma)
      .compile()

    const app = moduleRef.createNestApplication(new FastifyAdapter())
    await app.init()
    return app
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/test-app.factory.spec.ts
```

预期：PASS（应用启动成功，/api/health 返回 200）

- [ ] **步骤 5: 提交**

```bash
git add tests/integration/helpers/test-app.factory.ts tests/issues/i-01-testing-infra-setup/test-app.factory.spec.ts
git commit -m "feat(test-infra): add TestAppFactory with TDD"
```

---

## 任务 4: AuthFixtures

**规格引用：** api-spec.md §3 — AuthFixtures

**文件：**
- 创建：`tests/integration/helpers/auth.fixtures.ts`
- 测试：`tests/issues/i-01-testing-infra-setup/auth.fixtures.spec.ts`

**前置条件：** 任务 3 完成（TestAppFactory 可用）。

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/auth.fixtures.spec.ts
import { describe, it, expect } from 'vitest'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'

describe('AuthFixtures', () => {
  const dbManager = new TestDatabaseManager()

  it('AC-03: createUser returns valid user via HTTP', async () => {
    const dbUrl = await dbManager.createDatabase('authfixtures')
    const app = await TestAppFactory.create(dbUrl)

    const user = await AuthFixtures.createUser(app, {
      email: 'fixture@gofer.bot',
      password: 'Test1234!',
      name: 'Fixture',
    })
    expect(user.email).toBe('fixture@gofer.bot')
    expect(user.name).toBe('Fixture')

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })

  it('AC-03: loginAs returns valid JWT token', async () => {
    const dbUrl = await dbManager.createDatabase('authfixtures2')
    const app = await TestAppFactory.create(dbUrl)

    await AuthFixtures.createUser(app, {
      email: 'login@gofer.bot',
      password: 'Test1234!',
      name: 'Login',
    })
    const token = await AuthFixtures.loginAs(app, {
      email: 'login@gofer.bot',
      password: 'Test1234!',
    })
    expect(typeof token).toBe('string')
    expect(token.split('.')).toHaveLength(3)

    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/auth.fixtures.spec.ts
```

预期：FAIL — `AuthFixtures is not defined`

- [ ] **步骤 3: 编写最小实现**

```typescript
// tests/integration/helpers/auth.fixtures.ts
import { publicEncrypt, constants } from 'node:crypto'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'

export const AuthFixtures = {
  normalUser: { email: 'test@gofer.bot', password: 'Test1234!' },
  adminUser: { email: 'admin@gofer.bot', password: 'Admin1234!' },

  async createUser(
    app: NestFastifyApplication,
    user: { email: string; password: string; name?: string },
    opts?: { remoteAddress?: string },
  ) {
    const encryptedPassword = await this.encryptPassword(app, user.password, opts)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: user.email, encryptedPassword, name: user.name },
      remoteAddress: opts?.remoteAddress,
    })
    if (res.statusCode >= 400) {
      throw new Error(`createUser failed: ${res.statusCode} ${res.body}`)
    }
    const body = res.json()
    const data = body.data ? body.data : body
    return data.user
  },

  async loginAs(
    app: NestFastifyApplication,
    user: { email: string; password: string },
    opts?: { remoteAddress?: string },
  ): Promise<string> {
    const encryptedPassword = await this.encryptPassword(app, user.password, opts)
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: user.email, encryptedPassword },
      remoteAddress: opts?.remoteAddress,
    })
    if (res.statusCode >= 400) {
      throw new Error(`loginAs failed: ${res.statusCode} ${res.body}`)
    }
    const body = res.json()
    const data = body.data ? body.data : body
    return data.accessToken
  },

  async encryptPassword(
    app: NestFastifyApplication,
    password: string,
    opts?: { remoteAddress?: string },
  ): Promise<string> {
    const keyRes = await app.inject({
      method: 'GET',
      url: '/api/auth/public-key',
      remoteAddress: opts?.remoteAddress,
    })
    const body = keyRes.json()
    const publicKey = body.data ? body.data.publicKey : body.publicKey

    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    return encrypted.toString('base64')
  },
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/auth.fixtures.spec.ts
```

预期：PASS（createUser 和 loginAs 均成功）

- [ ] **步骤 5: 提交**

```bash
git add tests/integration/helpers/auth.fixtures.ts tests/issues/i-01-testing-infra-setup/auth.fixtures.spec.ts
git commit -m "feat(test-infra): add AuthFixtures with TDD"
```

---

## 任务 5: ExternalServiceMocker

**规格引用：** api-spec.md §4 — ExternalServiceMocker

**文件：**
- 创建：`tests/integration/helpers/external-service.mocker.ts`
- 测试：`tests/issues/i-01-testing-infra-setup/external-service.mocker.spec.ts`

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/external-service.mocker.spec.ts
import { describe, it, expect } from 'vitest'
import nock from 'nock'
import { ExternalServiceMocker } from '../../integration/helpers/external-service.mocker'

describe('ExternalServiceMocker', () => {
  it('AC-04: intercepts OpenAI request and returns SSE stream', async () => {
    ExternalServiceMocker.mockLLMStream('hello from mock')

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] }),
    })
    const text = await res.text()
    expect(text).toContain('hello from mock')
    expect(res.headers.get('content-type')).toContain('text/event-stream')

    ExternalServiceMocker.cleanAll()
  })

  it('AC-04: intercepts Embedding request and returns vector', async () => {
    ExternalServiceMocker.mockEmbedding(new Array(1536).fill(0.1))

    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: 'test' }),
    })
    const json = await res.json()
    expect(json.data[0].embedding).toHaveLength(1536)
    expect(json.data[0].embedding[0]).toBe(0.1)

    ExternalServiceMocker.cleanAll()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/external-service.mocker.spec.ts
```

预期：FAIL — `ExternalServiceMocker is not defined` 或 fetch 超时（未拦截）

- [ ] **步骤 3: 编写最小实现**

```typescript
// tests/integration/helpers/external-service.mocker.ts
import nock from 'nock'

export const ExternalServiceMocker = {
  mockLLMStream(content: string): void {
    nock('https://api.openai.com')
      .post('/v1/chat/completions')
      .reply(200, () => {
        const sse = [
          'data: {"choices":[{"delta":{"role":"assistant"}}]}',
          `data: {"choices":[{"delta":{"content":"${content}"}}]}`,
          'data: [DONE]',
        ].join('\n\n')
        return sse
      }, { 'Content-Type': 'text/event-stream' })
  },

  mockEmbedding(vector: number[]): void {
    nock('https://api.openai.com')
      .post('/v1/embeddings')
      .reply(200, {
        data: [{ embedding: vector }],
      })
  },

  cleanAll(): void {
    nock.cleanAll()
  },
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/external-service.mocker.spec.ts
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/integration/helpers/external-service.mocker.ts tests/issues/i-01-testing-infra-setup/external-service.mocker.spec.ts
git commit -m "feat(test-infra): add ExternalServiceMocker with TDD"
```

---

## 任务 6: 配置文件与环境变量

**规格引用：** feature-spec.md — 涉及组件、已做决策

**文件：**
- 创建：`.env.test`
- 修改：`vitest.integration.config.ts`
- 创建：`vitest.e2e-api.config.ts`
- 修改：`package.json`
- 测试：`tests/issues/i-01-testing-infra-setup/config.spec.ts`

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/config.spec.ts
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'

describe('Test configuration', () => {
  it('AC-06: vitest.integration.config.ts exists with correct setup', () => {
    const content = readFileSync('vitest.integration.config.ts', 'utf-8')
    expect(content).toContain("include: ['tests/integration/**/*.spec.ts']")
    expect(content).toContain("exclude:")
    expect(content).toContain('vite-tsconfig-paths')
  })

  it('AC-07: vitest.e2e-api.config.ts exists', () => {
    expect(existsSync('vitest.e2e-api.config.ts')).toBe(true)
  })

  it('AC-09: .env.test exists with required variables', () => {
    const content = readFileSync('.env.test', 'utf-8')
    expect(content).toContain('DATABASE_URL=')
    expect(content).toContain('TEST_DATABASE_ADMIN_URL=')
    expect(content).toContain('MINIO_BUCKET=')
    expect(content).toContain('MILVUS_COLLECTION=')
    expect(content).toContain('REDIS_DB=')
  })

  it('AC-08: package.json has test scripts', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    expect(pkg.scripts['test:integration']).toBeDefined()
    expect(pkg.scripts['test:integration:watch']).toBeDefined()
    expect(pkg.scripts['test:e2e:api']).toBeDefined()
    expect(pkg.scripts['test:e2e:api:watch']).toBeDefined()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/config.spec.ts
```

预期：FAIL — `.env.test` 不存在、`vitest.e2e-api.config.ts` 不存在、package.json 缺少脚本

- [ ] **步骤 3: 编写最小实现**

```bash
# .env.test
# E2E 共享测试数据库
DATABASE_URL=postgresql://postgres:password@localhost:5432/goferbot_test?schema=public

# 模块级测试：管理连接（连 postgres 系统库执行 CREATE/DROP DATABASE）
TEST_DATABASE_ADMIN_URL=postgresql://postgres:password@localhost:5432/postgres?schema=public

# MinIO 测试 bucket
MINIO_BUCKET=goferbot-test

# Milvus 测试 collection
MILVUS_COLLECTION=goferbot_test

# Redis 测试 db index
REDIS_DB=15
```

```typescript
// vitest.integration.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    include: ['tests/integration/**/*.spec.ts', 'tests/issues/**/*.spec.ts'],
    exclude: ['tests/integration/legacy/**', 'tests/integration/sidecar/**'],
    pool: 'forks',
    testTimeout: 30000,
    hookTimeout: 15000,
    teardownTimeout: 15000,
  },
  plugins: [
    tsconfigPaths({
      projects: ['./tsconfig.json', './packages/server/tsconfig.json'],
    }),
  ],
})
```

```typescript
// vitest.e2e-api.config.ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    include: ['tests/e2e/api/**/*.spec.ts'],
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
  plugins: [
    tsconfigPaths({
      projects: ['./tsconfig.json', './packages/server/tsconfig.json'],
    }),
  ],
})
```

```json
// package.json 追加/修改 scripts 字段
{
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:integration:watch": "vitest --config vitest.integration.config.ts",
  "test:e2e:api": "vitest run --config vitest.e2e-api.config.ts",
  "test:e2e:api:watch": "vitest --config vitest.e2e-api.config.ts",
  "test:all": "pnpm test && pnpm test:integration && pnpm test:e2e:api && pnpm test:e2e"
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/config.spec.ts
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add .env.test vitest.integration.config.ts vitest.e2e-api.config.ts package.json tests/issues/i-01-testing-infra-setup/config.spec.ts
git commit -m "chore(test-infra): add test configs, env vars, and scripts"
```

---

## 任务 7: Smoke 集成测试

**规格引用：** api-spec.md — 测试映射、feature-spec.md — 范围内

**文件：**
- 测试：`tests/issues/i-01-testing-infra-setup/smoke.spec.ts`

**前置条件：** 任务 1-6 全部完成。

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/i-01-testing-infra-setup/smoke.spec.ts
import { describe, it, expect } from 'vitest'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager'
import { TestAppFactory } from '../../integration/helpers/test-app.factory'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures'
import { ExternalServiceMocker } from '../../integration/helpers/external-service.mocker'
import { StorageCleaner } from '../../integration/helpers/storage-cleaner'
import { PrismaClient } from '@prisma/client'

describe('Infrastructure Smoke Test', () => {
  const dbManager = new TestDatabaseManager()
  const cleaner = new StorageCleaner()

  it('AC-10: full workflow from DB creation to authenticated request', async () => {
    // 1. 创建测试数据库
    const dbUrl = await dbManager.createDatabase('smoke')
    expect(dbUrl).toContain('goferbot_test_smoke_')

    // 2. 启动 NestJS 应用
    const app = await TestAppFactory.create(dbUrl)
    expect(app).toBeDefined()

    // 3. 注册用户
    const user = await AuthFixtures.createUser(app, {
      email: 'smoke@gofer.bot',
      password: 'Smoke1234!',
      name: 'Smoke',
    })
    expect(user.email).toBe('smoke@gofer.bot')

    // 4. 登录获取 token
    const token = await AuthFixtures.loginAs(app, {
      email: 'smoke@gofer.bot',
      password: 'Smoke1234!',
    })
    expect(token).toBeDefined()

    // 5. 使用 token 访问受保护接口
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(meRes.statusCode).toBe(200)
    expect(meRes.json().data.email).toBe('smoke@gofer.bot')

    // 6. mock LLM 请求
    ExternalServiceMocker.mockLLMStream('mocked response')
    const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4', messages: [] }),
    })
    const llmText = await llmRes.text()
    expect(llmText).toContain('mocked response')
    ExternalServiceMocker.cleanAll()

    // 7. 清理数据库表
    const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
    await cleaner.truncateAllTables(prisma)
    const count = await prisma.user.count()
    expect(count).toBe(0)
    await prisma.$disconnect()

    // 8. 关闭应用并删除数据库
    await app.close()
    const dbName = new URL(dbUrl).pathname.replace('/', '')
    await dbManager.dropDatabase(dbName)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/smoke.spec.ts
```

预期：FAIL — 如果有任何工具未正确实现，测试会在此暴露

- [ ] **步骤 3: 修复集成问题**

如果 Smoke 测试失败，定位失败步骤并修复对应工具。可能的问题：
- PrismaService override 未生效 → 检查 `overrideProvider` 的 token 是否与 `DatabaseModule` 导出的一致
- Fastify `inject()` 的 payload 格式不正确 → 检查是否需要 `headers: { 'content-type': 'application/json' }`
- RSA-OAEP 加密结果后端不识别 → 检查 padding 和 base64 编码
- 路径别名无法解析 → 检查 `tsconfigPaths` 配置和 `tsconfig.json` 的 `paths`

逐个修复直到 Smoke 测试通过。

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx vitest run tests/issues/i-01-testing-infra-setup/smoke.spec.ts
```

预期：PASS（完整工作流通过）

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/i-01-testing-infra-setup/smoke.spec.ts
git commit -m "test(infra): add smoke test validating full infrastructure workflow"
```

---

## 自检

**规格覆盖检查：**

| Spec 章节 | 对应任务 | 状态 |
|-----------|----------|------|
| feature-spec 用户故事 | 全部任务 | 覆盖 |
| feature-spec 边界（范围内） | 全部任务 | 覆盖 |
| api-spec §1 TestDatabaseManager | 任务 1 | 覆盖 |
| api-spec §2 TestAppFactory | 任务 3 | 覆盖 |
| api-spec §3 AuthFixtures | 任务 4 | 覆盖 |
| api-spec §4 ExternalServiceMocker | 任务 5 | 覆盖 |
| api-spec §5 StorageCleaner | 任务 2 | 覆盖 |
| api-spec 测试映射 | 任务 7 Smoke | 覆盖 |
| checklist AC-01 | 任务 1 | 覆盖 |
| checklist AC-02 | 任务 3 | 覆盖 |
| checklist AC-03 | 任务 4 | 覆盖 |
| checklist AC-04 | 任务 5 | 覆盖 |
| checklist AC-05 | 任务 2 | 覆盖 |
| checklist AC-06 | 任务 6 | 覆盖 |
| checklist AC-07 | 任务 6 | 覆盖 |
| checklist AC-08 | 任务 6 | 覆盖 |
| checklist AC-09 | 任务 6 | 覆盖 |
| checklist AC-10 | 任务 7 | 覆盖 |

**占位符扫描：** 无 TBD/TODO/"稍后实现"/"填写细节"。

**类型一致性：**
- `TestDatabaseManager.createDatabase` 始终返回 `Promise<string>`（URL）
- `TestAppFactory.create` 始终接收 `dbUrl: string`
- `AuthFixtures.loginAs` 始终返回 `Promise<string>`（JWT token）
- `StorageCleaner.truncateAllTables` 始终接收 `PrismaClient`

---

## 执行交接

**计划已保存到 `docs/issues/i-01-testing-infra-setup/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？**
