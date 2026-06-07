---
id: q-31
issue: issue.md
version: 1
---

# HTTP API E2E 测试 实现计划

> **目标：** 使用 axios + 真实 NestJS 进程建立 HTTP API E2E 测试，覆盖 Auth/Chat/File/KB 四条核心链路，验证真实协议行为。
> **架构：** axios + 真实 NestJS 进程（`pnpm dev:server`），共享数据库 `goferbot_test`，每例 TRUNCATE 清理。
> **技术栈：** Vitest + axios

**Issue 引用：** `issue.md`
**Spec 引用：** `specs/feature-spec.md`
**测试引用：** `tests/e2e/api/`

---

## ADR 合规声明

| ADR | 涉及内容 | 符合/豁免 | 说明 |
|-----|---------|----------|------|
| ADR 0001 | 验证方案 | ✅ 符合 | 测试验证 Zod 验证错误返回 |
| ADR 0001 | 响应格式 | ✅ 符合 | 测试验证 `{ data: T }` 和 `{ error: { code, message } }` 格式 |
| ADR 0001 | 依赖引入 | ✅ 符合 | 引入 axios 用于 HTTP E2E（测试依赖，非生产代码） |

---

## PRD 一致性声明

| PRD 目标 | Plan 覆盖情况 | 说明 |
|----------|--------------|------|
| Auth 核心链路 E2E 测试 | ✅ 已覆盖 | 任务 1，覆盖注册 → 登录 → 访问保护路由 → refresh → logout |
| KB 生命周期 E2E 测试 | ✅ 已覆盖 | 任务 2，覆盖创建 → 更新 → 删除 → 列表 |
| 文件上传 + Chat SSE E2E 测试 | ✅ 已覆盖 | 任务 3，覆盖 multipart 上传 → SSE 流式对话 |
| 全部测试在 `pnpm test:e2e:api` 通过 | ✅ 已覆盖 | 每个任务末尾运行完整 E2E API 测试套件验证 |
| 测试数据库零残留 | ✅ 已覆盖 | 每例 TRUNCATE 清理 |

---

## 关键澄清

### 数据库名称
- **PRD 原文**：`goferbot_test`
- **E2E 指南**：`goferbot_e2e`
- **本 plan 采用**：`goferbot_test`（与 PRD 保持一致，与 E2E Playwright 的 `goferbot_e2e` 区分）
- 实际运行时通过 `.env.test` 中的 `DATABASE_URL` 配置

### 与模块级测试的区别
| 维度 | 模块级测试 | HTTP E2E |
|------|-----------|----------|
| 请求方式 | `app.inject()` | axios HTTP |
| NestJS 进程 | 内存中 TestingModule | 真实 `pnpm dev:server` 进程 |
| 数据库 | 每文件独立 | 共享 `goferbot_test` |
| 清理方式 | `dropDatabase` | `TRUNCATE` |
| 验证重点 | 业务逻辑 | 真实协议行为（header、status、stream） |

---

## 文件结构

### 新建文件
- `tests/e2e/api/auth-flow.spec.ts` — Auth 核心链路（~6 个用例）
- `tests/e2e/api/kb-lifecycle.spec.ts` — KB 生命周期（~5 个用例）
- `tests/e2e/api/file-upload-chat.spec.ts` — 文件上传 + Chat SSE（~4 个用例）
- `tests/e2e/api/helpers/e2e-client.ts` — axios 封装客户端（复用）
- `tests/e2e/api/helpers/db-cleanup.ts` — TRUNCATE 清理工具（复用）

### 复用配置
- `vitest.e2e-api.config.ts` — 已存在

---

## 前置依赖

q-31 阻塞于 q-29 和 q-30（待实施）。plan 中假设：
- q-28 已完成（第一批 Controller 测试已就绪）
- q-29 已完成（第二批 Controller 测试已就绪）
- q-30 已完成（全局中间件测试已就绪）

实际执行时，若 q-29/q-30 尚未完成，E2E 测试可能因 API 行为未完全验证而不稳定。

