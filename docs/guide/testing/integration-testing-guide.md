# 集成测试指南

> 本文档定义 GoferBot 后端集成测试的完整流程、规范与最佳实践。
> 适用于 NestJS API 的模块级集成测试，所有测试通过真实 HTTP 请求验证后端行为。

---

## 1. 测试体系概述

### 1.1 测试分层

| 层级 | 范围 | 运行命令 | 配置文件 | 数量 |
|------|------|----------|----------|------|
| 单元测试 | Service/Util 纯函数 | `pnpm test` | `vitest.config.ts` | 141+ |
| 集成测试 | Controller + API 端点 | `pnpm test:integration` | `vitest.integration.config.ts` | 113+ |
| E2E 测试 | 完整用户流程 | `pnpm test:e2e` | Playwright | — |

### 1.2 集成测试覆盖范围

- **认证** — 注册、登录、JWT、公钥加密
- **文档** — 上传、CRUD、列表筛选
- **知识库** — 创建、删除、恢复、文件管理
- **聊天** — SSE 流式输出、超时、消息持久化
- **文件夹/会话/设置** — CRUD 操作
- **健康检查/中间件** — 异常过滤、限流、校验
- **基础设施** — 数据库管理、认证夹具、应用工厂

---

## 2. 核心基础设施

### 2.1 核心工具

| 工具 | 路径 | 职责 |
|------|------|------|
| `TestAppFactory` | `tests/integration/helpers/test-app.factory.ts` | 创建隔离的 NestJS 测试应用实例 |
| `AuthFixtures` | `tests/integration/helpers/auth.fixtures.ts` | 快速创建用户、登录获取 JWT Token |
| `TestDatabaseManager` | `tests/integration/helpers/test-database.manager.ts` | 动态创建/销毁隔离的测试数据库 |
| `ExternalServiceMocker` | `tests/integration/helpers/external-service.mocker.ts` | 封装 `nock` 的常用外部 API mock |
| `checkInfrastructure` | `tests/integration/helpers/infra-check.ts` | 检测基础设施可用性（Postgres/pgvector/Redis/MinIO） |

### 2.2 依赖 Mock 策略（默认模式）

`TestAppFactory.create(dbUrl)` 默认对以下外部依赖进行 Mock：

| 服务 | Mock 行为 |
|------|-----------|
| `QueueService` (BullMQ) | 空实现，不连接 Redis |
| `VectorService` (pgvector) | 空实现，不连接向量数据库 |
| `StorageService` (MinIO) | 返回固定 mock 值 |
| `ThrottlerGuard` | 放行所有请求（NoOp） |

**真实模式**：`TestAppFactory.create(dbUrl, { realMode: true })` 加载真实 Service（用于需要完整基础设施的集成测试，如 RAG 端到端测试）。

### 2.3 数据库生命周期模式

**模式 A：每个 it() 独立数据库（标准模式）**

```
每个 it() 块：
  1. TestDatabaseManager.createDatabase() → 创建随机命名数据库
  2. prisma migrate deploy → 执行 schema 迁移
  3. 运行测试 → 真实 HTTP 请求
  4. app.close() → 关闭 NestJS 应用
  5. TestDatabaseManager.dropDatabase() → 强制删除数据库
```

**模式 B：beforeAll 共享数据库 + beforeEach 清理（复杂场景）**

```
beforeAll：
  1. TestDatabaseManager.createDatabase() → 创建数据库
  2. prisma migrate deploy → 执行迁移
  3. TestAppFactory.create() → 启动应用

每个 it() 块：
  1. beforeEach: TRUNCATE TABLE ... → 清理数据
  2. 运行测试

afterAll：
  1. app.close()
  2. TestDatabaseManager.dropDatabase()
```

模式 B 适用于需要 Worker 异步处理、文件上传等跨多个 it() 的复杂场景（如 `auth-kb-document.spec.ts`）。

---

## 3. 环境准备

### 3.1 必需环境变量

```bash
# 数据库管理员连接（用于创建/删除测试数据库）
export TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"

# 应用数据库连接（集成测试默认使用 goferbot_test）
export DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public"
```

> **注意**：`DATABASE_URL` 并非可选。部分集成测试（如 `rag-e2e.spec.ts`）直接使用 `DATABASE_URL` 连接现有数据库，而非通过 `TestDatabaseManager` 创建。`TestDatabaseManager` 仅用于需要数据库隔离的场景。
>
> **E2E 测试使用独立数据库**：`goferbot_e2e`，避免与集成测试冲突。详见 [E2E 测试指南](./e2e-testing-guide.md)。

### 3.2 加载环境文件

`tests/setup/integration-env.ts` 会自动加载以下文件：

```
.env
.env.test
packages/server/.env
```

