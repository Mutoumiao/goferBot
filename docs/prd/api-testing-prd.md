# API 真实模拟测试体系 PRD

> 版本：v1.2 | 日期：2026-06-07 | 状态：✅ 全部完成（第一批/第二批/第三批/E2E 均已实施）
---

## 背景与问题

v2 PRD 大部分功能已完成，但 API 接口多次在真实环境中出错，导致无法完成最终测试。根本原因是 NestJS + Prisma + PostgreSQL 新后端缺少系统的 API 测试覆盖：

- **Auth/Document/Folder/Chat SSE 零集成测试**
- 现有测试基于旧 SQLite 直接路由或 sidecar 模式，**未使用 `@nestjs/testing`**
- 无 Prisma 测试数据库隔离、无认证 fixtures、无文件上传/SSE 流测试
- 全局中间件（Guard/Interceptor/Pipe）无独立验证

## 目标

建立覆盖所有 API 的两层测试体系，确保每次开发完一个 API 都能走完整验证流程，真实环境行为可预期、可复现。

---

## 测试架构

### 两层体系

| 层级               | 技术                                       | 数据库                          | 外部依赖                                    | 速度   | 运行时机                             | 必做规则                            |
|--------------------|--------------------------------------------|---------------------------------|---------------------------------------------|--------|--------------------------------------|-------------------------------------|
| **模块级集成测试** | `@nestjs/testing` + Fastify `app.inject()` | 真实 PG（每文件独立数据库）     | MinIO/pgvector/Redis 真实；LLM/Embedding mock | 秒级   | 开发时 `pnpm test:integration:watch` | **每个新增/修改的 API 必须写**      |
| **HTTP E2E**       | `axios` + 真实 NestJS 进程                 | 真实 PG（共享测试库，每例清理） | 全套真实；LLM/Embedding mock                | 分钟级 | CI / 提交前                          | 核心链路（Auth/Chat/File/KB）必须写 |

### 核心原则

1. 模块级集成测试覆盖 happy path + 所有 error cases + 边界条件
2. HTTP E2E 验证真实协议行为：multipart upload、SSE 流、JWT header、rate limit 响应头
3. 非核心 API（Health/部分 Folder 操作）模块级测试足够

---

## 环境变量

新增 `.env.test`：

```bash
# E2E 共享测试数据库
DATABASE_URL=postgresql://postgres:password@localhost:5432/goferbot_test?schema=public

# 模块级测试：管理连接（连 postgres 系统库执行 CREATE/DROP DATABASE）
TEST_DATABASE_ADMIN_URL=postgresql://postgres:password@localhost:5432/postgres?schema=public

# MinIO 测试 bucket
MINIO_BUCKET=goferbot-test

# pgvector 使用 PostgreSQL 同一实例，无需独立连接配置
# 向量数据存储在 DocumentChunk 表的 embedding 列（vector(1536)）

# Redis 测试 db index
REDIS_DB=15
```

`TestAppFactory` 加载 `ConfigModule.forRoot({ envFilePath: ['.env.test', '.env'] })`，确保测试配置优先于开发配置。

---

## 数据库策略

### 模块级集成测试（每文件隔离）

```
beforeAll:  CREATE DATABASE goferbot_test_{suffix}_{random}
            → prisma migrate deploy
afterAll:   DROP DATABASE goferbot_test_{suffix}_{random}
```

- 每个 `.spec.ts` 拥有独立数据库，测完立即删除，100% 无残留
- 完全隔离并行测试，无交叉污染
- 所有请求路径需包含 `/api` 前缀（与生产 `main.ts` 中 `setGlobalPrefix('api')` 一致）

### HTTP E2E（共享测试库 + 逐例清理）

```
beforeAll:  确认 goferbot_test 存在（不存在则创建 + migrate）
beforeEach: TRUNCATE 所有表 + MinIO bucket 清空 + pgvector embedding 数据清理
afterAll:   保留空库供下次使用（或可选 DROP）
```

- 所有 E2E 共用 `goferbot_test`，每例开始前彻底清空
- TRUNCATE 优先于事务回滚（更彻底，避免事务嵌套问题）

---

## 外部依赖策略

本地开发环境已具备全套基础设施，测试直接复用：

| 依赖          | 处理方式                  | 原因                      |
|---------------|---------------------------|---------------------------|
| PostgreSQL    | 真实测试库                | 必须匹配生产行为          |
| MinIO         | 真实实例，test bucket     | 文件上传协议必须真实验证  |
| pgvector      | PostgreSQL 扩展，同一实例 | 向量检索链路必须真实验证  |
| Redis         | 真实实例，db index 15     | 缓存/队列行为必须真实验证 |
| LLM API       | **mock**（nock/msw）      | 收费、慢、不稳定          |
| Embedding API | **mock**（nock/msw）      | 收费、慢、不稳定          |