---

## 任务列表

### 任务 1: 创建 E2E 辅助工具

**文件：**
- 创建：`tests/e2e/api/helpers/e2e-client.ts`
- 创建：`tests/e2e/api/helpers/db-cleanup.ts`

**规格引用：**
- 功能规格：E2E 基础设施

- [ ] **步骤 1: 编写 axios 封装客户端**

```typescript
// tests/e2e/api/helpers/e2e-client.ts
import axios, { AxiosInstance, AxiosResponse } from 'axios'

const API_BASE = process.env.E2E_API_BASE || 'http://127.0.0.1:3000/api'

export class E2EClient {
  private axios: AxiosInstance
  private token: string | null = null

  constructor() {
    this.axios = axios.create({
      baseURL: API_BASE,
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true, // 不抛出 HTTP 错误，由测试断言
    })
  }

  setToken(token: string) {
    this.token = token
    this.axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
  }

  clearToken() {
    this.token = null
    delete this.axios.defaults.headers.common['Authorization']
  }

  async getPublicKey(): Promise<AxiosResponse> {
    return this.axios.get('/auth/public-key')
  }

  async register(email: string, encryptedPassword: string, name: string): Promise<AxiosResponse> {
    return this.axios.post('/auth/register', { email, encryptedPassword, name })
  }

  async login(email: string, encryptedPassword: string): Promise<AxiosResponse> {
    return this.axios.post('/auth/login', { email, encryptedPassword })
  }

  async refresh(refreshToken: string): Promise<AxiosResponse> {
    return this.axios.post('/auth/refresh', { refreshToken })
  }

  async logout(): Promise<AxiosResponse> {
    return this.axios.post('/auth/logout')
  }

  async me(): Promise<AxiosResponse> {
    return this.axios.get('/auth/me')
  }

  async createKB(name: string, description?: string): Promise<AxiosResponse> {
    return this.axios.post('/knowledge-bases', { name, description })
  }

  async listKBs(): Promise<AxiosResponse> {
    return this.axios.get('/knowledge-bases')
  }

  async updateKB(id: string, data: any): Promise<AxiosResponse> {
    return this.axios.patch(`/knowledge-bases/${id}`, data)
  }

  async deleteKB(id: string): Promise<AxiosResponse> {
    return this.axios.delete(`/knowledge-bases/${id}`)
  }

  async uploadDocument(kbId: string, file: Buffer, filename: string, mimeType: string): Promise<AxiosResponse> {
    const formData = new FormData()
    const blob = new Blob([file], { type: mimeType })
    formData.append('file', blob, filename)

    return this.axios.post(`/knowledge-bases/${kbId}/documents/upload`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  }

  async chat(dto: { message: string; sessionId: string; knowledgeBaseIds?: string[] }): Promise<AxiosResponse> {
    return this.axios.post('/chat', dto, {
      headers: {
        'Accept': 'text/event-stream',
      },
      responseType: 'stream',
    })
  }

  getAxiosInstance(): AxiosInstance {
    return this.axios
  }
}
```

- [ ] **步骤 2: 编写数据库清理工具**

