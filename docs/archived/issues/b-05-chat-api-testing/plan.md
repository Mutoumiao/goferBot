---
id: b-05
issue: issue.md
version: 2
---

# ChatController SSE 测试实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 为 ChatController 的 `POST /api/chat` SSE 端点编写 17 条模块级集成测试，覆盖流式输出、SSE 格式、DTO 校验、权限控制、LLM 异常和 E2E 完整链路。

**架构：** 使用 `TestAppFactory.create()` + `vi.fn()` mock `global.fetch` 返回 `ReadableStream`。SSE 响应按 `\n\n` 拆分后用 `slice(6)` 去掉 `data: ` 前缀解析。每个测试独立创建/销毁数据库，`global.fetch` 在每个测试后自动还原。

**技术栈：** Vitest + NestJS TestingModule + Fastify Adapter + Prisma（无额外依赖）

**Issue 引用：** [issue.md](issue.md)
**Spec 引用：** [specs/feature-spec.md](specs/feature-spec.md) | [specs/api-spec.md](specs/api-spec.md)

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `tests/issues/b-05-chat-api-testing/chat.spec.ts` | 主测试文件，17 条 AC 用例 |

---

## 关键设计决策

### fetch Mock（替代 nock）

`chat.service.ts` 使用全局 `fetch()`（Node.js 18+ undici），nock 无法拦截。使用 `vi.fn()` 替换 `global.fetch`，返回标准 `Response` + `ReadableStream`：

```typescript
import { vi, afterEach } from 'vitest'

// 每个测试后自动还原 fetch
afterEach(() => {
  vi.restoreAllMocks()
})

function mockFetchSSE(chunks: string[], opts?: { status?: number; delayMs?: number }) {
  const encoder = new TextEncoder()
  const status = opts?.status ?? 200

  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      new ReadableStream({
        async start(controller) {
          if (opts?.delayMs) {
            await new Promise(r => setTimeout(r, opts.delayMs))
          }
          for (const chunk of chunks) {
            controller.enqueue(encoder.encode(chunk))
          }
          controller.close()
        },
      }),
      { status },
    ) as unknown as Response,
  )
}
```

### SSE 响应解析

`inject()` 返回 `res.payload` 为完整 SSE 字符串，格式为 `data: {...}\n\n`。使用 `slice(6)` 精确去掉 `data: ` 前缀（6 字符）：

```typescript
function parseSSE(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice(6)))
}
```

### 超时测试策略

AC-16（LLM 超时）需 `LLM_TIMEOUT_MS < nock 延迟`。在 `TestAppFactory.create()` **之前**设置 `process.env.LLM_TIMEOUT_MS='500'`，让 ChatService 构造时读取短超时。`mockFetchSSE` 用 `delayMs: 2000` 触发超时。

`ConfigService.get()` 在 `ChatService` 构造函数中调用一次，所以 `process.env` 必须在 `create()` 之前设置。测试结束后还原 `process.env`。

### AC-03 客户端断开测试

`inject()` 无真实 TCP 连接，无法触发 `reply.raw.on('close')`。改为验证 AbortController 超时路径：设置短超时 + fetch 延迟 → abort 触发 → 验证流终止且 app 可正常关闭（资源无泄漏）。与 AC-16 区分：AC-03 关注 abort 机制本身（cleanup），AC-16 关注错误消息格式。

---

## 前置依赖

- `TEST_DATABASE_ADMIN_URL` 环境变量已设置
- `i-01` / `b-02` / `b-03` / `b-04` 测试通过（回归基线）
- `chat.controller.ts` 错误提取逻辑已修复（`err.getResponse()` 替代 `err.message`）

---

## 任务 1: 创建测试骨架

**文件：**
- 创建：`tests/issues/b-05-chat-api-testing/chat.spec.ts`

- [ ] **步骤 1: 编写失败测试骨架**

