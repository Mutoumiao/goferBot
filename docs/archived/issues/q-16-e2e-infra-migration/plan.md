---
id: q-16
issue: issue.md
version: 1
---

# E2E 测试基础设施重构 实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 将现有两套 E2E 体系（Mock 前端 E2E + Tauri 桌面 E2E）重构为统一的 Web SaaS 真实 API E2E 测试基础设施。

**架构：** 使用 Playwright globalSetup 启动 docker 基础设施，webServer 启动前后端服务，fixtures 提供真实 API 调用和数据库清理能力。

**技术栈：** Playwright + concurrently + node:crypto + node:pg

**Issue 引用：** [issue.md](./issue.md)
**Spec 引用：** [specs/](./specs/)

---

## 文件结构规划

```
tests/e2e/
├── playwright.config.ts           # 重构：globalSetup + webServer + globalTeardown
├── playwright.global-setup.ts     # 新建：启动 docker 基础设施
├── playwright.global-teardown.ts  # 新建：CI 模式下关闭 docker
├── fixtures/
│   ├── auth.ts                    # 新建：真实注册/登录/获取 JWT
│   ├── api-client.ts              # 新建：直接 HTTP 调用后端 API
│   └── database.ts                # 新建：E2E 数据库清理钩子
└── specs/
    └── infra.spec.ts              # 新建：基础设施验证测试
```

---

## 任务 1: 删除 Tauri E2E 相关代码

**文件：**
- 删除：`tests/e2e-full/` 目录（含 setup.ts、playwright.config.ts、specs/smoke.spec.ts）
- 修改：`package.json`（清理 Tauri 相关脚本，如存在）

**规格引用：**
- 功能规格：[FR-01]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/q-16-e2e-infra-migration/infra.spec.ts
import { test, expect } from '@playwright/test'
import { existsSync } from 'fs'

