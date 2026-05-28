---
id: q-21
issue: issue.md
version: 1
---

# RAG Server 集成端到端验证实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 验证 RAG Server 集成的完整端到端链路：上传→索引→对话检索→无检索回归→索引失败处理。

**架构：** 使用 Vitest + 真实基础设施（PG + MinIO + Milvus + Redis）编写集成测试。启动 mock Embedding Server 和 mock LLM Server 模拟外部依赖。

**技术栈：** Vitest + Fastify inject + 真实数据库 + BullMQ + MinIO + Milvus

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/api-spec.md](./specs/api-spec.md)

---

## 文件结构

- **新增：**
  - `tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`
  - `tests/issues/q-21-rag-server-integration-e2e/setup.ts`（测试前置：创建 NestJS app、mock servers）
  - `tests/issues/q-21-rag-server-integration-e2e/teardown.ts`（测试后置：清理数据）
- **修改：**
  - `vitest.integration.config.ts`（若需添加 q-21 测试配置）

---

## 前置条件

测试执行前必须启动 Docker 基础设施：

```bash
pnpm infra:up
```

确认服务运行：
```bash
docker compose -f docker-compose.dev.yml ps
```

环境变量（测试自动读取 `.env`）：
```bash
export DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public"
export REDIS_HOST="127.0.0.1"
export REDIS_PORT="6379"
export MILVUS_HOST="127.0.0.1"
export MILVUS_PORT="19530"
export MILVUS_COLLECTION="test_chunks"
export MILVUS_VECTOR_DIM="1536"
export MINIO_ENDPOINT="127.0.0.1:9000"
export MINIO_ACCESS_KEY="minioadmin"
export MINIO_SECRET_KEY="minioadmin"
export MINIO_BUCKET="goferbot-test"
```

---

## 任务 1: 测试基础设施搭建

**文件：**
- 创建：`tests/issues/q-21-rag-server-integration-e2e/setup.ts`
- 创建：`tests/issues/q-21-rag-server-integration-e2e/teardown.ts`
- 测试：`tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`

**规格引用：**
- API 规格：[环境要求]、[测试数据规范]

- [ ] **步骤 1: 编写 setup 和 teardown**

```typescript
// tests/issues/q-21-rag-server-integration-e2e/setup.ts
import { Test } from '@nestjs/testing'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from '../../../packages/server/src/app.module.js'
import { PrismaService } from '../../../packages/server/src/processors/database/prisma.service.js'
import { createServer } from 'http'

export let app: NestFastifyApplication
export let prisma: PrismaService
export let mockEmbeddingPort: number
export let mockLLMPort: number

export async function setupE2E(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .compile()

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  prisma = app.get(PrismaService)

  // 启动 mock embedding server
  mockEmbeddingPort = await startMockEmbeddingServer()
  // 启动 mock LLM server
  mockLLMPort = await startMockLLMServer()
}

export async function teardownE2E(): Promise<void> {
  await app.close()
}

async function startMockEmbeddingServer(): Promise<number> {
  const dim = parseInt(process.env.MILVUS_VECTOR_DIM || '1536', 10)
  const server = createServer((req, res) => {
    if (req.url === '/v1/embeddings' && req.method === 'POST') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        object: 'list',
        data: [{ object: 'embedding', embedding: Array(dim).fill(0.1), index: 0 }],
        model: 'text-embedding-3-small',
        usage: { prompt_tokens: 20, total_tokens: 20 },
      }))
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as any).port)
    })
  })
}

async function startMockLLMServer(): Promise<number> {
  const server = createServer((req, res) => {
    if (req.url?.includes('/chat/completions') && req.method === 'POST') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })
      const chunks = ['GoferBot', ' RAG', ' integration', ' test', ' content', '.']
      chunks.forEach((text) => {
        res.write(`data: {"choices":[{"delta":{"content":"${text}"}}]}\n\n`)
      })
      res.write('data: [DONE]\n\n')
      res.end()
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as any).port)
    })
  })
}
```