```typescript
// tests/issues/b-05-chat-api-testing/chat.spec.ts
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { TestAppFactory } from '../../integration/helpers/test-app.factory.js'
import { AuthFixtures } from '../../integration/helpers/auth.fixtures.js'
import { TestDatabaseManager } from '../../integration/helpers/test-database.manager.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'

describe('ChatController', () => {
  const dbManager = new TestDatabaseManager()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('AC-01: POST /api/chat returns SSE stream with chunks', async () => {
    expect(true).toBe(false)
  })

  it('AC-02: SSE stream has valid format (data:, done marker)', async () => {
    expect(true).toBe(false)
  })

  it('AC-03: handles abort gracefully and cleans up resources', async () => {
    expect(true).toBe(false)
  })

  it('AC-04: persists user and assistant messages to database', async () => {
    expect(true).toBe(false)
  })

  it('AC-05: accepts knowledgeBaseIds in request without error', async () => {
    expect(true).toBe(false)
  })

  it('AC-06: E2E flow (create session → send message → verify stream → view history)', async () => {
    expect(true).toBe(false)
  })

  it('AC-07: returns 400 when message is empty', async () => {
    expect(true).toBe(false)
  })

  it('AC-08: returns 400 when message exceeds 4000 chars', async () => {
    expect(true).toBe(false)
  })

  it('AC-09: returns 400 when sessionId is not a valid UUID', async () => {
    expect(true).toBe(false)
  })

  it('AC-10: returns 400 when config fields are missing', async () => {
    expect(true).toBe(false)
  })

  it('AC-11: returns 400 when config.baseUrl is not in whitelist', async () => {
    expect(true).toBe(false)
  })

  it('AC-12: returns 401 without valid JWT', async () => {
    expect(true).toBe(false)
  })

  it('AC-13: returns error via SSE when user is not session owner', async () => {
    expect(true).toBe(false)
  })

  it('AC-14: returns error via SSE when session does not exist', async () => {
    expect(true).toBe(false)
  })

  it('AC-15: returns error via SSE when LLM API fails', async () => {
    expect(true).toBe(false)
  })

  it('AC-16: returns LLM_TIMEOUT error when LLM times out', async () => {
    expect(true).toBe(false)
  })

  it('AC-17: persists assistant message even when LLM returns empty', async () => {
    expect(true).toBe(false)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts`
预期：FAIL — 17/17 测试失败（`expected true to be false`）

- [ ] **步骤 3: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): add ChatController test skeleton with 17 AC placeholders"
```

---

## 任务 2: AC-01~AC-04 — SSE 流、格式、abort、持久化

**文件：**
- 修改：`tests/issues/b-05-chat-api-testing/chat.spec.ts`

**规格引用：**
- API 规格：[SSE 流格式]、[消息持久化]

**关键点：**
- `mockFetchSSE()` 返回模拟 OpenAI SSE 格式 → controller 解析为 `{ chunk, done }` → 写入响应
- `parseSSE()` 用 `slice(6)` 精确解析 controller 输出
- AC-04 通过 `app.get(PrismaService).message.findMany()` 查 DB 验证
- AC-03 验证 abort 后 app 可正常关闭（无资源泄漏）

- [ ] **步骤 1: 编写辅助函数 + AC-01~AC-04 测试**

```typescript
// ============================================================
// 辅助函数
// ============================================================