---

## 共享测试基础设施

所有 API 测试共用的五个核心工具：

### 1. TestDatabaseManager

负责创建和销毁独立测试数据库，运行 Prisma migrate。

```typescript
class TestDatabaseManager {
  async createDatabase(suffix: string): Promise<string>;
  async dropDatabase(suffix: string): Promise<void>;
}
```

### 2. TestAppFactory

封装 `@nestjs/testing` 模块创建，确保全局 Guard/Interceptor/Pipe 与生产一致。

```typescript
class TestAppFactory {
  async create(dbUrl: string): Promise<INestApplication>;
}
```

- 创建测试专用 `PrismaClient`（`datasources.db.url = dbUrl`）
- 用 `.overrideProvider(PrismaService).useValue(testPrismaClient)` 覆盖全局 `DatabaseModule` 导出的 `PrismaService`
- 加载 `ConfigModule.forRoot({ envFilePath: ['.env.test', '.env'] })`
- 保留 `JwtAuthGuard`、`ResponseInterceptor`、`AllExceptionsFilter`、`ZodValidationPipe`、`ThrottlerGuard`
- 不覆盖 MinIO/pgvector/Redis 客户端（使用真实连接）
- 模块级测试使用 Fastify `app.inject()` 发起请求（比 supertest 更贴合 Fastify 适配器）

### 3. AuthFixtures

预置测试用户，提供快捷登录和 JWT 获取。注意项目使用 **RSA-OAEP 前端密码加密**，`loginAs` 需先获取公钥再加密密码。

```typescript
const AuthFixtures = {
  normalUser: { email: 'test@gofer.bot', password: 'Test1234!' },
  adminUser:  { email: 'admin@gofer.bot', password: 'Admin1234!' },
  async createUser(app, user): Promise<User>;
  async loginAs(app, user): Promise<string>;
  // loginAs 内部逻辑：
  // 1. GET /api/auth/public-key → 获取 RSA 公钥
  // 2. 用公钥加密 password
  // 3. POST /api/auth/login → 返回 JWT token
};
```

### 4. ExternalServiceMocker

统一拦截 LLM/Embedding HTTP 请求：

- OpenAI chat completions → 返回固定 SSE 流数据
- Embedding API → 返回固定 1536 维随机向量

使用 `nock` 实现，测试结束后自动清理拦截器。

### 5. StorageCleaner

每例结束后清理跨测试残留：

```typescript
class StorageCleaner {
  async truncateAllTables(prisma: PrismaClient): Promise<void>;
  async cleanMinIO(): Promise<void>;
  async cleanPgVector(prisma: PrismaClient): Promise<void>;
  async cleanRedis(): Promise<void>;
}
```

---

## 目录结构

采用扁平结构，每个 Controller 对应一个 `.spec.ts` 文件，与现有 `tests/integration/*.spec.ts` 保持一致：

```
tests/
├── integration/
│   ├── helpers/                    # 共享基础设施
│   │   ├── test-database.manager.ts
│   │   ├── test-app.factory.ts
│   │   ├── auth.fixtures.ts
│   │   ├── external-service.mocker.ts
│   │   ├── storage-cleaner.ts
│   │   └── test-utils.ts
│   ├── auth.controller.spec.ts     # AuthController 模块级集成测试
│   ├── document.controller.spec.ts # DocumentController 模块级集成测试
│   ├── chat.controller.spec.ts     # ChatController 模块级集成测试
│   ├── knowledge-base.controller.spec.ts  # KnowledgeBaseController 模块级集成测试
│   ├── admin-user-management.spec.ts      # Admin 用户管理测试
│   ├── infra.spec.ts              # 基础设施测试
│   └── legacy/                    # 旧 .test.ts 逐步迁移，最终删除
├── e2e/
│   ├── specs/                     # 现有 Playwright 前端 E2E（保留）
│   ├── flows/                     # 跨模块用户旅程
│   ├── pages/                     # Page Objects
│   ├── fixtures/                  # 测试夹具
│   └── api/                       # HTTP API E2E（待实施）
│       ├── auth-flow.spec.ts
│       ├── kb-lifecycle.spec.ts
│       └── file-upload-chat.spec.ts
└── unit/                          # 前端/后端单元测试
    ├── server/
    └── webui/
```