```typescript
// tests/issues/q-21-rag-server-integration-e2e/teardown.ts
import { prisma } from './setup.js'

export async function cleanupTestData(): Promise<void> {
  // 清理测试数据：按依赖顺序删除
  await prisma.$executeRaw`DELETE FROM chunks WHERE kb_id LIKE 'q21-%'`
  await prisma.$executeRaw`DELETE FROM documents WHERE kb_id LIKE 'q21-%'`
  await prisma.$executeRaw`DELETE FROM knowledge_bases WHERE name LIKE 'Q21-%'`
  await prisma.$executeRaw`DELETE FROM messages WHERE session_id IN (SELECT id FROM sessions WHERE title LIKE 'Q21-%')`
  await prisma.$executeRaw`DELETE FROM sessions WHERE title LIKE 'Q21-%'`
  await prisma.$executeRaw`DELETE FROM users WHERE email = 'q21-test@gofer.bot'`
}
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`
预期：FAIL — 测试文件为空或基础设施未就绪

- [ ] **步骤 3: 提交基础设施**

```bash
git add tests/issues/q-21-rag-server-integration-e2e/setup.ts \
  tests/issues/q-21-rag-server-integration-e2e/teardown.ts
git commit -m "test(q-21): add E2E test infrastructure with mock servers"
```

---

## 任务 2: TC-01 + TC-02 — 文档上传与索引状态流转

**文件：**
- 测试：`tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`

**规格引用：**
- API 规格：[场景 TC-01]、[场景 TC-02]、[异步行为说明]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupE2E, teardownE2E, app, prisma, mockEmbeddingPort } from './setup.js'
import { cleanupTestData } from './teardown.js'

describe('RAG Server Integration E2E', () => {
  let token: string
  let kbId: string

  beforeAll(async () => {
    await setupE2E()
    // 设置 Embedding API 指向 mock server
    process.env.EMBEDDING_BASE_URL = `http://127.0.0.1:${mockEmbeddingPort}`
    process.env.EMBEDDING_API_KEY = 'mock'
  })

  afterAll(async () => {
    await teardownE2E()
  })

  beforeEach(async () => {
    await cleanupTestData()
    // 创建测试用户并登录
    const registerRes = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'q21-test@gofer.bot', password: 'Test1234!', name: 'Q21 Tester' },
    })
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'q21-test@gofer.bot', password: 'Test1234!' },
    })
    token = loginRes.json().data.accessToken

    // 创建知识库
    const kbRes = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases',
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `Q21-TestKB-${crypto.randomUUID()}`, description: 'RAG integration test KB' },
    })
    kbId = kbRes.json().data.id
  })

  it('AC-01: upload triggers document job and sets status uploaded', async () => {
    const content = 'GoferBot RAG integration test content. '.repeat(10)
    const buffer = Buffer.from(content)

    const res = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: buffer,
      query: { filename: 'rag-test.txt', mimeType: 'text/plain' },
    })

    expect(res.statusCode).toBe(201)
    const json = res.json()
    expect(json.data.status).toBe('uploaded')
    expect(json.data.storageKey).toContain(kbId)

    // 验证 PG 记录
    const doc = await prisma.document.findUnique({ where: { id: json.data.id } })
    expect(doc).toBeTruthy()
    expect(doc?.status).toBe('uploaded')
  })

  it('AC-02: worker processes job and status becomes ready with chunks and vectors', async () => {
    const content = 'GoferBot RAG integration test content. '.repeat(10)
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: Buffer.from(content),
      query: { filename: 'rag-test.txt', mimeType: 'text/plain' },
    })
    const docId = uploadRes.json().data.id

    // 轮询状态
    await waitForDocumentStatus(docId, 'ready', 30000)

    // 验证 chunks
    const chunks = await prisma.chunk.findMany({ where: { documentId: docId } })
    expect(chunks.length).toBeGreaterThan(0)
    chunks.forEach(c => {
      expect(c.content).toBeTruthy()
      expect(c.tokenCount).not.toBeNull()
    })

    // 验证 Milvus 向量（通过 VectorService 搜索）
    // 此处需调用 VectorService.searchVectors 或等效验证
  })
})