function parseSSE(payload: string): Array<Record<string, unknown>> {
  return payload
    .split('\n\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice(6)))
}

function makeOpenAIChunk(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`
}

/** Mock global.fetch 返回模拟 OpenAI SSE 流 */
function mockFetchSSE(chunks: string[], opts?: { status?: number; delayMs?: number }) {
  const encoder = new TextEncoder()
  const status = opts?.status ?? 200
  const body = chunks.map(makeOpenAIChunk).join('') + 'data: [DONE]\n\n'

  vi.spyOn(global, 'fetch').mockResolvedValue(
    new Response(
      new ReadableStream({
        async start(controller) {
          if (opts?.delayMs) {
            await new Promise(r => setTimeout(r, opts.delayMs))
          }
          controller.enqueue(encoder.encode(body))
          controller.close()
        },
      }),
      { status },
    ) as unknown as Response,
  )
}

const defaultConfig = {
  provider: 'openai',
  model: 'gpt-4',
  baseUrl: 'https://api.openai.com',
  apiKey: 'sk-test',
}

function chatPayload(overrides: Record<string, unknown> = {}) {
  return {
    message: 'Hello, AI!',
    sessionId: '00000000-0000-0000-0000-000000000000',
    config: defaultConfig,
    ...overrides,
  }
}

async function createTestSession(app: NestFastifyApplication, token: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'Test Chat' },
  })
  return res.json().data
}

// ============================================================
// AC-01: SSE 流式输出
// ============================================================

it('AC-01: POST /api/chat returns SSE stream with chunks', async () => {
  const dbUrl = await dbManager.createDatabase('chat_sse')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c1@gofer.bot', password: 'Test1234!', name: 'C1' })
  const token = await AuthFixtures.loginAs(app, { email: 'c1@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  mockFetchSSE(['Hello', ' World'])

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  expect(res.statusCode).toBe(200)
  expect(res.headers['content-type']).toBe('text/event-stream')

  const chunks = parseSSE(res.payload)
  expect(chunks).toHaveLength(3)  // 2 content + 1 done
  expect(chunks[0]).toEqual({ chunk: 'Hello', done: false })
  expect(chunks[1]).toEqual({ chunk: ' World', done: false })
  expect(chunks[2]).toEqual({ chunk: '', done: true })

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-02: SSE 格式验证
// ============================================================

it('AC-02: SSE stream has valid format (data:, done marker)', async () => {
  const dbUrl = await dbManager.createDatabase('chat_format')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c2@gofer.bot', password: 'Test1234!', name: 'C2' })
  const token = await AuthFixtures.loginAs(app, { email: 'c2@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  mockFetchSSE(['Test'])

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  expect(res.headers['content-type']).toBe('text/event-stream')
  expect(res.headers['cache-control']).toBe('no-cache')
  expect(res.headers['connection']).toBe('keep-alive')

  const lines = res.payload.split('\n\n').filter(Boolean)
  expect(lines.length).toBeGreaterThanOrEqual(2)  // at least 1 content + 1 done

  for (const line of lines) {
    expect(line).toMatch(/^data: /)
    const json = JSON.parse(line.slice(6))
    expect(json).toHaveProperty('done')
    if (json.done) {
      expect(json.chunk).toBe('')
    } else {
      expect(typeof json.chunk).toBe('string')
      expect(json.chunk.length).toBeGreaterThan(0)
    }
  }

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-03: Abort 清理验证
// ============================================================

it('AC-03: handles abort gracefully and cleans up resources', async () => {
  const prevTimeout = process.env.LLM_TIMEOUT_MS
  process.env.LLM_TIMEOUT_MS = '300'

  const dbUrl = await dbManager.createDatabase('chat_abort')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c3@gofer.bot', password: 'Test1234!', name: 'C3' })
  const token = await AuthFixtures.loginAs(app, { email: 'c3@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  mockFetchSSE(['partial'], { delayMs: 2000 })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  // 流应以错误终止
  expect(res.statusCode).toBe(200)
  const chunks = parseSSE(res.payload)
  const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
  expect(lastChunk.done).toBe(true)
  expect(lastChunk.error).toBeDefined()

  // 验证 app 可正常关闭（无资源泄漏）
  await expect(app.close()).resolves.not.toThrow()

  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)

  if (prevTimeout) process.env.LLM_TIMEOUT_MS = prevTimeout
  else delete process.env.LLM_TIMEOUT_MS
})

// ============================================================
// AC-04: 消息持久化
// ============================================================

it('AC-04: persists user and assistant messages to database', async () => {
  const dbUrl = await dbManager.createDatabase('chat_persist')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c4@gofer.bot', password: 'Test1234!', name: 'C4' })
  const token = await AuthFixtures.loginAs(app, { email: 'c4@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  mockFetchSSE(['Hello', ' World'])

  await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  const prisma = app.get(PrismaService)
  const messages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })

  expect(messages).toHaveLength(2)
  expect(messages[0].role).toBe('user')
  expect(messages[0].content).toBe('Hello, AI!')
  expect(messages[1].role).toBe('assistant')
  expect(messages[1].content).toBe('Hello World')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败（RED）**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts --reporter=verbose`
预期：FAIL — AC-01~AC-04 断言与生产代码实际行为需调试对齐

- [ ] **步骤 3: 调试并运行测试验证通过（GREEN）**

运行：同上。调试要点：
- `vi.spyOn(global, 'fetch')` 是否正确拦截
- `ReadableStream` 在 Node.js 环境是否可用（Node 18+ 全局可用）
- `parseSSE` 是否正确解析 controller 输出的 `data: {...}\n\n` 格式
预期：PASS — AC-01~AC-04 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): AC-01~AC-04 SSE stream, format, abort and persistence tests"
```

---

## 任务 3: AC-05~AC-06 — knowledgeBaseIds 接受 + E2E 完整链路

**文件：**
- 修改：`tests/issues/b-05-chat-api-testing/chat.spec.ts`

**规格引用：**
- API 规格：[POST /api/chat 请求格式]、[E2E 链路]

- [ ] **步骤 1: 编写 AC-05~AC-06 测试**

```typescript
// ============================================================
// AC-05: knowledgeBaseIds 参数接受
// ============================================================

it('AC-05: accepts knowledgeBaseIds in request without error', async () => {
  const dbUrl = await dbManager.createDatabase('chat_kbids')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c5@gofer.bot', password: 'Test1234!', name: 'C5' })
  const token = await AuthFixtures.loginAs(app, { email: 'c5@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  mockFetchSSE(['OK'])

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({
      sessionId: session.id,
      knowledgeBaseIds: ['00000000-0000-0000-0000-000000000000'],
    }),
  })

  expect(res.statusCode).toBe(200)
  const chunks = parseSSE(res.payload)
  expect(chunks.some((c: any) => c.chunk === 'OK')).toBe(true)
  expect(chunks[chunks.length - 1].done).toBe(true)

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-06: E2E 完整链路
// ============================================================

it('AC-06: E2E flow (create session → send message → verify stream → view history)', async () => {
  const dbUrl = await dbManager.createDatabase('chat_e2e')
  const app = await TestAppFactory.create(dbUrl)

  // Step 1: 注册 + 登录
  const user = await AuthFixtures.createUser(app, { email: 'c6@gofer.bot', password: 'Test1234!', name: 'C6' })
  const token = await AuthFixtures.loginAs(app, { email: 'c6@gofer.bot', password: 'Test1234!' })

  // Step 2: 创建会话
  const sessionRes = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    headers: { authorization: `Bearer ${token}` },
    payload: { title: 'E2E Test Chat' },
  })
  expect(sessionRes.statusCode).toBe(201)
  const session = sessionRes.json().data
  expect(session.title).toBe('E2E Test Chat')

  // Step 3: 发送消息，获取 SSE 流
  mockFetchSSE(['E2E', ' Response'])

  const chatRes = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id, message: 'E2E test message' }),
  })
  expect(chatRes.statusCode).toBe(200)

  const chunks = parseSSE(chatRes.payload)
  expect(chunks[0]).toEqual({ chunk: 'E2E', done: false })
  expect(chunks[1]).toEqual({ chunk: ' Response', done: false })
  expect(chunks[2]).toEqual({ chunk: '', done: true })

  // Step 4: 查看会话历史
  const historyRes = await app.inject({
    method: 'GET',
    url: `/api/sessions/${session.id}`,
    headers: { authorization: `Bearer ${token}` },
  })
  expect(historyRes.statusCode).toBe(200)
  const history = historyRes.json().data
  expect(history.messages).toHaveLength(2)
  expect(history.messages[0].role).toBe('user')
  expect(history.messages[0].content).toBe('E2E test message')
  expect(history.messages[1].role).toBe('assistant')
  expect(history.messages[1].content).toBe('E2E Response')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts --reporter=verbose`
预期：FAIL — AC-05~AC-06 失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上
预期：PASS — AC-01~AC-06 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): AC-05~AC-06 knowledgeBaseIds acceptance and E2E flow test"
```

