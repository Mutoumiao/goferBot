# E2E 测试指南

> 本文档定义项目 E2E 测试的完整流程、规范与最佳实践。
> 基于 Playwright，覆盖完整用户旅程，验证前后端联调。

---

## 1. 测试体系概述

### 1.1 测试分层

| 层级 | 范围 | 运行命令 | 配置文件 | 数量 |
|------|------|----------|----------|------|
| 单元测试 | 组件/Store/工具/Service | `pnpm test` | `vitest.config.ts` | 141+ |
| 集成测试 | API + 数据库 | `pnpm test:integration` | `vitest.integration.config.ts` | 113+ |
| E2E 测试 | 完整用户流程 | `pnpm test:e2e` | `playwright.config.ts` | — |

### 1.2 E2E 测试覆盖范围

- **单页面功能** (`tests/e2e/specs/`) — 独立页面功能验证
  - 认证（登录、注册、表单验证）
  - 聊天（消息发送、SSE 流式响应、标签页）
  - 知识库（CRUD、文件管理、选择器）
  - 会话历史（列表、搜索、删除）
  - 设置（主题、语言、持久化）
- **跨模块旅程** (`tests/e2e/flows/`) — 完整用户场景
  - 新用户引导（注册 → 创建知识库 → 上传文档 → 聊天）
  - 会话管理（创建 → 发送消息 → 切换 → 删除）
  - 设置持久化（修改设置 → 刷新页面 → 验证保留）
  - RAG 聊天（@提及知识库 → 检索增强 → 流式回复）

---

## 2. 核心基础设施

### 2.1 测试环境

| 配置项 | 值 | 说明 |
|--------|-----|------|
| 测试框架 | Playwright | 微软出品的 E2E 测试框架 |
| 浏览器 | Chromium | 默认使用桌面 Chrome |
| 基础 URL | `http://localhost:1420` | 前端开发服务器 |
| 后端 URL | `http://127.0.0.1:3000` | NestJS API 服务 |

### 2.2 全局生命周期

```
globalSetup (tests/e2e/playwright.global-setup.ts):
  1. pnpm infra:up → 启动 Docker 基础设施
  2. 等待 PostgreSQL 就绪
  3. 创建 {dbname}_e2e 数据库（若不存在）
  4. pnpm prisma:generate → 确保 Prisma Client 已生成
  5. prisma migrate deploy → 执行 schema 迁移
  6. 启动后端服务（若未运行）→ 等待 /health 就绪
     - Windows: 使用 pnpm.cmd + shell: true
     - Linux/macOS: 使用 pnpm + detached 模式

globalTeardown (tests/e2e/playwright.global-teardown.ts):
  1. 关闭后端服务（若由 setup 启动）
     - Windows: taskkill /PID /T /F
     - Linux/macOS: process.kill(-pid, 'SIGTERM')
  2. CI 模式下执行 pnpm infra:down
  3. 本地模式保持 docker 运行以便复用
```

### 2.3 两种测试模式

| 模式 | 依赖 | 用途 | 典型场景 |
|------|------|------|----------|
| **Mock 模式** | 纯前端，零后端依赖 | UI 渲染、交互状态、前端校验 | 页面元素检查、表单验证、路由跳转 |
| **真实后端模式** | 完整前后端 + 数据库 | 端到端联调、数据持久化验证 | 用户注册 → 登录 → CRUD → 数据查询 |

---

## 3. 环境准备

### 3.1 启动基础设施

```bash
# 启动 PostgreSQL（必需）
pnpm infra:up

# 确认服务健康
docker compose -f docker-compose.dev.yml ps
```

### 3.2 环境变量

E2E 测试通过 `dotenv -e .env.e2e` 加载 `.env.e2e` 文件：

```bash
# .env.e2e
TEST_DATABASE_ADMIN_URL="postgresql://{user}:{password}@{host}:{port}/postgres?schema=public"
DATABASE_URL="postgresql://{user}:{password}@{host}:{port}/{dbname}_e2e?schema=public"
```

> **注意**：E2E 使用独立数据库 `{dbname}_e2e`，避免与集成测试的 `{dbname}_test` 冲突。

### 3.3 前置构建

```bash
# 确保 Prisma Client 已生成
pnpm --filter @goferbot/server prisma:generate

# 确保 rag-sdk 已构建（前端依赖）
pnpm -r build
```

---

## 4. 测试文件规范

### 4.1 文件位置