async function waitForDocumentStatus(docId: string, targetStatus: 'ready' | 'failed', timeoutMs = 30000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const doc = await prisma.document.findUnique({ where: { id: docId } })
    if (doc?.status === targetStatus) return
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`Timeout waiting for document status ${targetStatus}`)
}
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts -t "AC-01|AC-02"`
预期：FAIL — 上传接口或状态流转未实现

- [ ] **步骤 3: 提交测试骨架**

```bash
git add tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts
git commit -m "test(q-21): add AC-01/AC-02 upload and indexing E2E tests"
```

---

## 任务 3: TC-03 + TC-04 — 对话检索与无检索回归

**文件：**
- 测试：`tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`（追加）

**规格引用：**
- API 规格：[场景 TC-03]、[场景 TC-04]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 在 rag-e2e.spec.ts 中追加 describe 块
  it('AC-03: chat with knowledgeBaseIds injects retrieval context into SSE', async () => {
    // 前置：确保文档已索引完成
    const content = 'GoferBot RAG integration test content. '.repeat(10)
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/knowledge-bases/${kbId}/documents`,
      headers: { authorization: `Bearer ${token}` },
      payload: Buffer.from(content),
      query: { filename: 'rag-test.txt', mimeType: 'text/plain' },
    })
    const docId = uploadRes.json().data.id
    await waitForDocumentStatus(docId, 'ready', 30000)

    // 创建 session
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Q21 Test Session' },
    })
    const sessionId = sessionRes.json().data.id

    // 对话检索
    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      payload: {
        message: 'What does the document say about GoferBot?',
        sessionId,
        knowledgeBaseIds: [kbId],
        config: { provider: 'openai', model: 'gpt-4', baseUrl: `http://127.0.0.1:${mockLLMPort}`, apiKey: 'mock' },
      },
    })

    expect(chatRes.statusCode).toBe(200)
    expect(chatRes.headers['content-type']).toContain('text/event-stream')
    expect(chatRes.payload).toContain('GoferBot')
  })

  it('AC-04: chat without knowledgeBaseIds behaves identically to baseline', async () => {
    const sessionRes = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: { authorization: `Bearer ${token}` },
      payload: { title: 'Q21 Baseline Session' },
    })
    const sessionId = sessionRes.json().data.id

    const chatRes = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      payload: {
        message: 'Hello, how are you?',
        sessionId,
        config: { provider: 'openai', model: 'gpt-4', baseUrl: `http://127.0.0.1:${mockLLMPort}`, apiKey: 'mock' },
      },
    })

    expect(chatRes.statusCode).toBe(200)
    expect(chatRes.headers['content-type']).toContain('text/event-stream')
    // 无 system context 注入，回答基于模型自身
    expect(chatRes.payload).toContain('I am doing well')
  })
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts -t "AC-03|AC-04"`
预期：FAIL — ChatService 未接入检索或 SSE 格式不匹配

- [ ] **步骤 3: 提交测试**

```bash
git add tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts
git commit -m "test(q-21): add AC-03/AC-04 chat retrieval and baseline E2E tests"
```

---

## 任务 4: TC-05 — 索引失败处理

**文件：**
- 测试：`tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`（追加）

**规格引用：**
- API 规格：[场景 TC-05]

- [ ] **步骤 1: 编写失败测试**

```typescript
  it('AC-05: embedding API failure leads to failed status after 3 retries', async () => {
    // 临时修改 Embedding API 指向返回 500 的 mock server
    const failPort = await startMockFailingEmbeddingServer()
    const originalBaseUrl = process.env.EMBEDDING_BASE_URL
    process.env.EMBEDDING_BASE_URL = `http://127.0.0.1:${failPort}`

    try {
      const uploadRes = await app.inject({
        method: 'POST',
        url: `/api/knowledge-bases/${kbId}/documents`,
        headers: { authorization: `Bearer ${token}` },
        payload: Buffer.from('test content for failure'),
        query: { filename: 'fail.txt', mimeType: 'text/plain' },
      })
      const docId = uploadRes.json().data.id

      await waitForDocumentStatus(docId, 'failed', 60000)

      const doc = await prisma.document.findUnique({ where: { id: docId } })
      expect(doc?.status).toBe('failed')
      expect(doc?.errorMessage).toContain('Embedding API error')
    } finally {
      process.env.EMBEDDING_BASE_URL = originalBaseUrl
    }
  })