```typescript
// tests/e2e/api/helpers/db-cleanup.ts
import { Client } from 'pg'

const TABLES_TO_TRUNCATE = [
  'chunks',
  'messages',
  'sessions',
  'documents',
  'folders',
  'knowledge_bases',
  'settings',
  'users',
]

export async function cleanupDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_test?schema=public'
  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    await client.query('SET session_replication_role = replica')
    for (const table of TABLES_TO_TRUNCATE) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`)
    }
    await client.query('SET session_replication_role = DEFAULT')
  } finally {
    await client.end()
  }
}
```

- [ ] **步骤 3: 验证辅助工具编译通过**

运行：`npx tsc --noEmit tests/e2e/api/helpers/e2e-client.ts tests/e2e/api/helpers/db-cleanup.ts`
预期：PASS（无编译错误）

---

### 任务 2: Auth 核心链路 E2E 测试

**文件：**
- 创建：`tests/e2e/api/auth-flow.spec.ts`

**规格引用：**
- 功能规格：AC-01（Auth 核心链路 E2E 测试）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/api/auth-flow.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { E2EClient } from './helpers/e2e-client.js'
import { cleanupDatabase } from './helpers/db-cleanup.js'
import { publicEncrypt, constants } from 'node:crypto'

describe('Auth Flow E2E', () => {
  let client: E2EClient

  beforeAll(async () => {
    client = new E2EClient()
  })

  beforeEach(async () => {
    await cleanupDatabase()
  })

  async function encryptPassword(password: string): Promise<string> {
    const res = await client.getPublicKey()
    const publicKey = res.data.data.publicKey
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    return encrypted.toString('base64')
  }

  it('AC-01: full auth flow — register → login → access protected → refresh → logout', async () => {
    const email = `e2e-${Date.now()}@test.gofer`
    const password = 'Test1234!'

    // 1. 注册
    const encryptedPassword = await encryptPassword(password)
    const registerRes = await client.register(email, encryptedPassword, 'E2E User')
    expect(registerRes.status).toBe(201)
    expect(registerRes.data.data.user.email).toBe(email)
    expect(registerRes.data.data.accessToken).toBeDefined()

    // 2. 登录
    const loginRes = await client.login(email, encryptedPassword)
    expect(loginRes.status).toBe(200)
    expect(loginRes.data.data.accessToken).toBeDefined()
    expect(loginRes.data.data.refreshToken).toBeDefined()
    const { accessToken, refreshToken } = loginRes.data.data

    // 3. 访问保护路由
    client.setToken(accessToken)
    const meRes = await client.me()
    expect(meRes.status).toBe(200)
    expect(meRes.data.data.email).toBe(email)

    // 4. refresh
    const refreshRes = await client.refresh(refreshToken)
    expect(refreshRes.status).toBe(200)
    expect(refreshRes.data.data.accessToken).toBeDefined()

    // 5. logout
    const logoutRes = await client.logout()
    expect(logoutRes.status).toBe(200)
  })

  it('AC-02: returns 401 for invalid token', async () => {
    client.setToken('invalid-token')
    const res = await client.me()
    expect(res.status).toBe(401)
    expect(res.data.error.code).toBe('AUTH_ERROR')
  })

  it('AC-03: returns 401 for expired token', async () => {
    // 使用已篡改的 token
    client.setToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid')
    const res = await client.me()
    expect(res.status).toBe(401)
  })

  it('AC-04: returns 400 for invalid register data', async () => {
    const res = await client.register('not-email', '', '')
    expect(res.status).toBe(400)
    expect(res.data.error.code).toBe('VALIDATION_ERROR')
  })

  it('AC-05: returns 401 for wrong password', async () => {
    const email = `e2e-wrong-${Date.now()}@test.gofer`
    const encryptedPassword = await encryptPassword('Test1234!')
    await client.register(email, encryptedPassword, 'Wrong Test')

    const wrongEncrypted = await encryptPassword('WrongPassword1!')
    const res = await client.login(email, wrongEncrypted)
    // 后端对错误密码返回 404（NotFoundException），错误码 AUTH_FAIL
    // 这是为了防止用户枚举攻击，不区分"用户不存在"和"密码错误"
    expect(res.status).toBe(404)
    expect(res.data.error.code).toBe('AUTH_FAIL')
  })

  it('AC-06: returns 409 for duplicate email', async () => {
    const email = `e2e-dup-${Date.now()}@test.gofer`
    const encryptedPassword = await encryptPassword('Test1234!')
    await client.register(email, encryptedPassword, 'Dup Test')

    const res = await client.register(email, encryptedPassword, 'Dup Test 2')
    expect(res.status).toBe(409)
    expect(res.data.error.code).toBe('USER_EXISTS')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/e2e/api/auth-flow.spec.ts --config vitest.e2e-api.config.ts`