```
tests/e2e/
  specs/           # 单页面功能测试
    auth.spec.ts
    chat.spec.ts
    knowledge-base.spec.ts
    ...
  flows/           # 跨模块用户旅程
    onboarding-journey.spec.ts
    chat-with-rag.spec.ts
    session-management.spec.ts
    ...
  pages/           # Page Object 模式
    AuthPage.ts
    ChatPage.ts
    KnowledgeBasePage.ts
    ...
  fixtures/        # 测试夹具
    auth.ts          # injectMockToken / injectAuthToken / createTestUser
    database.ts      # cleanupDatabase
    api-client.ts
    ...
  mocks/           # Mock 路由
    http-routes.ts
  debug/           # 临时调试测试（不提交到 git）
  .gstack/         # QA 报告截图
  playwright.config.ts
  playwright.global-setup.ts
  playwright.global-teardown.ts
```

> **debug/** 目录用于临时调试测试，不应提交到 git。如需持久化，移动到 `specs/` 或 `flows/`。

### 4.2 文件命名

- `*.spec.ts` — E2E 测试文件（与 issue `q-*` 对齐）
- `*.ts`（大驼峰）— Page Object 类
- `*.ts`（小写）— fixtures、helpers、mocks

### 4.3 用例命名规范

**`flows/` 目录（Issue 验收测试）**：

- 必须以 `AC-XX:` 开头，与验收清单的 `id` 对应
- 格式：`AC-XX: {用户行为} {预期结果}`

```typescript
// tests/e2e/flows/chat-with-rag.spec.ts
test('AC-01: 聊天页面正常加载（输入框+发送按钮）', async ({ page }) => {})
test('AC-02: 发送消息显示在用户消息列表', async ({ page }) => {})
test('AC-03: SSE 流式响应显示 AI 回复', async ({ page }) => {})
```

**`specs/` 目录（单页面功能测试）**：

- 允许使用描述式命名（无 AC-XX 前缀），用于快速验证页面功能
- 或沿用 `TC-FXX-XXX:` 前缀（与 issue 编号对应）

```typescript
// tests/e2e/specs/auth.spec.ts — 描述式
test('登录页面元素完整', async ({ page }) => {})
test('成功登录后跳转首页', async ({ page }) => {})

// tests/e2e/specs/chat-tabs.spec.ts — TC 前缀
test('TC-F04-001: 初始状态仅显示首页标签', async ({ page }) => {})
test('TC-F04-002: 新建标签创建新会话', async ({ page }) => {})
```

> **规范说明**：`flows/` 目录严格使用 `AC-XX:`（与 checklist.json 对齐），`specs/` 目录允许描述式或 `TC-` 前缀（历史遗留，逐步迁移至 AC-XX）。

---

## 5. Page Object 模式

### 5.1 设计原则

- 每个页面对应一个 `*Page` 类
- 封装页面元素定位（locator）和交互方法
- 测试用例中不直接写 `page.locator(...)`，而是通过 Page Object 调用

### 5.2 示例：AuthPage

```typescript
import type { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly registerLink: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.submitButton = page.locator('button:has-text("登录")')
    this.errorMessage = page.locator('[role="alert"]')
    this.registerLink = page.locator('text=立即注册')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }

  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) ?? ''
  }
}

export class RegisterPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly loginLink: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.confirmPasswordInput = page.locator('#confirmPassword')
    this.submitButton = page.locator('button:has-text("注册")')
    this.errorMessage = page.locator('[role="alert"]')
    this.loginLink = page.locator('text=去登录')
  }

  async goto() {
    await this.page.goto('/register')
  }

  async register(email: string, password: string, confirmPassword?: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    if (confirmPassword) {
      await this.confirmPasswordInput.fill(confirmPassword)
    }
    await this.submitButton.click()
  }

  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) ?? ''
  }
}

export class AuthPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly nameInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('input[type="email"], input[name="email"]').first()
    this.passwordInput = page.locator('input[type="password"]').nth(0)
    this.confirmPasswordInput = page.locator('input[type="password"]').nth(1)
    this.nameInput = page.locator('input[name="name"], input#name').first()
    this.submitButton = page.locator('button[type="submit"]').first()
    this.errorMessage = page.locator('[role="alert"]').first()
  }

  async gotoRegister() {
    await this.page.goto('/register')
    await this.page.waitForLoadState('load')
  }

  async gotoLogin() {
    await this.page.goto('/login')
    await this.page.waitForLoadState('load')
  }

  async register(email: string, password: string, confirmPassword?: string) {
    if (await this.nameInput.isVisible().catch(() => false)) {
      await this.nameInput.fill('E2E User')
    }
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    if (confirmPassword !== undefined) {
      await this.confirmPasswordInput.fill(confirmPassword)
    }
    await this.submitButton.click()
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
```

### 5.3 在测试中使用

```typescript
import { test, expect } from '@playwright/test'
import { LoginPage } from '../pages/AuthPage'

test.describe('认证流程', () => {
  test('成功登录后跳转首页', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('test@example.com', 'Test123!@#')

    await expect(page).toHaveURL('/app/chat')
  })
})
```

---

## 6. Fixtures（测试夹具）

### 6.1 Mock 模式：injectMockToken

纯前端 mock，零后端依赖。向 localStorage 注入假 token：

```typescript
// tests/e2e/fixtures/auth.ts
export async function injectMockToken(page: Page): Promise<void> {
  await page.addInitScript({
    content: `
      try {
        localStorage.setItem('{tokenKey}_access_token', 'mock-access-token-12345')
        localStorage.setItem('{tokenKey}_refresh_token', 'mock-refresh-token-67890')
      } catch (e) {}
    `,
  })
}
```

配合 `mockAuthApi()` 使用（mock `/api/auth/me` 等路由）：

```typescript
import { test, expect } from '@playwright/test'
import { injectMockToken, mockAuthApi } from '../fixtures/auth'

test.beforeEach(async ({ page }) => {
  await injectMockToken(page)
  await mockAuthApi(page)
})
```

### 6.2 真实后端模式：createTestUser / injectAuthToken

通过真实 API 注册用户，验证完整链路：

```typescript
import { createTestUser, injectAuthToken } from '../fixtures/auth'

test('AC-01: 真实注册后登录', async ({ page }) => {
  // 通过真实 API 创建用户（自动处理 RSA 加密）
  const user = await createTestUser()

  // 将真实 token 注入 localStorage
  await injectAuthToken(page, user.accessToken)

  await page.goto('/app/chat')
  await expect(page).toHaveURL('/app/chat')
})
```

**关键工具说明**：
- `createTestUser()`：调用真实注册/登录 API，自动获取公钥、加密密码
- `injectAuthToken(page, token?)`：将 token 写入 localStorage；不传 token 时自动调用 `createTestUser()`
- `isBackendAvailable()`：检测后端是否运行（结果缓存，避免重复请求触发限流）
- `resetBackendAvailability()`：重置缓存（环境切换时调用）

### 6.3 数据清理：cleanupDatabase

E2E 测试间共享数据库，使用 `cleanupDatabase()` 清理数据：

```typescript
import { cleanupDatabase } from '../fixtures/database'

test.afterEach(async () => {
  await cleanupDatabase()  // TRUNCATE 所有业务表
})
```

清理的表包括：`chunks`, `messages`, `sessions`, `documents`, `folders`, `knowledge_bases`, `settings`, `users`。

### 6.4 Mock API 路由

```typescript
// tests/e2e/mocks/http-routes.ts
export async function mockApiRoutes(page: Page) {
  await page.route('**/api/**', (route) => {
    // 默认放行真实请求
    route.continue()
  })
}

export async function mockAuthApi(page: Page) {
  await page.route('**/api/auth/login', (route) => {
    route.fulfill({
      status: 200,
      json: {
        data: {
          accessToken: 'mock-token',
          refreshToken: 'mock-refresh',
          user: { id: '1', email: 'test@example.com', name: 'Test' },
        },
      },
    })
  })
}
```

---

## 7. 标准测试模板

### 7.1 Mock 模式（纯 UI 测试）

```typescript
import { test, expect } from '@playwright/test'
import { mockAuthApi } from '../fixtures/auth'
import { LoginPage } from '../pages/AuthPage'