### 现有测试迁移

- `tests/integration/*.test.ts`（旧 SQLite 直接路由）→ 逐步迁移至 `tests/integration/legacy/`，新 API 禁止在此新增
- `tests/integration/sidecar/*.spec.ts` → 保留，作为已有 HTTP E2E 参考
- 新测试统一使用 `.spec.ts` 后缀，`vitest.integration.config.ts` 路径调整为 `tests/integration/**/*.spec.ts`（排除 `legacy/` 和 `helpers/`）

---

## 实施优先级

### 第一批（高优先级，核心缺口）

1. **AuthController** — register / login / logout / refresh / me / public-key
   - 密码 RSA-OAEP 加密、JWT 签发与验证、邮箱唯一性约束、RSA 公钥获取
   - error cases：400（Zod 验证失败）、401（无效 token）、409（邮箱已存在）
2. **DocumentController** — upload / create / update / delete / list
   - multipart/form-data 上传、50MB 限制、MIME 类型校验、MinIO 真实存储
3. **ChatController** — SSE 流式响应
   - 流式输出格式、客户端断开处理、abort 逻辑、消息持久化
4. **KnowledgeBaseController** — CRUD + 搜索
   - 旧测试存在但需 NestJS 模块级重写，补充认证隔离和分页

### 第二批（中优先级，补充覆盖）

5. **FolderController** — CRUD
6. **SessionController** — CRUD + rename（旧测试存在，需 NestJS 模块级重写）
7. **SettingsController** — read / write（旧测试存在，需 NestJS 模块级重写，补充 Zod 验证失败测试）

### 第三批（低优先级，基础设施验证）

8. **HealthController** — 简单存活检查
9. **全局中间件测试**
   - `ResponseInterceptor`：验证统一 `{ data: T }` 格式
   - `AllExceptionsFilter`：验证统一 `{ error: { code, message } }` 格式
   - `ZodValidationPipe`：验证字段级错误返回
   - `ThrottlerGuard`：验证 429 响应头和 Retry-After

---

## 配置文件调整

### vitest.integration.config.ts（根目录）

测试配置统一放在项目根目录，使用根目录 vitest v4（server 包内 vitest v1 后续统一升级）。

```typescript
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import path from 'path'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2021',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/server': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/integration/**/*.spec.ts'],
    exclude: [
      'tests/integration/legacy/**',
      'tests/integration/sidecar/**',
      'tests/integration/helpers/**',
    ],
    pool: 'forks',
    setupFiles: ['./tests/setup/integration-env.ts'],
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
```

### 新增 vitest.e2e-api.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import swc from 'unplugin-swc'
import path from 'path'

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
        target: 'es2021',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/server': path.resolve(__dirname, './packages/server/src'),
      '@goferbot/rag-sdk': path.resolve(__dirname, './packages/rag-sdk/src/index.ts'),
    },
  },
  test: {
    include: ['tests/e2e/api/**/*.spec.ts'],
    pool: 'forks',
    testTimeout: 60000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
  },
})
```

### package.json 脚本

```json
{
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:integration:watch": "vitest --config vitest.integration.config.ts",
  "test:e2e:api": "vitest run --config vitest.e2e-api.config.ts",
  "test:e2e:api:watch": "vitest --config vitest.e2e-api.config.ts",
  "test:all": "pnpm test && pnpm test:integration && pnpm test:e2e:api && pnpm test:e2e"
}
```

---

## 模块级测试标准模板

每个 controller 的 `.spec.ts` 必须覆盖：

| 场景          | 断言（Fastify `inject()` 风格）                      |
|---------------|------------------------------------------------------|
| Happy path    | `statusCode === 200/201` + `json().data` 格式正确    |
| Zod 验证失败  | `statusCode === 400` + `json().error` 含具体字段     |
| 认证缺失/无效 | `statusCode === 401`                                 |
| 资源不存在    | `statusCode === 404`                                 |
| 唯一约束冲突  | `statusCode === 409`                                 |
| 速率限制      | `statusCode === 429` + `headers['retry-after']` 存在 |

`inject()` 返回 `LightMyRequestResponse`，用 `res.json()` 解析 body（非 `res.body`）。

---

## 验收标准

1. 第一批 4 个 controller 全部有模块级集成测试，覆盖所有 error cases
2. Auth/Chat/File/KB 四条核心链路有 HTTP E2E 测试
3. 所有测试在本地 `pnpm test:all` 通过
4. 测试数据库零残留，不污染开发环境
5. 新增 `tests/integration/helpers/` 五个基础设施工具可用