---

## 任务 4: AC-07~AC-12 — DTO 校验 + 认证 HTTP 错误

**文件：**
- 修改：`tests/issues/b-05-chat-api-testing/chat.spec.ts`

**规格引用：**
- API 规格：[400 DTO 校验]、[401 认证]

**关键点：**
- DTO 校验由 ZodValidationPipe 处理，返回 HTTP 400 JSON（非 SSE），无需 mock fetch
- AC-12 payload 使用合法 UUID 避免 Zod 校验干扰：`sessionId: '00000000-0000-0000-0000-000000000000'`

- [ ] **步骤 1: 编写 AC-07~AC-12 测试**

```typescript
// ============================================================
// AC-07: message 为空 → 400
// ============================================================

it('AC-07: returns 400 when message is empty', async () => {
  const dbUrl = await dbManager.createDatabase('chat_msg_empty')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c7@gofer.bot', password: 'Test1234!', name: 'C7' })
  const token = await AuthFixtures.loginAs(app, { email: 'c7@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ message: '' }),
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-08: message 超长 → 400
// ============================================================

it('AC-08: returns 400 when message exceeds 4000 chars', async () => {
  const dbUrl = await dbManager.createDatabase('chat_msg_long')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c8@gofer.bot', password: 'Test1234!', name: 'C8' })
  const token = await AuthFixtures.loginAs(app, { email: 'c8@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ message: 'a'.repeat(4001) }),
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-09: sessionId 非 UUID → 400
// ============================================================

it('AC-09: returns 400 when sessionId is not a valid UUID', async () => {
  const dbUrl = await dbManager.createDatabase('chat_sid_fmt')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c9@gofer.bot', password: 'Test1234!', name: 'C9' })
  const token = await AuthFixtures.loginAs(app, { email: 'c9@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: 'not-a-uuid' }),
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-10: config 字段缺失 → 400
// ============================================================

it('AC-10: returns 400 when config fields are missing', async () => {
  const dbUrl = await dbManager.createDatabase('chat_cfg_miss')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c10@gofer.bot', password: 'Test1234!', name: 'C10' })
  const token = await AuthFixtures.loginAs(app, { email: 'c10@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: { message: 'test', sessionId: '00000000-0000-0000-0000-000000000000', config: {} },
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-11: baseUrl 不在白名单 → 400
// ============================================================

it('AC-11: returns 400 when config.baseUrl is not in whitelist', async () => {
  const dbUrl = await dbManager.createDatabase('chat_ssrf')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c11@gofer.bot', password: 'Test1234!', name: 'C11' })
  const token = await AuthFixtures.loginAs(app, { email: 'c11@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({
      config: { ...defaultConfig, baseUrl: 'https://evil.example.com' },
    }),
  })
  expect(res.statusCode).toBe(400)
  expect(res.json().error.code).toBe('VALIDATION_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-12: 无 JWT → 401
// ============================================================

it('AC-12: returns 401 without valid JWT', async () => {
  const dbUrl = await dbManager.createDatabase('chat_401')
  const app = await TestAppFactory.create(dbUrl)

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    payload: chatPayload({ sessionId: '00000000-0000-0000-0000-000000000000' }),
  })
  expect(res.statusCode).toBe(401)
  expect(res.json().error.code).toBe('AUTH_ERROR')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts --reporter=verbose`