test.describe('登录页面', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page)
  })

  test('AC-01: 页面元素完整', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
  })

  test('AC-02: 登录成功跳转首页', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('test@example.com', 'Test123!@#')

    await expect(page).toHaveURL('/app/chat')
  })
})
```

### 7.2 真实后端模式（端到端联调）

```typescript
import { test, expect } from '@playwright/test'
import { AuthPage } from '../pages/AuthPage'
import { KnowledgeBasePage } from '../pages/KnowledgeBasePage'

test.describe('新用户引导流程', () => {
  test('AC-01: 注册 → 创建知识库 → 上传文档', async ({ page }) => {
    const authPage = new AuthPage(page)
    const kbPage = new KnowledgeBasePage(page)

    // Given: 用户注册
    await authPage.gotoRegister()
    await authPage.register('newuser@example.com', 'NewPass123!@#')

    // When: 创建知识库
    await kbPage.goto()
    await kbPage.createKb('My First KB')

    // Then: 知识库出现在列表
    await expect(kbPage.listItem('My First KB')).toBeVisible()
  })
})
```

---

## 8. 必备用例清单

每个新页面/流程至少覆盖以下场景：

| 场景 | 必测 | 说明 |
|------|------|------|
| 页面元素完整 | 是 | 核心元素可见、可交互 |
| 正常路径（happy path） | 是 | 核心功能流程 |
| 表单验证错误 | 是 | 必填字段、格式校验 |
| 空状态 | 视情况 | 列表为空、无数据 |
| 加载状态 | 视情况 | loading 指示器 |
| 错误状态 | 视情况 | 网络错误、服务端错误 |
| 响应式布局 | 视情况 | 移动端适配 |

---

## 9. 运行测试

### 9.1 全部 E2E 测试

```bash
pnpm test:e2e
```

### 9.2 UI 模式（可调试）

```bash
pnpm test:e2e:ui
```

> 注意：`pnpm test:e2e --ui` 与 `pnpm test:e2e:ui` 不等价。后者是 package.json 中定义的脚本，使用 `dotenv -e .env.e2e` 加载环境变量。

### 9.3 单个测试文件

```bash
pnpx playwright test tests/e2e/specs/auth.spec.ts
```

### 9.4 单个测试用例

```bash
pnpx playwright test tests/e2e/specs/auth.spec.ts -g "AC-01"
```

### 9.5 只运行 specs 或 flows

```bash
# 单页面功能
pnpx playwright test tests/e2e/specs/

