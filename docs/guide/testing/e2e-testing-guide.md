# E2E 测试指南

> 本文档定义 GoferBot 项目 E2E 测试的完整流程、规范与最佳实践。
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
globalSetup (playwright.global-setup.ts):
  1. pnpm infra:up → 启动 Docker 基础设施
  2. 等待 PostgreSQL 就绪
  3. 创建 goferbot_e2e 数据库（若不存在）
  4. pnpm prisma:generate → 确保 Prisma Client 已生成
  5. prisma migrate deploy → 执行 schema 迁移
  6. 启动后端服务（若未运行）→ 等待 /health 就绪

globalTeardown (playwright.global-teardown.ts):
  1. 关闭后端服务（若由 setup 启动）
  2. 清理资源
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

E2E 测试自动加载 `.env.test` 中的变量：

```bash
TEST_DATABASE_ADMIN_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/postgres?schema=public"
DATABASE_URL="postgresql://gofer:gofer_dev_pass@127.0.0.1:5432/goferbot_e2e?schema=public"
```

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
    auth.ts
    database.ts
    api-client.ts
    ...
  mocks/           # Mock 路由
    http-routes.ts
```

### 4.2 文件命名

- `*.spec.ts` — E2E 测试文件（与 issue `q-*` 对齐）
- `*.ts`（大驼峰）— Page Object 类
- `*.ts`（小写）— fixtures、helpers、mocks

### 4.3 用例命名规范

- 必须以 `AC-XX:` 开头，与验收清单的 `id` 对应
- 格式：`AC-XX: {用户行为} {预期结果}`

```typescript
test('AC-01: 聊天页面正常加载（输入框+发送按钮）', async ({ page }) => {})
test('AC-02: 发送消息显示在用户消息列表', async ({ page }) => {})
test('AC-03: SSE 流式响应显示 AI 回复', async ({ page }) => {})
```

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

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.submitButton = page.locator('button:has-text("登录")')
    this.errorMessage = page.locator('[role="alert"]')
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

### 6.1 认证夹具

```typescript
// tests/e2e/fixtures/auth.ts
import { test as base } from '@playwright/test'

export interface TestUser {
  email: string
  password: string
  name: string
  accessToken: string
  refreshToken: string
}

export const test = base.extend<{ testUser: TestUser }>({
  testUser: async ({}, use) => {
    await use({
      email: 'test@example.com',
      password: 'Test123!@#',
      name: 'Test User',
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    })
  },
})
```

### 6.2 Mock API 路由

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
    await authPage.register('newuser@gofer.bot', 'NewPass123!@#')

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
pnpm test:e2e --ui
```

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

# 或检查端口占用
lsof -ti:3000 | xargs kill -9
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
- 测试结束后清理数据（在 `test.afterEach` 中）
- 或使用 `workers: 1` 串行执行（已配置）

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
      - run: pnpm test:e2e
        env:
          TEST_DATABASE_ADMIN_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/postgres?schema=public
          DATABASE_URL: postgresql://gofer:gofer_dev_pass@localhost:5432/goferbot_e2e?schema=public
```