预期：FAIL — AC-07~AC-12 失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上
预期：PASS — AC-01~AC-12 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): AC-07~AC-12 DTO validation and auth error tests"
```

---

## 任务 5: AC-13~AC-14 — 会话权限 + 不存在（SSE 流内错误）

**文件：**
- 修改：`tests/issues/b-05-chat-api-testing/chat.spec.ts`

**规格引用：**
- API 规格：[SSE 流内 error — 会话不存在/无权访问]

**关键点：**
- 错误在 `ensureSessionOwnership` 中抛出 → controller catch → `err.getResponse().message` 提取 → SSE `{ error, done: true }`
- 这些错误发生在 nock/fetch 之前，无需 mock fetch
- HTTP 状态码始终 200（SSE 头已发送）

- [ ] **步骤 1: 编写 AC-13~AC-14 测试**

```typescript
// ============================================================
// AC-13: 非会话所有者 → SSE error
// ============================================================

it('AC-13: returns error via SSE when user is not session owner', async () => {
  const dbUrl = await dbManager.createDatabase('chat_perm')
  const app = await TestAppFactory.create(dbUrl)

  const userA = await AuthFixtures.createUser(app, { email: 'owner@gofer.bot', password: 'Test1234!', name: 'Owner' })
  const tokenA = await AuthFixtures.loginAs(app, { email: 'owner@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, tokenA)

  const userB = await AuthFixtures.createUser(app, { email: 'intruder@gofer.bot', password: 'Test1234!', name: 'Intruder' })
  const tokenB = await AuthFixtures.loginAs(app, { email: 'intruder@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${tokenB}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  expect(res.statusCode).toBe(200)
  const chunks = parseSSE(res.payload)
  const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
  expect(lastChunk.done).toBe(true)
  expect(lastChunk.error).toBe('无权访问该会话')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-14: 会话不存在 → SSE error
// ============================================================

it('AC-14: returns error via SSE when session does not exist', async () => {
  const dbUrl = await dbManager.createDatabase('chat_notfound')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c14@gofer.bot', password: 'Test1234!', name: 'C14' })
  const token = await AuthFixtures.loginAs(app, { email: 'c14@gofer.bot', password: 'Test1234!' })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: '00000000-0000-0000-0000-000000000000' }),
  })

  expect(res.statusCode).toBe(200)
  const chunks = parseSSE(res.payload)
  const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
  expect(lastChunk.done).toBe(true)
  expect(lastChunk.error).toBe('会话不存在')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts --reporter=verbose`
预期：FAIL — AC-13~AC-14 断言不匹配（验证 `err.getResponse().message` 提取正确性）

- [ ] **步骤 3: 运行测试验证通过**

运行：同上。如 controller catch 块未正确提取 `getResponse().message`，需调整断言或修复 controller 代码。
预期：PASS — AC-01~AC-14 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): AC-13~AC-14 session permission and not-found SSE error tests"
```

---

## 任务 6: AC-15~AC-17 — LLM 错误 + 超时 + 空回复

**文件：**
- 修改：`tests/issues/b-05-chat-api-testing/chat.spec.ts`

**规格引用：**
- API 规格：[SSE 流内 error — LLM_ERROR / LLM_TIMEOUT]、[空回复持久化]

**关键点：**
- AC-15: `mockFetchSSE([], { status: 500 })` — fetch 返回 500
- AC-16: `process.env.LLM_TIMEOUT_MS='500'` 在 `create()` **之前** + `mockFetchSSE([], { delayMs: 2000 })`
- AC-17: `mockFetchSSE([])` — 空数组 = 无 content chunk，仅 `data: [DONE]\n\n`

- [ ] **步骤 1: 编写 AC-15~AC-17 测试**

```typescript
// ============================================================
// AC-15: LLM API 失败 → SSE error
// ============================================================

it('AC-15: returns error via SSE when LLM API fails', async () => {
  const dbUrl = await dbManager.createDatabase('chat_llmerr')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c15@gofer.bot', password: 'Test1234!', name: 'C15' })
  const token = await AuthFixtures.loginAs(app, { email: 'c15@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  mockFetchSSE([], { status: 500 })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  expect(res.statusCode).toBe(200)
  const chunks = parseSSE(res.payload)
  const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
  expect(lastChunk.done).toBe(true)
  expect(lastChunk.error).toContain('LLM 请求失败')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})

// ============================================================
// AC-16: LLM 超时 → SSE LLM_TIMEOUT error
// ============================================================

it('AC-16: returns LLM_TIMEOUT error when LLM times out', async () => {
  const prevTimeout = process.env.LLM_TIMEOUT_MS
  process.env.LLM_TIMEOUT_MS = '500'

  const dbUrl = await dbManager.createDatabase('chat_timeout')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c16@gofer.bot', password: 'Test1234!', name: 'C16' })
  const token = await AuthFixtures.loginAs(app, { email: 'c16@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  // 延迟 2000ms > 500ms 超时
  mockFetchSSE(['irrelevant'], { delayMs: 2000 })

  const res = await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  expect(res.statusCode).toBe(200)
  const chunks = parseSSE(res.payload)
  const lastChunk = chunks[chunks.length - 1] as Record<string, unknown>
  expect(lastChunk.done).toBe(true)
  expect(lastChunk.error).toContain('LLM 请求超时')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)

  if (prevTimeout) process.env.LLM_TIMEOUT_MS = prevTimeout
  else delete process.env.LLM_TIMEOUT_MS
})

// ============================================================
// AC-17: LLM 空回复持久化
// ============================================================

it('AC-17: persists assistant message even when LLM returns empty', async () => {
  const dbUrl = await dbManager.createDatabase('chat_empty')
  const app = await TestAppFactory.create(dbUrl)

  const user = await AuthFixtures.createUser(app, { email: 'c17@gofer.bot', password: 'Test1234!', name: 'C17' })
  const token = await AuthFixtures.loginAs(app, { email: 'c17@gofer.bot', password: 'Test1234!' })
  const session = await createTestSession(app, token)

  // 空 chunks → 仅 [DONE]，无 content delta
  mockFetchSSE([])

  await app.inject({
    method: 'POST',
    url: '/api/chat',
    headers: { authorization: `Bearer ${token}` },
    payload: chatPayload({ sessionId: session.id }),
  })

  const prisma = app.get(PrismaService)
  const messages = await prisma.message.findMany({
    where: { sessionId: session.id },
    orderBy: { createdAt: 'asc' },
  })

  expect(messages).toHaveLength(2)
  expect(messages[0].role).toBe('user')
  expect(messages[1].role).toBe('assistant')
  expect(messages[1].content).toBe('')

  await app.close()
  const dbName = new URL(dbUrl).pathname.replace('/', '')
  await dbManager.dropDatabase(dbName)
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts --reporter=verbose`
预期：FAIL — AC-15~AC-17 失败

- [ ] **步骤 3: 运行测试验证通过**

运行：同上。注意 AC-16 依赖 `process.env.LLM_TIMEOUT_MS` 在 `create()` 前设置 → `ConfigService.get()` 在 ChatService 构造函数读取。
预期：PASS — 17/17 全部通过

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): AC-15~AC-17 LLM error, timeout and empty reply tests"
```

---

## 任务 7: 最终验证与清理

- [ ] **步骤 1: 全量运行 b-05 测试**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/b-05-chat-api-testing/chat.spec.ts --reporter=verbose`
预期：PASS — 17/17 全部通过

- [ ] **步骤 2: 运行回归测试**

运行：`npx vitest run --config vitest.integration.config.ts tests/issues/i-01-testing-infra-setup/ tests/issues/b-02-auth-api-testing/ tests/issues/b-03-document-api-testing/ tests/issues/b-04-knowledge-base-api-testing/ --reporter=verbose`
预期：PASS — 已有测试无回归

- [ ] **步骤 3: 类型检查**

运行：`pnpm type-check`
预期：0 错误

- [ ] **步骤 4: 提交**

```bash
git add tests/issues/b-05-chat-api-testing/
git commit -m "test(b-05): complete ChatController SSE integration tests (17 ACs)"
```

---

## 自检

### 规格覆盖检查

| Spec 需求 | 对应任务 | AC |
|-----------|----------|-----|
| SSE 流式输出 | 任务 2 | AC-01 |
| SSE 格式验证 | 任务 2 | AC-02 |
| Abort 清理 | 任务 2 | AC-03 |
| 消息持久化 | 任务 2 | AC-04 |
| knowledgeBaseIds | 任务 3 | AC-05 |
| E2E 完整链路 | 任务 3 | AC-06 |
| message 为空 | 任务 4 | AC-07 |
| message 超长 | 任务 4 | AC-08 |
| sessionId 非 UUID | 任务 4 | AC-09 |
| config 缺失 | 任务 4 | AC-10 |
| baseUrl 白名单 | 任务 4 | AC-11 |
| 无 JWT | 任务 4 | AC-12 |
| 非会话所有者 | 任务 5 | AC-13 |
| 会话不存在 | 任务 5 | AC-14 |
| LLM API 失败 | 任务 6 | AC-15 |
| LLM 超时 | 任务 6 | AC-16 |
| 空回复持久化 | 任务 6 | AC-17 |

### 占位符扫描

- [x] 无 "TBD" / "TODO" / "稍后实现"
- [x] 无 "添加适当的错误处理" 等模糊描述
- [x] 每个任务都有具体代码块
- [x] 每个任务都以测试开始，以测试通过结束

### 类型一致性

- [x] `vi.restoreAllMocks()` 在 `afterEach` 全局清理
- [x] `process.env.LLM_TIMEOUT_MS` 在 AC-03/AC-16 后还原
- [x] SSE 解析统一使用 `slice(6)`（非 `replace` 正则）
- [x] 数据库清理模式统一（`app.close()` → `dropDatabase`）
- [x] 所有测试 email 唯一不冲突
- [x] `chatPayload` 默认 sessionId 使用合法 UUID 格式
- [x] `createTestSession` 类型标注为 `NestFastifyApplication`
- [x] AC-12 payload 显式传合法 UUID 避免嵌套校验干扰
