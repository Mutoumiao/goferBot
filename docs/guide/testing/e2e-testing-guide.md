# E2E 测试指南

> Playwright 浏览器端到端测试。验证完整用户旅程，前后端联调。

## 1. 核心约束

| 规则 | 说明 |
|------|------|
| **文件位置** | `tests/e2e/specs/`（单页面）/ `tests/e2e/flows/`（跨模块旅程） |
| **Page Object** | 封装在 `tests/e2e/pages/`，测试用例不直接写 `page.locator()` |
| **两种模式** | Mock（纯 UI，零后端依赖）/ 真实后端（完整联调） |
| **数据库** | 使用独立 DB `{dbname}_e2e`，测试后 TRUNCATE |
| **并发** | `workers: 1`，串行执行，避免 DB 冲突 |
| **用例命名** | `flows/` 用 `AC-XX:`，`specs/` 可用描述式或 `TC-` |

## 2. 环境

| 配置项 | 值 |
|--------|-----|
| 框架 | Playwright + Chromium |
| 前端 URL | `http://localhost:1420` |
| 后端 URL | `http://127.0.0.1:3000` |
| 数据库 | `{dbname}_e2e`（独立于集成测试的 `_test`） |

**全局生命周期**：`globalSetup` 启动 Docker + 迁移 DB → 启动前后端 → `globalTeardown` 清理 DB + 关闭服务。

## 3. Page Object 模式

```ts
// tests/e2e/pages/AuthPage.ts
import type { Page, Locator } from '@playwright/test'

export class AuthPage {
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator

  constructor(readonly page: Page) {
    this.emailInput = page.locator('input[type="email"]').first()
    this.passwordInput = page.locator('input[type="password"]').nth(0)
    this.submitButton = page.locator('button[type="submit"]').first()
  }

  async gotoLogin() { await this.page.goto('/login'); await this.page.waitForLoadState('load') }
  async gotoRegister() { await this.page.goto('/register'); await this.page.waitForLoadState('load') }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}
```

```ts
// 在测试中使用
import { test, expect } from '@playwright/test'
import { AuthPage } from '../pages/AuthPage'

test('AC-01: 登录成功跳转首页', async ({ page }) => {
  const auth = new AuthPage(page)
  await auth.gotoLogin()
  await auth.login('test@gofer.bot', 'Test1234!')
  await expect(page).toHaveURL('/app/chat')
})
```

## 4. Mock 模式 vs 真实后端

```ts
// Mock 模式 — 注入假 token，mock API 路由
import { injectMockToken, mockAuthApi } from '../fixtures/auth'

test.beforeEach(async ({ page }) => {
  await injectMockToken(page)      // localStorage 写假 token
  await mockAuthApi(page)          // 拦截 /api/auth/* 返回 mock 数据
})

// 真实后端 — 通过 API 注册用户，注入真实 token
import { createTestUser, injectAuthToken } from '../fixtures/auth'

test.beforeEach(async ({ page }) => {
  const user = await createTestUser()
  await injectAuthToken(page, user.accessToken)
})
```

## 5. 数据清理

E2E 共享数据库，测试后自动清理：

```ts
import { cleanupDatabase } from '../fixtures/database'

test.afterEach(async () => {
  await cleanupDatabase()  // TRUNCATE users, sessions, messages, knowledge_bases ...
})
```

## 6. 运行测试

```bash
pnpm test:e2e                                          # 全部 E2E
pnpm test:e2e --ui                                     # UI 模式（可调试）
pnpx playwright test tests/e2e/flows/onboarding.spec.ts # 单个文件
pnpx playwright test -g "AC-01"                        # 按用例名过滤
```

## 7. 必备用例清单

| 场景 | 必测 | 说明 |
|------|------|------|
| 页面元素完整 | 是 | 核心元素可见、可交互 |
| 正常路径（happy path） | 是 | 核心功能流程 |
| 表单验证错误 | 是 | 必填字段、格式校验 |
| 空状态 | 视情况 | 列表为空、无数据 |
| 加载/错误状态 | 视情况 | loading 指示器、网络错误 |

## 8. 配置要点

```ts
// playwright.config.ts 关键配置
{
  testDir: './specs',
  workers: 1,                    // 串行，避免 DB 冲突
  globalSetup: './playwright.global-setup.ts',
  globalTeardown: './playwright.global-teardown.ts',
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'pnpm dev:web',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
  },
}
```