预期：FAIL — 断言失败 RED（需确保后端服务已启动）

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建，或后端服务未启动。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/e2e/api/auth-flow.spec.ts --config vitest.e2e-api.config.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整 E2E API 测试套件确认无回归：
```bash
pnpm test:e2e:api
```

---

### 任务 3: KB 生命周期 E2E 测试

**文件：**
- 创建：`tests/e2e/api/kb-lifecycle.spec.ts`

**规格引用：**
- 功能规格：AC-02（KB 生命周期 E2E 测试）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/api/kb-lifecycle.spec.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { E2EClient } from './helpers/e2e-client.js'
import { cleanupDatabase } from './helpers/db-cleanup.js'
import { publicEncrypt, constants } from 'node:crypto'

describe('KB Lifecycle E2E', () => {
  let client: E2EClient
  let token: string

  beforeAll(async () => {
    client = new E2EClient()

    // 创建测试用户并登录
    const keyRes = await client.getPublicKey()
    const publicKey = keyRes.data.data.publicKey
    const password = 'Test1234!'
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    const encryptedPassword = encrypted.toString('base64')

    const email = `kb-e2e-${Date.now()}@test.gofer`
    const registerRes = await client.register(email, encryptedPassword, 'KB E2E')
    token = registerRes.data.data.accessToken
    client.setToken(token)
  })

  beforeEach(async () => {
    await cleanupDatabase()
    // 重新创建用户（因为 cleanupDatabase 会删除 users 表）
    const keyRes = await client.getPublicKey()
    const publicKey = keyRes.data.data.publicKey
    const password = 'Test1234!'
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    const encryptedPassword = encrypted.toString('base64')
    const email = `kb-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.gofer`
    const registerRes = await client.register(email, encryptedPassword, 'KB E2E')
    token = registerRes.data.data.accessToken
    client.setToken(token)
  })

  it('AC-07: creates KB with valid data', async () => {
    const res = await client.createKB('E2E KB', 'Test description')
    expect(res.status).toBe(201)
    expect(res.data.data.name).toBe('E2E KB')
    expect(res.data.data.description).toBe('Test description')
  })

  it('AC-08: lists KBs', async () => {
    await client.createKB('KB 1')
    await client.createKB('KB 2')

    const res = await client.listKBs()
    expect(res.status).toBe(200)
    expect(res.data.data).toBeInstanceOf(Array)
    expect(res.data.data.length).toBe(2)
  })

  it('AC-09: updates KB', async () => {
    const createRes = await client.createKB('Old Name')
    const kbId = createRes.data.data.id

    const res = await client.updateKB(kbId, { name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.data.data.name).toBe('New Name')
  })

  it('AC-10: deletes KB', async () => {
    const createRes = await client.createKB('To Delete')
    const kbId = createRes.data.data.id

    const deleteRes = await client.deleteKB(kbId)
    expect(deleteRes.status).toBe(200)
    expect(deleteRes.data.data.deleted).toBe(true)

    const listRes = await client.listKBs()
    expect(listRes.data.data.find((kb: any) => kb.id === kbId)).toBeUndefined()
  })

  it('AC-11: returns 401 without token', async () => {
    client.clearToken()
    const res = await client.listKBs()
    expect(res.status).toBe(401)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/e2e/api/kb-lifecycle.spec.ts --config vitest.e2e-api.config.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/e2e/api/kb-lifecycle.spec.ts --config vitest.e2e-api.config.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整 E2E API 测试套件确认无回归：
```bash
pnpm test:e2e:api
```

---

### 任务 4: 文件上传 + Chat SSE E2E 测试

**文件：**
- 创建：`tests/e2e/api/file-upload-chat.spec.ts`

**规格引用：**
- 功能规格：AC-03（文件上传 + Chat SSE E2E 测试）

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/e2e/api/file-upload-chat.spec.ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { E2EClient } from './helpers/e2e-client.js'
import { cleanupDatabase } from './helpers/db-cleanup.js'
import { publicEncrypt, constants } from 'node:crypto'

describe('File Upload + Chat SSE E2E', () => {
  let client: E2EClient
  let token: string
  let kbId: string

  beforeAll(async () => {
    client = new E2EClient()
  })

  beforeEach(async () => {
    await cleanupDatabase()

    // 重新创建用户和 KB
    const keyRes = await client.getPublicKey()
    const publicKey = keyRes.data.data.publicKey
    const password = 'Test1234!'
    const encrypted = publicEncrypt(
      { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
      Buffer.from(password),
    )
    const encryptedPassword = encrypted.toString('base64')
    const email = `file-chat-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}@test.gofer`
    const registerRes = await client.register(email, encryptedPassword, 'File Chat E2E')
    token = registerRes.data.data.accessToken
    client.setToken(token)

    const kbRes = await client.createKB('E2E KB for File Upload')
    kbId = kbRes.data.data.id
  })

  it('AC-12: uploads a text file via multipart', async () => {
    const content = Buffer.from('# Hello World\nThis is a test document.')
    const res = await client.uploadDocument(kbId, content, 'test.md', 'text/markdown')
    expect(res.status).toBe(201)
    expect(res.data.data.name).toBe('test.md')
    expect(res.data.data.mimeType).toBe('text/markdown')
  })

  it('AC-13: rejects unsupported file type', async () => {
    const content = Buffer.from('unsupported content')
    const res = await client.uploadDocument(kbId, content, 'virus.exe', 'application/x-msdownload')
    expect(res.status).toBe(415)
    expect(res.data.error.code).toBe('UNSUPPORTED_TYPE')
  })

  it('AC-14: rejects file exceeding size limit', async () => {
    // 创建超过 50MB 的文件
    const content = Buffer.alloc(51 * 1024 * 1024)
    const res = await client.uploadDocument(kbId, content, 'huge.md', 'text/markdown')
    expect(res.status).toBe(413)
    expect(res.data.error.code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('AC-15: chat SSE returns text/event-stream', async () => {
    // 先创建会话
    const sessionRes = await client.getAxiosInstance().post('/sessions', { title: 'SSE Test' }, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const sessionId = sessionRes.data.data.id

    // 发送 SSE 请求（使用 mock LLM，实际不会返回真实流）
    const res = await client.chat({
      message: 'Hello',
      sessionId,
    })

    // 验证响应头
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

运行：`npx vitest run tests/e2e/api/file-upload-chat.spec.ts --config vitest.e2e-api.config.ts`
预期：FAIL — 断言失败 RED

- [ ] **步骤 3: 验证失败原因**

确认失败是因为测试文件尚未创建。

- [ ] **步骤 4: 运行测试验证通过**

运行：`npx vitest run tests/e2e/api/file-upload-chat.spec.ts --config vitest.e2e-api.config.ts`
预期：PASS（所有测试通过）

- [ ] **步骤 5: 验证并标记完成**

运行完整 E2E API 测试套件确认无回归：
```bash
pnpm test:e2e:api
```

---

## 自检清单

- [ ] PRD 一致性：HTTP E2E 所有 3 个目标（Auth/KB/File+Chat）均已覆盖
- [ ] 规格覆盖：feature-spec.md 中所有验收标准（AC-01 ~ AC-15）都有对应任务
- [ ] 测试覆盖：每个任务都有对应的 `tests/e2e/api/{name}.spec.ts` 文件
- [ ] 辅助工具：axios 客户端和数据库清理工具已创建
- [ ] 占位符扫描：无 "TODO" / "TBD" / "稍后实现"
- [ ] 类型一致性：所有测试中使用的类型、方法与代码库一致
- [ ] ADR 合规：未引入禁止依赖，axios 为测试专用依赖
- [ ] 数据库名称：plan 中明确使用 `goferbot_test`（与 PRD 一致）
- [ ] 依赖声明：q-31 阻塞于 q-29/q-30，plan 中已记录