### 3.3 启动基础设施

```bash
# 启动 PostgreSQL（必需）
pnpm infra:up

# 确认服务健康
docker compose -f docker-compose.dev.yml ps
```

---

## 4. 测试文件规范

### 4.1 文件位置

```
tests/integration/
  {feature}.spec.ts
```

- 集成测试（真实数据库 + `app.inject`）放在 `tests/integration/`
- 纯单元测试（vi.mock）放在 `tests/unit/server/`
- 示例：`tests/integration/chat.spec.ts`

### 4.2 文件头部

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
```

### 4.3 用例命名规范

- 必须以 `AC-XX:` 开头，与验收清单的 `id` 对应
- 格式：`AC-XX: {行为描述} {预期结果}`

```typescript
it('AC-01: POST /api/chat returns SSE stream with chunks', async () => {})
it('AC-02: returns 401 without valid JWT', async () => {})
it('AC-03: returns error via SSE when LLM API fails', async () => {})
```

---

## 5. 标准测试模板

### 5.1 基础模板（需认证）

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'

async function setupApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b05_chat')
  const app = await TestAppFactory.create(dbUrl)
  const user = await AuthFixtures.createUser(app, {
    email: 'test@gofer.bot',
    password: 'Test1234!',
    name: 'Test',
  })
  const token = await AuthFixtures.loginAs(app, {
    email: 'test@gofer.bot',
    password: 'Test1234!',
  })
  return { app, dbManager, dbUrl, token, user }
}

async function teardownApp(
  app: NestFastifyApplication,
  dbManager: TestDatabaseManager,
  dbUrl: string,
) {
  await app.close()
  const dbName = new URL(dbUrl).pathname.slice(1)
  await dbManager.dropDatabase(dbName)
}

describe('ChatController', () => {
  it('AC-01: returns SSE stream for valid request', async () => {
    const { app, dbManager, dbUrl, token } = await setupApp()

    // Arrange
    mockFetchSSE(['Hello', ' World'])

    // Act
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        message: 'Hello, AI!',
        sessionId: '00000000-0000-0000-0000-000000000000',
        config: { provider: 'openai', model: 'gpt-4', baseUrl: 'https://api.openai.com', apiKey: 'sk-test' },
      },
    })

    // Assert
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toBe('text/event-stream')

    await teardownApp(app, dbManager, dbUrl)
  })
})
```

### 5.2 公开端点模板（无需认证）

```typescript
async function setupPublicApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b07_health')
  const app = await TestAppFactory.create(dbUrl)
  return { app, dbManager, dbUrl }
}

describe('HealthController', () => {
  it('AC-01: returns 200 for health check', async () => {
    const { app, dbManager, dbUrl } = await setupPublicApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    await teardownApp(app, dbManager, dbUrl)
  })
})
```

### 5.3 外部 API Mock（推荐：使用 nock）

集成测试中 mock 外部 HTTP API（如 OpenAI Embedding）推荐使用 `nock`：

```typescript
import nock from 'nock'
import { ExternalServiceMocker } from './helpers/external-service.mocker.js'

// 方式 1：直接使用 nock
nock('http://localhost:9999')
  .post('/v1/embeddings')
  .reply(200, () => ({
    data: [{ embedding: new Array(1536).fill(0.1).map((v, i) => v + i * 0.0001) }],
  }))
  .persist()  // 持久化，所有请求复用

// 方式 2：使用 ExternalServiceMocker 封装
ExternalServiceMocker.mockEmbedding(new Array(1536).fill(0.1))
ExternalServiceMocker.mockLLMStream('Hello World')

// 测试结束后清理
afterAll(() => {
  nock.cleanAll()
})
```

### 5.4 文件上传测试（multipart/form-data）

```typescript
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

it('AC-01: uploads document and returns 201', async () => {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const content = 'Test content'.repeat(50)
  const multipartBody = buildMultipartBody(boundary, 'file', 'test.txt', 'text/plain', Buffer.from(content))

  const res = await app.inject({
    method: 'POST',
    url: `/api/knowledge-bases/${kbId}/documents/upload`,
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      authorization: `Bearer ${token}`,
    },
    payload: multipartBody,
  })

  expect(res.statusCode).toBe(201)
})
```

### 5.5 基础设施可用性检查（优雅降级）

对于需要完整基础设施（pgvector、Redis、MinIO）的集成测试，使用 `checkInfrastructure` 实现条件跳过：

```typescript
import { checkInfrastructure } from './helpers/infra-check.js'

describe('Real Integration Tests', () => {
  let infraAvailable = false

  beforeAll(async () => {
    const result = await checkInfrastructure()
    infraAvailable = result.allAvailable
    if (!infraAvailable) {
      console.log('基础设施不可用，跳过测试:', result.details)
    }
  })

  it('AC-01: tests with real vector search', async () => {
    if (!infraAvailable) {
      console.log('[SKIP] 基础设施不可用')
      return
    }
    // 测试代码...
  })
})
```