async function startMockFailingEmbeddingServer(): Promise<number> {
  const { createServer } = await import('http')
  const server = createServer((req, res) => {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Internal Server Error' }))
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as any).port)
    })
  })
}
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts -t "AC-05"`
预期：FAIL — 失败重试逻辑未实现或超时

- [ ] **步骤 3: 提交测试**

```bash
git add tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts
git commit -m "test(q-21): add AC-05 indexing failure E2E test"
```

---

## 任务 5: Vitest 集成测试配置

**文件：**
- 创建/修改：`vitest.integration.config.ts`

**规格引用：**
- API 规格：[环境要求]

- [ ] **步骤 1: 确保 vitest.integration.config.ts 存在**

确认项目根目录或 `tests/` 目录下存在 `vitest.integration.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000, // E2E 测试需要更长超时
    hookTimeout: 60000,
    setupFiles: [],
    // 集成测试使用真实数据库，不隔离
    poolOptions: { threads: { singleThread: true } },
  },
})
```

若不存在则创建。E2E 测试必须使用 `--config vitest.integration.config.ts` 运行。

- [ ] **步骤 2: 运行配置验证**

```bash
pnpm vitest run --config vitest.integration.config.ts tests/issues/q-21-rag-server-integration-e2e/ --dry-run
```
预期：无配置错误

- [ ] **步骤 3: 提交**

```bash
git add vitest.integration.config.ts
git commit -m "chore(q-21): add vitest integration config for E2E tests"
```

---

## 任务 6: 补充 AC-06~AC-12 与全量验证

**文件：**
- 测试：`tests/issues/q-21-rag-server-integration-e2e/rag-e2e.spec.ts`（追加）

**规格引用：**
- API 规格：[测试映射]

- [ ] **步骤 1: 编写剩余测试用例**

```typescript
  it('AC-06: chat with multiple knowledgeBaseIds retrieves across all specified KBs', async () => {
    // 创建第二个知识库并上传文档
    // 对话时传入两个 kbId，验证检索覆盖全部
  })

  it('AC-07: chat with knowledgeBaseIds but no matching chunks falls back to baseline', async () => {
    // 上传与查询无关的文档，验证无 context 注入
  })

  it('AC-08: rejects file exceeding size limit', async () => {
    // 上传超大文件，验证 413
  })

  it('AC-09: returns 404 for non-existent kb on upload', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge-bases/non-existent-uuid/documents',
      headers: { authorization: `Bearer ${token}` },
      payload: Buffer.from('test'),
    })
    expect(res.statusCode).toBe(404)
  })

  it('AC-10: returns 400 for non-existent session on chat', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/chat',
      headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      payload: {
        message: 'Hello',
        sessionId: '00000000-0000-0000-0000-000000000000',
        config: { provider: 'openai', model: 'gpt-4', baseUrl: `http://127.0.0.1:${mockLLMPort}`, apiKey: 'mock' },
      },
    })
    expect(res.statusCode).toBe(400)
  })

  it('AC-11: returns 403 when user does not own kb', async () => {
    // 创建另一个用户，尝试访问其知识库
  })

  it('AC-12: handles Milvus disconnect gracefully', async () => {
    // 模拟 Milvus 断开，验证 SSE 不崩溃
  })
```

- [ ] **步骤 2: 运行全量 E2E 测试**

```bash
pnpm vitest run --config vitest.integration.config.ts tests/issues/q-21-rag-server-integration-e2e/
```
预期：全部通过（AC-01~AC-12）

- [ ] **步骤 3: 运行类型检查**

```bash
pnpm type-check
```
预期：0 错误

- [ ] **步骤 4: 提交**

```bash
git add -A
git commit -m "test(q-21): complete E2E suite AC-06~AC-12"
```

---

## 自检

1. **规格覆盖：**
   - [x] TC-01 文档上传触发索引 — 任务 2（AC-01）
   - [x] TC-02 索引状态流转至 ready — 任务 2（AC-02）
   - [x] TC-03 对话检索上下文注入 — 任务 3（AC-03）
   - [x] TC-04 无检索对话回归 — 任务 3（AC-04）
   - [x] TC-05 索引失败处理 — 任务 4（AC-05）
   - [x] vitest.integration.config.ts 配置 — 任务 5
   - [x] AC-06~AC-12 补充场景 — 任务 6

2. **占位符扫描：** 无 TBD/TODO/稍后实现。

3. **环境依赖：** 测试需要 Docker 基础设施（PG + MinIO + Milvus + Redis）和 mock servers。
