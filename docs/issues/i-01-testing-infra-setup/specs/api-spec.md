# API 规格：API 测试共享基础设施

本规格定义五个共享测试辅助工具的接口契约。这些工具不是业务 API，而是测试代码的辅助接口。

---

## 1. TestDatabaseManager

### createDatabase(suffix: string): Promise<string>

创建独立测试数据库并运行 Prisma migrate。

**参数**：
| 字段 | 类型 | 说明 |
|------|------|------|
| suffix | string | 数据库名后缀，如 `auth`、`kb` |

**行为**：
1. 生成随机数据库名：`goferbot_test_{suffix}_{timestamp}_{random}`
2. 使用 `TEST_DATABASE_ADMIN_URL` 连接 postgres 系统库
3. 执行 `CREATE DATABASE {name}`
4. 生成连接 URL：`postgresql://.../{name}?schema=public`
5. 使用该 URL 执行 `prisma migrate deploy`
6. 返回数据库连接 URL

**错误**：
- 管理员连接失败 → 抛出 Error（含原始 PG 错误信息）
- migrate deploy 失败 → 抛出 Error，自动执行 DROP DATABASE 清理

### dropDatabase(dbName: string): Promise<void>

删除指定名称的测试数据库。

**参数**：
| 字段 | 类型 | 说明 |
|------|------|------|
| dbName | string | 完整数据库名，由 `createDatabase` 返回的 URL 解析得到 |

**行为**：
1. 使用 `TEST_DATABASE_ADMIN_URL` 连接 postgres 系统库
2. 执行 `DROP DATABASE IF EXISTS "{dbName}" WITH (FORCE)`
3. 数据库名需加引号防止特殊字符问题

---

## 2. TestAppFactory

### create(dbUrl: string): Promise<INestApplication>

创建 NestJS 测试应用实例。

**参数**：
| 字段 | 类型 | 说明 |
|------|------|------|
| dbUrl | string | 测试数据库连接 URL |

**行为**：
1. 创建 `new PrismaService({ datasources: { db: { url: dbUrl } } })`
2. 调用 `Test.createTestingModule({ imports: [AppModule] })`
3. `.overrideProvider(PrismaService).useValue(testPrismaService)`
4. 编译并初始化应用
5. 返回 `INestApplication`

**保证**：
- 全局 Guard/Interceptor/Pipe 与生产一致
- MinIO/Milvus/Redis 客户端使用真实连接

---

## 3. AuthFixtures

### createUser(app, user): Promise<User>

在数据库中创建测试用户。

**参数**：
| 字段 | 类型 | 说明 |
|------|------|------|
| app | INestApplication | 测试应用实例 |
| user | { email: string; password: string; name?: string } | 用户信息 |

**行为**：
1. 通过 `app.inject({ method: 'POST', url: '/api/auth/register', payload: user })` 创建用户
2. 返回 `response.json().data`（User 对象）

### loginAs(app, user): Promise<string>

以指定用户登录并返回 JWT access token。

**行为**：
1. `GET /api/auth/public-key` → 获取 RSA 公钥
2. 使用 RSA-OAEP 加密 `user.password`
3. `POST /api/auth/login` → 发送 `{ email, password: encryptedPassword }`
4. 返回 `response.data.accessToken`

---

## 4. ExternalServiceMocker

### mockLLMStream(content: string): void

拦截 OpenAI chat completions 请求，返回 SSE 流。

**参数**：
| 字段 | 类型 | 说明 |
|------|------|------|
| content | string | SSE 流中 assistant 消息的内容 |

**行为**：
- 拦截 `POST https://api.openai.com/v1/chat/completions`
- 返回 `text/event-stream`，SSE 数据行中 `data:choices[0].delta.content` 为传入的 `content`

### mockEmbedding(vector: number[]): void

拦截 Embedding API 请求。

**行为**：
- 拦截 `POST https://api.openai.com/v1/embeddings`
- 返回固定向量（默认 1536 维零向量）

### cleanAll(): void

清理所有 nock 拦截器。

---

## 5. StorageCleaner

### truncateAllTables(prisma: PrismaClient): Promise<void>

TRUNCATE 所有业务表。

**行为**：
1. 查询 `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations'`
2. 所有表名加双引号防止关键字冲突
3. 执行 `TRUNCATE TABLE "{table1}", "{table2}" RESTART IDENTITY CASCADE`
4. 单条语句 TRUNCATE 多表，避免外键约束顺序问题

### cleanMinIO(): Promise<void>

清空 MinIO test bucket 中的所有对象。

**错误**：连接失败或 bucket 不存在 → 抛出 Error（提示检查 MinIO 服务）

### cleanMilvus(): Promise<void>

清空 Milvus test collection 中的所有向量。

**错误**：连接失败或 collection 不存在 → 抛出 Error（提示检查 Milvus 服务）

### cleanRedis(): Promise<void>

清空 Redis db index 15 中的所有 key。

**错误**：连接失败 → 抛出 Error（提示检查 Redis 服务）

---

## 测试映射

| 场景 | 测试文件 | 测试用例 |
|------|----------|----------|
| 数据库创建/清理 | `tests/integration/infra/smoke.spec.ts` | `AC-01: creates and drops a test database` |
| 测试应用启动 | `tests/integration/infra/smoke.spec.ts` | `AC-02: creates NestJS app with overridden PrismaService` |
| AuthFixtures 登录 | `tests/integration/infra/smoke.spec.ts` | `AC-03: loginAs returns valid JWT token` |
| nock LLM mock | `tests/integration/infra/smoke.spec.ts` | `AC-04: intercepts OpenAI request and returns SSE stream` |
| 存储清理 | `tests/integration/infra/smoke.spec.ts` | `AC-05: truncates all tables and cleans external storage` |