或使用 `describe.skipIf`：

```typescript
const infraAvailable = process.env.DATABASE_URL?.includes('goferbot_test') ?? false
describe.skipIf(!infraAvailable)('RAG E2E', () => {
  // 所有测试在基础设施不可用时自动跳过
})
```

### 5.6 共享生命周期（setup.ts / teardown.ts）

对于需要跨测试文件共享应用实例的场景（如 RAG 端到端测试），使用 `setup.ts` 和 `teardown.ts`：

```typescript
// 在测试文件中
import { setupE2E, teardownE2E, app, prisma } from './setup.ts'
import { cleanupTestData } from './teardown.ts'

describe('RAG Integration', () => {
  beforeAll(async () => {
    await setupE2E()  // 创建数据库 + 启动应用
  })

  afterAll(async () => {
    await teardownE2E()  // 关闭应用 + 删除数据库
  })

  beforeEach(async () => {
    await cleanupTestData()  // TRUNCATE 所有表
  })

  it('AC-01: full RAG pipeline', async () => {
    const res = await app.inject({ ... })
    expect(res.statusCode).toBe(200)
  })
})
```

---

## 6. 必备用例清单

每个新 API 至少覆盖以下场景：

| 场景 | HTTP 状态 | 必测 | 说明 |
|------|-----------|------|------|
| 正常请求（happy path） | 200/201 | 是 | 核心功能验证 |
| 认证错误 | 401 | 是 | 不带 Token 或 Token 无效 |
| 权限错误 | 403 | 是 | 非资源所有者访问 |
| 资源不存在 | 404 | 是 | 无效的 ID 或已删除资源 |
| 参数校验错误 | 400 | 是 | 缺少必填字段、格式非法 |
| 空列表/空状态 | 200 | 视情况 | 返回空数组或 null |
| 边界值 | 200/400 | 视情况 | 最大值、最小值、空字符串 |
| 并发/竞态 | 视情况 | 视情况 | 高并发场景 |

---

## 7. 运行测试

### 7.1 全部后端集成测试

```bash
pnpm test:integration
```

### 7.2 单个 issue 测试

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/
```

### 7.3 单个测试文件

```bash
pnpm vitest run --config vitest.integration.config.ts tests/integration/chat/chat.spec.ts
```

### 7.4 按名称过滤

```bash
pnpm vitest run --config vitest.integration.config.ts -t "AC-03"
```

### 7.5 监视模式开发

```bash
pnpm test:integration:watch
```

---

## 8. 配置说明

### 8.1 vitest.integration.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import path from 'path'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: 'es2021',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/server': path.resolve(__dirname, './packages/server/src'),
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    exclude: [
      'tests/integration/legacy/**',
      'tests/integration/sidecar/**',
    ],
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    setupFiles: ['./tests/setup/integration-env.ts'],
  },
})
```

**关键配置说明：**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `pool: 'forks'` | 进程隔离 | 每个测试文件在独立进程运行，避免状态污染 |
| `testTimeout: 60000` | 60 秒 | 数据库创建+迁移+测试需要较长时间 |
| `alias '@'` | `packages/server/src` | 后端源码路径解析 |

---

## 9. 常见问题

### 9.1 TEST_DATABASE_ADMIN_URL is not set

**原因**：环境变量未加载。
**解决**：

```bash
export TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
```

### 9.2 数据库连接超时

**原因**：PostgreSQL 未启动或连接数耗尽。
**解决**：

```bash
docker compose -f docker-compose.dev.yml ps
pnpm infra:up
```

### 9.3 测试间数据污染

**原因**：多个测试共享数据库或应用实例。
**解决**：确保每个 `it` 块独立调用 `setupApp()` 和 `teardownApp()`，使用随机数据库名。

### 9.4 Prisma 迁移失败

**原因**：schema 变更后未重新生成 Prisma Client。
**解决**：

```bash
pnpm --filter @goferbot/server prisma:generate
```

### 9.5 端口占用

**原因**：之前的测试进程未正常退出。
**解决**：

```bash
# Linux/macOS
lsof -ti:3000 | xargs kill -9

# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```
```

---

## 10. CI/CD 集成

```yaml
# .github/workflows/test.yml 示例
jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: gofer
          POSTGRES_PASSWORD: gofer_dev_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm --filter @goferbot/server prisma:generate
      - run: pnpm test:integration
        env:
          TEST_DATABASE_ADMIN_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/postgres?schema=public
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_test?schema=public
```
