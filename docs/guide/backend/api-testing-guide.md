# 后端 API 测试指南

> 本文档定义 GoferBot 后端 API 自动化测试的标准流程和模板。
> 适用于所有新增 NestJS Controller 的模块级集成测试。

---

## 1. 测试基础设施

### 1.1 核心工具

| 工具 | 路径 | 用途 |
|------|------|------|
| `TestAppFactory` | `tests/integration/helpers/test-app.factory.ts` | 创建隔离的 NestJS 测试应用 |
| `AuthFixtures` | `tests/integration/helpers/auth.fixtures.ts` | 快速创建用户、登录获取 JWT |
| `TestDatabaseManager` | `tests/integration/helpers/test-database.manager.ts` | 动态创建/销毁测试数据库 |

### 1.2 环境变量要求

运行集成测试前必须设置：

```bash
export TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
export DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public"
```

或加载 `.env.test`：

```bash
set -a && source .env.test && set +a
```

---

## 2. 测试文件规范

### 2.1 文件位置

```
tests/integration/
  {feature}.spec.ts
```

- 集成测试（真实数据库 + `app.inject`）放在 `tests/integration/`
- 本指南覆盖的是集成测试，示例：`tests/integration/document-details.spec.ts`

### 2.2 文件头部

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'
```

### 2.3 用例命名规范

- 必须以 `AC-XX:` 开头，与 checklist.json 的 `id` 对应
- 格式：`AC-XX: {行为描述} {预期结果}`

示例：
```typescript
it('AC-01: returns document details for valid id', async () => {})
it('AC-02: returns 404 for non-existent document', async () => {})
it('AC-03: returns 403 for non-owner access', async () => {})
```

---

## 3. 标准测试模板

### 3.1 基础模板（需认证）

```typescript
// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from './helpers/test-app.factory.js'
import { AuthFixtures } from './helpers/auth.fixtures.js'
import { TestDatabaseManager } from './helpers/test-database.manager.js'

async function setupApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b11_details')
  const app = await TestAppFactory.create(dbUrl)
  await AuthFixtures.createUser(app, AuthFixtures.normalUser)
  const token = await AuthFixtures.loginAs(app, AuthFixtures.normalUser)
  return { app, dbManager, dbUrl, token }
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

describe('DocumentDetailsController', () => {
  it('AC-01: returns 200 with document data for valid id', async () => {
    const { app, dbManager, dbUrl, token } = await setupApp()

    // Arrange: 创建前置数据
    // ...

    // Act: 调用 API
    const res = await app.inject({
      method: 'GET',
      url: '/api/knowledge-bases/test-kb-id/documents/test-doc-id',
      headers: { authorization: `Bearer ${token}` },
    })

    // Assert: 验证响应
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toBeDefined()
    expect(body.data.id).toBe('test-doc-id')

    await teardownApp(app, dbManager, dbUrl)
  })
})
```

### 3.2 公开端点模板（无需认证）

```typescript
async function setupPublicApp() {
  const dbManager = new TestDatabaseManager()
  const dbUrl = await dbManager.createDatabase('b11_public')
  const app = await TestAppFactory.create(dbUrl)
  return { app, dbManager, dbUrl }
}

describe('PublicEndpoint', () => {
  it('AC-01: returns health status without auth', async () => {
    const { app, dbManager, dbUrl } = await setupPublicApp()
    const res = await app.inject({ method: 'GET', url: '/api/health' })
    expect(res.statusCode).toBe(200)
    await teardownApp(app, dbManager, dbUrl)
  })
})
```

---

## 4. 必备用例清单

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

## 5. 运行测试

### 5.1 单个 issue 测试

```bash
export TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
export DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public"

npx vitest run --config vitest.integration.config.ts tests/integration/
```

### 5.2 全部后端测试

```bash
pnpm test:integration
```

### 5.3 监视模式开发

```bash
pnpm test:integration:watch
```

---

## 6. 常见问题

### 6.1 TEST_DATABASE_ADMIN_URL is not set

**原因**：环境变量未加载。
**解决**：显式 export 或 `source .env.test`。

### 6.2 数据库连接超时

**原因**：PostgreSQL 未启动或连接数耗尽。
**解决**：检查 `docker compose -f docker-compose.dev.yml ps`，确认 postgres 服务健康。

### 6.3 测试间数据污染

**原因**：多个测试共享数据库或应用实例。
**解决**：确保每个 `it` 块独立调用 `setupApp()` 和 `teardownApp()`，使用随机数据库名。

---

## 7. 与 CI/CD 集成

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
      - run: pnpm prisma migrate deploy
        env:
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_test?schema=public
      - run: pnpm test:integration
        env:
          TEST_DATABASE_ADMIN_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/postgres?schema=public
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_test?schema=public
```