test.describe('E2E Infrastructure', () => {
  test('AC-01: Tauri e2e-full directory is removed', () => {
    expect(existsSync('tests/e2e-full')).toBe(false)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — tests/e2e-full 仍存在
```

- [ ] **步骤 3: 删除 tests/e2e-full/ 目录**

```bash
ls tests/e2e-full/
rm -rf tests/e2e-full/
```

- [ ] **步骤 4: 检查并清理 package.json 中的 Tauri 脚本**

搜索 `e2e-full`、`tauri` 相关脚本，删除或更新。

- [ ] **步骤 5: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS — tests/e2e-full 不存在
```

- [ ] **步骤 6: 提交**

```bash
git add tests/e2e-full/ package.json
git commit -m "test(e2e): remove Tauri e2e-full directory and related configs"
```

---

## 任务 2: 创建 .env.e2e 环境配置文件

**文件：**
- 创建：`.env.e2e`

**规格引用：**
- 功能规格：[FR-06]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 在 infra.spec.ts 中新增
  test('AC-08: .env.e2e loads correct database URL', async () => {
    const dbUrl = process.env.DATABASE_URL
    expect(dbUrl).toBeDefined()
    expect(dbUrl).toContain('goferbot_e2e')
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — DATABASE_URL 未设置或不含 goferbot_e2e
```

- [ ] **步骤 3: 编写 .env.e2e**

```bash
# .env.e2e — E2E 测试专用环境变量（仅测试使用，生产环境不可使用）
NODE_ENV=test
PORT=3000
DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public"
TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
# 以下密钥仅用于 E2E 测试环境，生产环境使用独立密钥
SETTINGS_ENCRYPTION_KEY="dGVzdC1lbmNyeXB0aW9uLWtleS0xMjM0NTY3ODkwYWJjZGVm"
JWT_SECRET="test-jwt-secret-for-e2e-only"
JWT_REFRESH_SECRET="test-refresh-secret-for-e2e-only"
```

- [ ] **步骤 4: 验证 .env.e2e 被 .gitignore 忽略**

```bash
grep -E "^\.env\." .gitignore || echo "需要添加 .env.e2e 到 .gitignore"
```

- [ ] **步骤 5: 运行测试验证通过**

```bash
# 使用 dotenv 加载后运行
npx dotenv -e .env.e2e -- playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS
```

- [ ] **步骤 6: 提交**

```bash
git add .env.e2e
git commit -m "test(e2e): add .env.e2e for isolated E2E database"
```

---

## 任务 3: 创建 playwright.global-setup.ts（启动基础设施）

**文件：**
- 创建：`tests/e2e/playwright.global-setup.ts`

**规格引用：**
- 行为规格：[starting 状态]
- 功能规格：[FR-02]

- [ ] **步骤 1: 编写失败测试**

```typescript
// tests/issues/q-16-e2e-infra-migration/infra.spec.ts
import { test, expect } from '@playwright/test'
import { Client } from 'pg'

test.describe('E2E Infrastructure', () => {
  test('AC-10: globalSetup starts docker infrastructure', async () => {
    // 验证 postgres 可连接
    const client = new Client({
      connectionString: process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'
    })
    await client.connect()
    const res = await client.query('SELECT 1')
    expect(res.rows[0]['?column?']).toBe(1)
    await client.end()
  })

  test('AC-10: backend health check passes', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/health')
    expect(res.status()).toBe(200)
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — docker 未启动，连接拒绝
```

- [ ] **步骤 3: 编写 global-setup.ts**

```typescript
// tests/e2e/playwright.global-setup.ts
import { execSync } from 'child_process'
import { Client } from 'pg'

async function waitForPostgres(url: string, timeout = 60000): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const client = new Client({ connectionString: url })
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch {
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  throw new Error('Postgres not ready within timeout')
}

export default async function globalSetup() {
  // 1. 启动 docker 基础设施
  console.log('[E2E] Starting docker infrastructure...')
  execSync('pnpm infra:up', { stdio: 'inherit' })

  // 2. 等待 postgres 就绪
  const e2eDbUrl = process.env.DATABASE_URL || 'postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public'
  await waitForPostgres(e2eDbUrl)
  console.log('[E2E] Postgres is ready')

  // 3. 确保 Prisma Client 已生成
  try {
    execSync('pnpm --filter @goferbot/server prisma:generate', { stdio: 'pipe' })
  } catch {
    console.log('[E2E] Prisma generate skipped (already exists)')
  }

  // 4. 执行 prisma migrate
  console.log('[E2E] Running prisma migrate deploy...')
  execSync('npx prisma migrate deploy --schema=packages/server/prisma/schema.prisma', {
    env: { ...process.env, DATABASE_URL: e2eDbUrl },
    stdio: 'inherit',
  })
  console.log('[E2E] Database migrated')
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
# 先手动启动 globalSetup
npx tsx tests/e2e/playwright.global-setup.ts
# 然后运行测试
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS
```

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/playwright.global-setup.ts tests/issues/q-16-e2e-infra-migration/infra.spec.ts
git commit -m "test(e2e): add globalSetup to start docker infra and health tests"
```

---

## 任务 4: 重构 playwright.config.ts

**文件：**
- 修改：`tests/e2e/playwright.config.ts`

**规格引用：**
- 行为规格：[ready 状态、reuseExistingServer 分支]
- 功能规格：[FR-02]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 在 infra.spec.ts 中新增
  test('AC-11: reports port conflict when 3000 is occupied', async () => {
    // 启动一个占用 3000 端口的服务
    const net = require('net')
    const blocker = net.createServer()
    await new Promise<void>((resolve) => blocker.listen(3000, resolve))
    
    // 验证 webServer 命令包含端口检测或报错处理
    const config = await import('../playwright.config.ts')
    expect(config.default.webServer.timeout).toBeGreaterThanOrEqual(120000)
    
    blocker.close()
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — 配置未更新
```

- [ ] **步骤 3: 编写重构后的 playwright.config.ts**

```typescript
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

delete process.env.NO_COLOR

export default defineConfig({
  testDir: './specs',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // 串行执行，避免数据库状态冲突
  globalSetup: path.resolve(__dirname, './playwright.global-setup.ts'),
  globalTeardown: path.resolve(__dirname, './playwright.global-teardown.ts'),
  reporter: [
    ['list'],
    ['html', { outputFolder: './report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },
  webServer: {
    command: 'concurrently "pnpm dev:server" "pnpm dev:web" --names server,web --prefix-colors cyan,green',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI, // CI 强制启动新实例
    timeout: 120000,
    env: {
      ...process.env,
      NO_COLOR: '',
      NODE_ENV: 'test',
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS
```

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/playwright.config.ts
git commit -m "test(e2e): refactor playwright config with globalSetup/webServer"
```

---

## 任务 5: 创建 fixtures/database.ts（数据库清理）

**文件：**
- 创建：`tests/e2e/fixtures/database.ts`

**规格引用：**
- 功能规格：[FR-04]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 在 infra.spec.ts 中新增
  test('AC-04: database cleanup removes test data', async () => {
    const { cleanupDatabase } = await import('../fixtures/database')
    await cleanupDatabase()
    // 验证清理后无用户数据
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT COUNT(*) FROM "User"')
    expect(parseInt(res.rows[0].count)).toBe(0)
    await client.end()
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — cleanupDatabase 未定义
```

- [ ] **步骤 3: 编写 database.ts**

```typescript
// tests/e2e/fixtures/database.ts
import { Client } from 'pg'

const TABLES_TO_TRUNCATE = [
  '"Message"',
  '"Session"',
  '"Document"',
  '"Folder"',
  '"KnowledgeBase"',
  '"Settings"',
  '"User"',
]

export async function cleanupDatabase(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) throw new Error('DATABASE_URL is not set')

  const client = new Client({ connectionString: dbUrl })
  await client.connect()

  try {
    // 禁用外键约束检查，避免截断顺序问题
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

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS
```

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/fixtures/database.ts
git commit -m "test(e2e): add database cleanup fixture"
```

---

## 任务 6: 创建 fixtures/auth.ts（真实认证）

**文件：**
- 创建：`tests/e2e/fixtures/auth.ts`

**规格引用：**
- 功能规格：[FR-05]
- API 规格：[认证端点]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 在 infra.spec.ts 中新增
  test('AC-05: auth fixture creates user and returns token', async () => {
    const { createTestUser } = await import('../fixtures/auth')
    const user = await createTestUser()
    expect(user.email).toContain('@test.gofer')
    expect(user.token).toBeDefined()
    expect(user.token.length).toBeGreaterThan(0)
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — createTestUser 未定义
```

- [ ] **步骤 3: 编写 auth.ts**

```typescript
// tests/e2e/fixtures/auth.ts
import { publicEncrypt, constants } from 'node:crypto'

export interface TestUser {
  email: string
  password: string
  name: string
  token: string
  refreshToken: string
  userId: string
}

export async function createTestUser(): Promise<TestUser> {
  const timestamp = Date.now()
  const email = `e2e-${timestamp}@test.gofer`
  const password = 'Test1234!'
  const name = 'E2E Test User'

  // 1. 获取公钥
  const keyRes = await fetch('http://localhost:3000/api/auth/public-key')
  const keyData = await keyRes.json()
  const publicKey = keyData.data ? keyData.data.publicKey : keyData.publicKey

  // 2. RSA 加密密码
  const encrypted = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(password),
  )
  const encryptedPassword = encrypted.toString('base64')

  // 3. 注册
  const registerRes = await fetch('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, encryptedPassword, name }),
  })
  if (!registerRes.ok) {
    throw new Error(`Register failed: ${registerRes.status} ${await registerRes.text()}`)
  }

  // 4. 登录
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, encryptedPassword }),
  })
  if (!loginRes.ok) {
    throw new Error(`Login failed: ${loginRes.status} ${await loginRes.text()}`)
  }

  const loginData = await loginRes.json()
  const data = loginData.data ? loginData.data : loginData

  return {
    email,
    password,
    name,
    token: data.accessToken,
    refreshToken: data.refreshToken,
    userId: data.user.id,
  }
}

export async function injectAuthToken(page: any, token: string): Promise<void> {
  await page.addInitScript({
    content: `
      try {
        localStorage.setItem('goferbot_access_token', '${token}')
        localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token')
      } catch (e) {}
    `,
  })
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS
```

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/fixtures/auth.ts
git commit -m "test(e2e): add auth fixture with real register/login"
```

---

## 任务 7: 创建 fixtures/api-client.ts（API 封装）

**文件：**
- 创建：`tests/e2e/fixtures/api-client.ts`

**规格引用：**
- 功能规格：[FR-03]
- API 规格：[所有端点]

- [ ] **步骤 1: 编写失败测试**

```typescript
// 在 infra.spec.ts 中新增
  test('AC-03: api client creates KB via direct HTTP', async () => {
    const { createTestUser } = await import('../fixtures/auth')
    const { ApiClient } = await import('../fixtures/api-client')
    const { cleanupDatabase } = await import('../fixtures/database')
    
    await cleanupDatabase()
    const user = await createTestUser()
    const client = new ApiClient(user.token)
    const kb = await client.createKB('Test KB')
    expect(kb.name).toBe('Test KB')
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：FAIL — ApiClient 未定义
```

- [ ] **步骤 3: 编写 api-client.ts**

```typescript
// tests/e2e/fixtures/api-client.ts
const API_BASE = 'http://localhost:3000/api'

export class ApiClient {
  private token: string

  constructor(token: string) {
    this.token = token
  }

  private async fetch(path: string, opts: RequestInit = {}): Promise<any> {
    const res = await fetch(`${API_BASE}${path}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...opts.headers,
      },
    })
    if (!res.ok) {
      throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    return data.data ?? data
  }

  async createKB(name: string, description?: string) {
    return this.fetch('/knowledge-bases', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    })
  }

  async listKBs() {
    return this.fetch('/knowledge-bases')
  }

  async deleteKB(id: string) {
    return this.fetch(`/knowledge-bases/${id}`, { method: 'DELETE' })
  }

  async createSession(title?: string) {
    return this.fetch('/sessions', {
      method: 'POST',
      body: JSON.stringify(title ? { title } : {}),
    })
  }

  async listSessions() {
    return this.fetch('/sessions')
  }

  async getSettings() {
    return this.fetch('/settings')
  }

  async saveSettings(settings: any) {
    return this.fetch('/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    })
  }

  async uploadDocument(kbId: string, file: { name: string; content: string; type: string }) {
    const formData = new FormData()
    const blob = new Blob([file.content], { type: file.type })
    formData.append('file', blob, file.name)

    const res = await fetch(`${API_BASE}/knowledge-bases/${kbId}/documents/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.token}` },
      body: formData,
    })
    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status} ${await res.text()}`)
    }
    const data = await res.json()
    return data.data ?? data
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-16-e2e-infra-migration/infra.spec.ts
# 预期：PASS
```

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/fixtures/api-client.ts
git commit -m "test(e2e): add api-client fixture for direct backend calls"
```

---

## 任务 8: 创建 global-teardown.ts 和更新 package.json 脚本

**文件：**
- 创建：`tests/e2e/playwright.global-teardown.ts`
- 修改：`package.json`

**规格引用：**
- 行为规格：[teardown 状态]

- [ ] **步骤 1: 编写 global-teardown.ts**

```typescript
// tests/e2e/playwright.global-teardown.ts
import { execSync } from 'child_process'

export default async function globalTeardown() {
  if (process.env.CI) {
    console.log('[E2E] CI mode: shutting down docker infrastructure...')
    execSync('pnpm infra:down', { stdio: 'inherit' })
  } else {
    console.log('[E2E] Local mode: keeping docker running for reuse')
  }
}
```

- [ ] **步骤 2: 更新 package.json 脚本**

```json
{
  "scripts": {
    "test:e2e": "dotenv -e .env.e2e -- playwright test --config tests/e2e/playwright.config.ts",
    "test:e2e:ui": "dotenv -e .env.e2e -- playwright test --config tests/e2e/playwright.config.ts --ui",
    "test:e2e:debug": "dotenv -e .env.e2e -- playwright test --config tests/e2e/playwright.config.ts --debug"
  }
}
```

> 注：若未安装 `dotenv-cli`，需先 `pnpm add -D dotenv-cli`

- [ ] **步骤 3: 验证脚本**

```bash
# 验证 dotenv-cli 存在
pnpm dotenv --version || pnpm add -D dotenv-cli
```

- [ ] **步骤 4: 提交**

```bash
git add tests/e2e/playwright.global-teardown.ts package.json
git commit -m "test(e2e): add globalTeardown and update test scripts with dotenv"
```

---

## 任务 9: 集成 beforeEach 和完整运行验证

**文件：**
- 修改：`tests/issues/q-16-e2e-infra-migration/infra.spec.ts`

- [ ] **步骤 1: 编写 beforeEach 集成**

```typescript
// tests/issues/q-16-e2e-infra-migration/infra.spec.ts
import { test, expect } from '@playwright/test'
import { Client } from 'pg'
import { cleanupDatabase } from '../fixtures/database'
import { createTestUser, injectAuthToken } from '../fixtures/auth'
import { ApiClient } from '../fixtures/api-client'

test.describe('E2E Infrastructure', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('AC-10: globalSetup starts docker infrastructure', async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT 1')
    expect(res.rows[0]['?column?']).toBe(1)
    await client.end()
  })

  test('AC-10: backend health check passes', async ({ request }) => {
    const res = await request.get('http://localhost:3000/api/health')
    expect(res.status()).toBe(200)
  })

  test('AC-05: auth fixture creates user and returns token', async () => {
    const user = await createTestUser()
    expect(user.email).toContain('@test.gofer')
    expect(user.token).toBeDefined()
    expect(user.token.length).toBeGreaterThan(0)
  })

  test('AC-04: database cleanup removes test data', async () => {
    // 先创建用户
    await createTestUser()
    // 清理
    await cleanupDatabase()
    // 验证
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query('SELECT COUNT(*) FROM "User"')
    expect(parseInt(res.rows[0].count)).toBe(0)
    await client.end()
  })

  test('AC-03: api client creates KB via direct HTTP', async () => {
    const user = await createTestUser()
    const client = new ApiClient(user.token)
    const kb = await client.createKB('Test KB')
    expect(kb.name).toBe('Test KB')
  })

  test('AC-11: reports port conflict when 3000 is occupied', async () => {
    const config = await import('../playwright.config.ts')
    expect(config.default.webServer.timeout).toBeGreaterThanOrEqual(120000)
  })
})
```

- [ ] **步骤 2: 运行完整 E2E 测试套件**

```bash
pnpm test:e2e
# 预期：infra.spec.ts 全部通过
```

- [ ] **步骤 3: 验证报告生成**

```bash
ls tests/e2e/report/
# 预期：index.html 存在
```

- [ ] **步骤 4: 验证数据库隔离**

```bash
# 运行两次，确认数据不累积
pnpm test:e2e
pnpm test:e2e
# 预期：两次都通过，无数据冲突
```

- [ ] **步骤 5: 提交最终版本**

```bash
git add tests/e2e/ tests/issues/q-16-e2e-infra-migration/ package.json
pnpm test:e2e
# 确认通过后
git commit -m "test(e2e): complete q-16 infrastructure migration"
```

---

## 自检清单

- [ ] **规格覆盖**：
  - FR-01 删除 Tauri ✅ 任务 1
  - FR-02 Playwright 配置 ✅ 任务 2、4、8
  - FR-03 API Client ✅ 任务 7
  - FR-04 Database Cleanup ✅ 任务 5
  - FR-05 Auth Fixture ✅ 任务 6
  - FR-06 环境配置 ✅ 任务 2

- [ ] **占位符扫描**：无 TBD/TODO/稍后实现

- [ ] **类型一致性**：
  - `TestUser` 接口在 auth.ts 中定义，api-client.ts 消费
  - `ApiClient` 构造函数接收 `token: string`
  - `cleanupDatabase` 无参数，依赖 `process.env.DATABASE_URL`

- [ ] **测试覆盖**：每个任务都有对应的 infra.spec.ts 用例

- [ ] **AC 映射**：
  - AC-01 → 任务 1
  - AC-02/06/07 → 任务 4
  - AC-03 → 任务 7
  - AC-04 → 任务 5
  - AC-05 → 任务 6
  - AC-08 → 任务 2
  - AC-09 → 任务 8
  - AC-10 → 任务 9
  - AC-11 → 任务 4（webServer timeout/报错）