# 用户旅程
pnpx playwright test tests/e2e/flows/
```

---

## 10. 配置说明

### 10.1 playwright.config.ts

```typescript
import { defineConfig, devices } from '@playwright/test'
import path from 'path'

export default defineConfig({
  testDir: path.resolve(__dirname, './specs'),
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
  webServer: [
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:1420',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        ...process.env,
        NO_COLOR: '',
      },
    },
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-flows',
      testDir: path.resolve(__dirname, './flows'),
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
```

**关键配置说明：**

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `workers: 1` | 串行执行 | 避免数据库状态冲突 |
| `retries: 2` (CI) | 失败重试 | CI 环境不稳定时自动重试 |
| `trace: 'on-first-retry'` | 追踪 | 失败时记录详细追踪信息 |
| `screenshot: 'only-on-failure'` | 截图 | 失败时自动截图 |
| `webServer` | 自动启动前端 | 测试前自动启动 `pnpm dev:web` |

---

## 11. 常见问题

### 11.1 后端服务未启动

**原因**：`globalSetup` 未能启动后端，或端口被占用。
**解决**：

```bash
# 手动启动后端
pnpm dev:server

# 或检查端口占用（Linux/macOS）
lsof -ti:3000 | xargs kill -9

# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### 11.2 数据库迁移失败

**原因**：schema 变更后未重新生成 Prisma Client。
**解决**：

```bash
pnpm --filter @goferbot/server prisma:generate
```

### 11.3 测试间数据污染

**原因**：E2E 测试共享同一个数据库。
**解决**：
- 每个 `test.describe` 使用独立用户/数据
- 测试结束后清理数据（在 `test.afterEach` 中调用 `cleanupDatabase()`）
- 使用 `workers: 1` 串行执行（已配置）

```typescript
import { cleanupDatabase } from '../fixtures/database'

test.afterEach(async () => {
  await cleanupDatabase()
})
```

### 11.4 前端页面加载超时

**原因**：`pnpm dev:web` 首次启动较慢。
**解决**：增加 `webServer.timeout` 或预先启动前端。

### 11.5 Mock 路由未生效

**原因**：路由匹配模式不正确，或请求已发出后才设置 mock。
**解决**：确保在 `page.goto()` 之前调用 `page.route()`。

---

## 12. CI/CD 集成

```yaml
# .github/workflows/e2e.yml 示例
jobs:
  e2e:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: {user}
          POSTGRES_PASSWORD: {password}
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
      - run: pnpm test:e2e
        env:
          TEST_DATABASE_ADMIN_URL: postgresql://{user}:{password}@localhost:5432/postgres?schema=public
          DATABASE_URL: postgresql://{user}:{password}@localhost:5432/{dbname}_e2e?schema=public
```
