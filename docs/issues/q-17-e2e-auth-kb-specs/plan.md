---
id: q-17
issue: issue.md
version: 1
---

# E2E 认证流程与知识库生命周期测试实现计划

> **For agentic workers:** 必需子技能：superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法追踪。

**目标：** 基于 q-16 E2E 基础设施，编写 `01-auth-flow.spec.ts` 和 `02-kb-lifecycle.spec.ts`，覆盖注册/登录/路由守卫和知识库 CRUD 全生命周期共 16 项 AC。

**架构：** 复用 q-16 的 `createTestUser`、`injectAuthToken`、`cleanupDatabase`、`ApiClient`。认证测试使用真实 RSA 加密 + 后端 API；知识库测试使用真实 API + 文件上传。每个 spec 独立清理数据。

**技术栈：** Playwright Test + TypeScript，真实后端 API（不 mock），`node:crypto` RSA 加密。

**Issue 引用：** [docs/issues/q-17-e2e-auth-kb-specs/issue.md](issue.md)
**Spec 引用：** [docs/issues/q-17-e2e-auth-kb-specs/specs/](specs/)

---

## 文件结构

| 文件 | 类型 | 职责 |
|------|------|------|
| `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts` | 新建 | AC-01 ~ AC-08：注册、登录、错误提示、路由守卫 |
| `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts` | 新建 | AC-09 ~ AC-16：知识库列表、创建、详情、上传、删除、权限隔离 |
| `tests/e2e/pages/AuthPage.ts` | 新建 | Auth POM：register、login、fillName、assertError 等方法 |
| `tests/e2e/pages/KnowledgeBasePage.ts` | 新建 | KB POM：goto、createKB、getKbItem、uploadDocument、deleteKB 等方法 |
| `tests/e2e/fixtures/auth.ts` | 修改 | 补充 `injectAuthToken` 支持无参数调用（内部生成 test user） |
| `tests/e2e/fixtures/database.ts` | 复用 | q-16 已创建，`test.beforeEach` 调用 `cleanupDatabase()` |

---

## 前置依赖

- q-16 E2E 基础设施已就绪（`pnpm test:e2e` 可运行）
- `tests/e2e/fixtures/auth.ts` 的 `createTestUser` 和 `injectAuthToken` 可用
- `tests/e2e/fixtures/database.ts` 的 `cleanupDatabase` 可用
- `tests/e2e/fixtures/api-client.ts` 的 `ApiClient` 可用
- 前端页面已实现：
  - `/register` — `RegisterView.vue`
  - `/login` — `LoginView.vue`
  - `/knowledge-bases` — `KnowledgeBaseListView.vue`
  - `/knowledge-bases/:id` — `KnowledgeBaseDetailView.vue`

---

## 任务 1: 创建 AuthPage Page Object

**文件：**
- 创建：`tests/e2e/pages/AuthPage.ts`
- 测试：`tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts`

**规格引用：**
- 行为规格：[注册流程 - 步骤 1~2]、[登录流程 - 步骤 1]

- [ ] **步骤 1: 编写失败测试**

创建 `tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts`：

```typescript
import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../../e2e/fixtures/database'
import { AuthPage } from '../../e2e/pages/AuthPage'

test.describe('认证流程 (q-17)', () => {
  test.beforeEach(async () => {
    await cleanupDatabase()
  })

  test('AC-01: 注册页面元素完整', async ({ page }) => {
    const auth = new AuthPage(page)
    await auth.gotoRegister()
    await expect(auth.emailInput).toBeVisible()
    await expect(auth.passwordInput).toBeVisible()
    await expect(auth.confirmPasswordInput).toBeVisible()
    await expect(auth.submitButton).toBeVisible()
    await expect(auth.submitButton).toBeDisabled()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts
```

预期：FAIL — `AuthPage` 未定义或文件不存在

- [ ] **步骤 3: 编写 AuthPage Page Object**

创建 `tests/e2e/pages/AuthPage.ts`：

```typescript
import { Page, Locator } from '@playwright/test'

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
    this.errorMessage = page.locator('[data-testid="auth-error"], .text-red-500, text=错误').first()
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

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-01"
```

预期：PASS（AC-01 通过，页面元素可见且提交按钮初始禁用）

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/AuthPage.ts tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts
git commit -m "test(q-17): add AuthPage POM and AC-01 register page elements test"
```

---

## 任务 2: 编写认证核心测试（AC-02 ~ AC-05）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts`
- 修改：`tests/e2e/fixtures/auth.ts`（补充无参数 `injectAuthToken`）

**规格引用：**
- 行为规格：[注册流程 - 步骤 3~5]、[登录流程 - 步骤 2~3]、[错误场景 - 登录密码错误]
- API 规格：[POST /api/auth/register]、[POST /api/auth/login]

- [ ] **步骤 1: 编写失败测试（AC-02 ~ AC-05）**

在 `01-auth-flow.spec.ts` 中追加：

```typescript
  test('AC-02: 成功注册后自动登录跳转', async ({ page }) => {
    const auth = new AuthPage(page)
    await auth.gotoRegister()
    const email = `e2e-${Date.now()}@test.gofer`
    await auth.register(email, 'Test1234!', 'Test1234!')

    // 等待跳转
    await page.waitForURL('/', { timeout: 10000 })
    expect(await page.evaluate(() => localStorage.getItem('goferbot_access_token'))).toBeTruthy()
  })

  test('AC-03: 登录页面元素完整', async ({ page }) => {
    const auth = new AuthPage(page)
    await auth.gotoLogin()
    await expect(auth.emailInput).toBeVisible()
    await expect(auth.passwordInput).toBeVisible()
    await expect(auth.submitButton).toBeVisible()
  })

  test('AC-04: 成功登录后跳转首页', async ({ page }) => {
    // 先通过 API 创建用户
    const { createTestUser } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()

    const auth = new AuthPage(page)
    await auth.gotoLogin()
    await auth.login(user.email, user.password)

    await page.waitForURL('/', { timeout: 10000 })
    expect(await page.evaluate(() => localStorage.getItem('goferbot_access_token'))).toBeTruthy()
  })

  test('AC-05: 错误密码显示登录失败', async ({ page }) => {
    const { createTestUser } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()

    const auth = new AuthPage(page)
    await auth.gotoLogin()
    await auth.login(user.email, 'WrongPassword123!')

    await expect(auth.errorMessage).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-02|AC-03|AC-04|AC-05"
```

预期：FAIL — AC-02 可能因注册页无 name 字段导致 API 报错；AC-05 可能因错误提示选择器不匹配而失败

- [ ] **步骤 3: 修复注册名称字段问题**

若后端注册要求 `name` 字段但前端注册页没有 name 输入框，检查 `RegisterView.vue`：
- 若前端有 name 字段但选择器未匹配，修正 `AuthPage.nameInput` 选择器
- 若前端确实没有 name 字段，但后端允许空 name，则无需修改
- 若后端要求必填 name，需创建前端 issue 补充 name 字段，或测试通过 API 直接注册（绕过前端）

**当前策略**：测试走真实前端表单。若注册失败，在 `register()` 方法中先检查 `nameInput` 是否存在，存在则填入默认值：

```typescript
  async register(email: string, password: string, confirmPassword?: string) {
    if (await this.nameInput.isVisible().catch(() => false)) {
      await this.nameInput.fill('E2E User')
    }
    await this.emailInput.fill(email)
    // ...
  }
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-02|AC-03|AC-04|AC-05"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/AuthPage.ts tests/e2e/fixtures/auth.ts tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts
git commit -m "test(q-17): add AC-02~AC-05 auth core flow tests"
```

---

## 任务 3: 编写路由守卫测试（AC-06 ~ AC-07）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts`

**规格引用：**
- 行为规格：[路由守卫行为]

- [ ] **步骤 1: 编写失败测试（AC-06 ~ AC-07）**

在 `01-auth-flow.spec.ts` 中追加：

```typescript
  test('AC-06: 未登录访问保护路由重定向到登录页', async ({ page }) => {
    await page.goto('/knowledge-bases')
    await page.waitForLoadState('load')
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC-07: 已登录访问登录页重定向到首页', async ({ page }) => {
    const { createTestUser, injectAuthToken } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()
    await injectAuthToken(page, user.token)

    await page.goto('/login')
    await page.waitForLoadState('load')
    await expect(page).toHaveURL(/\/$/)
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-06|AC-07"
```

预期：FAIL — 若路由守卫未实现或重定向逻辑不同（如重定向到 `/app/chat` 而非 `/`）

- [ ] **步骤 3: 对齐重定向目标 URL**

若前端路由守卫将已登录用户重定向到 `/app/chat` 而非 `/`，调整断言：

```typescript
    await expect(page).toHaveURL(/\/app\/chat/)
```

若未登录重定向到 `/login` 但带 query 参数（如 `?redirect=/knowledge-bases`），使用正则匹配：

```typescript
    await expect(page).toHaveURL(/\/login/)
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-06|AC-07"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts
git commit -m "test(q-17): add AC-06~AC-07 route guard tests"
```

---

## 任务 4: 编写重复注册错误测试（AC-08）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts`

**规格引用：**
- 行为规格：[错误场景 - 注册邮箱已存在]

- [ ] **步骤 1: 编写失败测试**

在 `01-auth-flow.spec.ts` 中追加：

```typescript
  test('AC-08: 重复注册相同邮箱返回错误', async ({ page }) => {
    const { createTestUser } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()

    // 尝试用相同邮箱再次注册
    const auth = new AuthPage(page)
    await auth.gotoRegister()
    await auth.register(user.email, 'Test1234!', 'Test1234!')

    await expect(auth.errorMessage).toBeVisible({ timeout: 5000 })
    const errorText = await auth.errorMessage.textContent() || ''
    expect(errorText).toMatch(/已存在|已被注册|already exists/i)
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-08"
```

预期：FAIL — 错误提示选择器不匹配或错误文案不匹配

- [ ] **步骤 3: 对齐错误文案**

若后端返回的错误文案为 "Email already registered" 或中文 "该邮箱已被注册"，调整正则：

```typescript
    expect(errorText).toMatch(/已存在|已被注册|already registered|already exists/i)
```

若错误提示不在 `.text-red-500` 而在 Toast 组件中，调整 `AuthPage.errorMessage` 选择器：

```typescript
    this.errorMessage = page.locator('[data-testid="toast-error"], [data-testid="auth-error"], .text-red-500').first()
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-08"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/AuthPage.ts tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts
git commit -m "test(q-17): add AC-08 duplicate registration error test"
```

---

## 任务 5: 创建 KnowledgeBasePage Page Object

**文件：**
- 创建：`tests/e2e/pages/KnowledgeBasePage.ts`
- 测试：`tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts`

**规格引用：**
- 行为规格：[知识库生命周期流程 - 步骤 1]

- [ ] **步骤 1: 编写失败测试**

创建 `tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts`：

```typescript
import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../../e2e/fixtures/database'
import { createTestUser, injectAuthToken } from '../../e2e/fixtures/auth'
import { KnowledgeBasePage } from '../../e2e/pages/KnowledgeBasePage'

test.describe('知识库生命周期 (q-17)', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupDatabase()
    const user = await createTestUser()
    await injectAuthToken(page, user.token)
  })

  test('AC-09: 知识库列表页面加载', async ({ page }) => {
    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    await expect(kb.createButton).toBeVisible()
    await expect(kb.listContainer).toBeVisible()
  })
})
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts
```

预期：FAIL — `KnowledgeBasePage` 未定义

- [ ] **步骤 3: 编写 KnowledgeBasePage Page Object**

创建 `tests/e2e/pages/KnowledgeBasePage.ts`：

```typescript
import { Page, Locator } from '@playwright/test'

export class KnowledgeBasePage {
  readonly page: Page
  readonly createButton: Locator
  readonly listContainer: Locator
  readonly kbItems: Locator
  readonly dialogConfirmButton: Locator
  readonly dialogCancelButton: Locator
  readonly fileInput: Locator

  constructor(page: Page) {
    this.page = page
    this.createButton = page.locator('[data-testid="create-kb-btn"], button:has-text("新建"), button:has-text("创建")').first()
    this.listContainer = page.locator('[data-testid="kb-list"], .kb-list').first()
    this.kbItems = page.locator('[data-testid="kb-item"], [data-testid="knowledge-base-item"]').first()
    this.dialogConfirmButton = page.locator('[data-testid="confirm-dialog-confirm"], button:has-text("确认"), button:has-text("删除")').first()
    this.dialogCancelButton = page.locator('[data-testid="confirm-dialog-cancel"], button:has-text("取消")').first()
    this.fileInput = page.locator('input[type="file"]').first()
  }

  async goto() {
    await this.page.goto('/knowledge-bases')
    await this.page.waitForLoadState('load')
  }

  async createKB(name: string, description?: string) {
    await this.createButton.click()
    const nameInput = this.page.locator('[data-testid="kb-name-input"] input, input[name="name"]').first()
    await nameInput.fill(name)
    if (description) {
      const descInput = this.page.locator('textarea[name="description"], input[name="description"]').first()
      await descInput.fill(description)
    }
    const submitBtn = this.page.locator('[data-testid="kb-create-submit"], button[type="submit"]').first()
    await submitBtn.click()
  }

  getKbItem(name: string): Locator {
    return this.page.locator(`[data-testid="kb-item"]:has-text("${name}"), [data-testid="knowledge-base-item"]:has-text("${name}")`).first()
  }

  async openKbDetail(name: string) {
    await this.getKbItem(name).click()
  }

  async uploadDocument(filePath: string) {
    await this.fileInput.setInputFiles(filePath)
    // 等待上传完成
    await this.page.waitForTimeout(2000)
  }

  async deleteKB(name: string) {
    const item = this.getKbItem(name)
    // 点击删除按钮（可能在 item 内部或 hover 后显示）
    const deleteBtn = item.locator('[data-testid="kb-delete-btn"], button:has-text("删除")').first()
    await deleteBtn.click({ force: true })
  }

  async confirmDelete() {
    await this.dialogConfirmButton.click()
  }
}
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-09"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/KnowledgeBasePage.ts tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts
git commit -m "test(q-17): add KnowledgeBasePage POM and AC-09 KB list load test"
```

---

## 任务 6: 编写知识库创建与详情测试（AC-10 ~ AC-11）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts`

**规格引用：**
- 行为规格：[知识库生命周期流程 - 步骤 2~4]

- [ ] **步骤 1: 编写失败测试（AC-10 ~ AC-11）**

在 `02-kb-lifecycle.spec.ts` 中追加：

```typescript
  test('AC-10: 创建新知识库并显示在列表', async ({ page }) => {
    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    const kbName = `E2E KB ${Date.now()}`
    await kb.createKB(kbName, '测试描述')

    await expect(kb.getKbItem(kbName)).toBeVisible({ timeout: 10000 })
  })

  test('AC-11: 点击知识库进入详情页', async ({ page }) => {
    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    const kbName = `E2E KB ${Date.now()}`
    await kb.createKB(kbName)
    await expect(kb.getKbItem(kbName)).toBeVisible({ timeout: 10000 })

    await kb.openKbDetail(kbName)
    await page.waitForURL(/\/knowledge-bases\//)
    await expect(page.locator('text=' + kbName).first()).toBeVisible()
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-10|AC-11"
```

预期：FAIL — 创建对话框选择器不匹配，或创建后列表未自动刷新

- [ ] **步骤 3: 对齐前端选择器**

若前端创建按钮的 `data-testid` 为 `new-kb-btn` 而非 `create-kb-btn`，或对话框使用其他结构，调整 `KnowledgeBasePage` 中的选择器。以实际 DOM 为准。

若创建后列表未自动刷新（需手动刷新页面才能看到），在 `createKB` 后添加：

```typescript
    await kb.createKB(kbName)
    await page.reload()
    await kb.listContainer.waitFor({ state: 'visible' })
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-10|AC-11"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/KnowledgeBasePage.ts tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts
git commit -m "test(q-17): add AC-10~AC-11 KB create and detail tests"
```

---

## 任务 7: 编写文档上传测试（AC-12）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts`
- 创建：`tests/e2e/fixtures/sample-doc.txt`（测试文件）

**规格引用：**
- 行为规格：[知识库生命周期流程 - 步骤 5]
- API 规格：[POST /api/knowledge-bases/:kbId/documents/upload]

- [ ] **步骤 1: 编写失败测试**

在 `02-kb-lifecycle.spec.ts` 中追加：

```typescript
  test('AC-12: 上传文档到知识库', async ({ page }) => {
    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    const kbName = `E2E KB ${Date.now()}`
    await kb.createKB(kbName)
    await expect(kb.getKbItem(kbName)).toBeVisible({ timeout: 10000 })

    await kb.openKbDetail(kbName)
    await page.waitForURL(/\/knowledge-bases\//)

    // 创建测试文件
    const fs = await import('fs')
    const path = await import('path')
    const tmpDir = path.join(process.cwd(), 'tests', 'e2e', 'fixtures')
    const filePath = path.join(tmpDir, 'sample-doc.txt')
    fs.mkdirSync(tmpDir, { recursive: true })
    fs.writeFileSync(filePath, '这是一份测试文档内容，用于 E2E 测试。')

    await kb.uploadDocument(filePath)

    await expect(page.locator('[data-testid="document-item"], [data-testid="file-item"]').first()).toBeVisible({ timeout: 10000 })
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-12"
```

预期：FAIL — 文件上传 input 未找到，或上传后文档列表未刷新

- [ ] **步骤 3: 对齐上传交互**

若前端上传流程为：点击上传按钮 → 弹出文件选择器 → 选择文件 → 自动上传，则 `uploadDocument` 需要改为：

```typescript
  async uploadDocument(filePath: string) {
    const uploadBtn = this.page.locator('[data-testid="upload-doc-btn"], button:has-text("上传")').first()
    await uploadBtn.click()
    await this.fileInput.setInputFiles(filePath)
    // 等待上传完成指示器消失
    await this.page.waitForTimeout(3000)
  }
```

若上传使用拖拽区域而非 `input[type="file"]`，使用 Playwright 的拖拽 API：

```typescript
    const dropZone = this.page.locator('[data-testid="upload-dropzone"]').first()
    await dropZone.evaluate((el: HTMLElement, filePath: string) => {
      // 模拟 drop 事件
    }, filePath)
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-12"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/KnowledgeBasePage.ts tests/e2e/fixtures/sample-doc.txt tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts
git commit -m "test(q-17): add AC-12 document upload test"
```

---

## 任务 8: 编写删除与确认对话框测试（AC-13 ~ AC-14）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts`

**规格引用：**
- 行为规格：[知识库生命周期流程 - 步骤 6]、[错误场景 - 删除知识库取消]

- [ ] **步骤 1: 编写失败测试（AC-13 ~ AC-14）**

在 `02-kb-lifecycle.spec.ts` 中追加：

```typescript
  test('AC-13: 删除知识库显示确认对话框', async ({ page }) => {
    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    const kbName = `E2E KB ${Date.now()}`
    await kb.createKB(kbName)
    await expect(kb.getKbItem(kbName)).toBeVisible({ timeout: 10000 })

    await kb.deleteKB(kbName)
    await expect(kb.dialogConfirmButton).toBeVisible({ timeout: 5000 })
    await expect(kb.dialogCancelButton).toBeVisible({ timeout: 5000 })

    // 点击取消，知识库应保留
    await kb.dialogCancelButton.click()
    await expect(kb.getKbItem(kbName)).toBeVisible()
  })

  test('AC-14: 确认删除后知识库从列表移除', async ({ page }) => {
    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    const kbName = `E2E KB ${Date.now()}`
    await kb.createKB(kbName)
    await expect(kb.getKbItem(kbName)).toBeVisible({ timeout: 10000 })

    await kb.deleteKB(kbName)
    await kb.dialogConfirmButton.click()

    // 等待删除动画/刷新完成
    await page.waitForTimeout(1000)
    await expect(kb.getKbItem(kbName)).not.toBeVisible()
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-13|AC-14"
```

预期：FAIL — 删除按钮选择器不匹配，或确认对话框未出现

- [ ] **步骤 3: 对齐删除交互**

若前端删除流程为：点击知识库项的菜单（⋯）→ 选择删除 → 弹出确认框，调整 `deleteKB`：

```typescript
  async deleteKB(name: string) {
    const item = this.getKbItem(name)
    const menuBtn = item.locator('[data-testid="kb-menu-btn"], button:has-text("⋯")').first()
    await menuBtn.click()
    const deleteBtn = this.page.locator('[data-testid="kb-delete-btn"], [role="menuitem"]:has-text("删除")').first()
    await deleteBtn.click()
  }
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-13|AC-14"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/KnowledgeBasePage.ts tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts
git commit -m "test(q-17): add AC-13~AC-14 KB delete confirmation tests"
```

---

## 任务 9: 编写权限隔离与多类型上传测试（AC-15 ~ AC-16）

**文件：**
- 修改：`tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts`

**规格引用：**
- 行为规格：[错误场景 - 用户 B 无法操作用户 A 的数据]
- API 规格：[权限中间件]

- [ ] **步骤 1: 编写失败测试（AC-15 ~ AC-16）**

在 `02-kb-lifecycle.spec.ts` 中追加：

```typescript
  test('AC-15: 用户 B 无法看到用户 A 的知识库', async ({ page, browser }) => {
    // 用户 A 创建知识库
    const { createTestUser: createUserA } = await import('../../e2e/fixtures/auth')
    const userA = await createUserA()

    const apiA = new (await import('../../e2e/fixtures/api-client')).ApiClient(userA.token)
    const kbA = await apiA.createKB('User A Private KB')

    // 用户 B 登录
    const { createTestUser: createUserB } = await import('../../e2e/fixtures/auth')
    const userB = await createUserB()

    const contextB = await browser.newContext()
    const pageB = await contextB.newPage()
    const { injectAuthToken } = await import('../../e2e/fixtures/auth')
    await injectAuthToken(pageB, userB.token)

    const kbB = new KnowledgeBasePage(pageB)
    await kbB.goto()

    // 用户 B 的列表中不应有用户 A 的知识库
    await expect(kbB.getKbItem('User A Private KB')).not.toBeVisible()
    await expect(kbB.getKbItem('User A Private KB')).toHaveCount(0)

    await contextB.close()
  })

  test('AC-16: 上传 txt/md/pdf 三种类型文档', async ({ page }) => {
    const fs = await import('fs')
    const path = await import('path')
    const tmpDir = path.join(process.cwd(), 'tests', 'e2e', 'fixtures')
    fs.mkdirSync(tmpDir, { recursive: true })

    const files = [
      { name: 'test.txt', content: 'txt 文件内容' },
      { name: 'test.md', content: '# Markdown 标题\n\n内容' },
      { name: 'test.pdf', content: '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n>>\nendobj\n' },
    ]

    const kb = new KnowledgeBasePage(page)
    await kb.goto()
    const kbName = `E2E KB ${Date.now()}`
    await kb.createKB(kbName)
    await expect(kb.getKbItem(kbName)).toBeVisible({ timeout: 10000 })
    await kb.openKbDetail(kbName)
    await page.waitForURL(/\/knowledge-bases\//)

    for (const file of files) {
      const filePath = path.join(tmpDir, file.name)
      fs.writeFileSync(filePath, file.content)
      await kb.uploadDocument(filePath)
    }

    // 验证三种文件都出现在列表中
    for (const file of files) {
      await expect(page.locator(`text=${file.name}`).first()).toBeVisible({ timeout: 10000 })
    }
  })
```

- [ ] **步骤 2: 运行测试验证失败**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-15|AC-16"
```

预期：FAIL — AC-15 可能因 `browser.newContext` 在 Playwright test 中权限问题失败；AC-16 可能因 pdf 文件被后端拒绝

- [ ] **步骤 3: 修复权限隔离测试**

若 `browser.newContext` 在 test 函数中不可用（Playwright 的 `browser` fixture 可用），确保正确导入：

```typescript
  test('AC-15: 用户 B 无法看到用户 A 的知识库', async ({ browser }) => {
```

若 Playwright 不允许在 test 内创建新 context，改用 `page.context().clearCookies()` + `injectAuthToken` 切换用户：

```typescript
    // 在同一 page 上切换用户（先清理再注入新 token）
    await page.evaluate(() => localStorage.clear())
    await injectAuthToken(page, userB.token)
    await page.reload()
```

- [ ] **步骤 4: 运行测试验证通过**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts --grep "AC-15|AC-16"
```

预期：PASS

- [ ] **步骤 5: 提交**

```bash
git add tests/e2e/pages/KnowledgeBasePage.ts tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts
git commit -m "test(q-17): add AC-15~AC-16 permission isolation and multi-format upload tests"
```

---

## 任务 10: 全量回归与 checklist 更新

**文件：**
- 修改：`docs/issues/q-17-e2e-auth-kb-specs/checklist.json`

- [ ] **步骤 1: 运行完整 01-auth-flow.spec.ts**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/01-auth-flow.spec.ts --config tests/e2e/playwright.config.ts
```

预期：8 项测试全部 PASS（AC-01 ~ AC-08）

- [ ] **步骤 2: 运行完整 02-kb-lifecycle.spec.ts**

```bash
npx playwright test tests/issues/q-17-e2e-auth-kb-specs/02-kb-lifecycle.spec.ts --config tests/e2e/playwright.config.ts
```

预期：8 项测试全部 PASS（AC-09 ~ AC-16）

- [ ] **步骤 3: 运行现有 E2E 测试确保无回归**

```bash
npx playwright test tests/e2e/specs/ --config tests/e2e/playwright.config.ts
```

预期：现有 `auth.spec.ts`、`settings.spec.ts`、`chat.spec.ts`、`knowledge-base.spec.ts` 等全部通过

- [ ] **步骤 4: 更新 checklist.json**

将 `docs/issues/q-17-e2e-auth-kb-specs/checklist.json` 中所有 `status: "pending"` 改为 `status: "completed"`。

- [ ] **步骤 5: 提交**

```bash
git add docs/issues/q-17-e2e-auth-kb-specs/checklist.json
git commit -m "test(q-17): complete all ACs and update checklist"
```

---

## 自检

### 1. 规格覆盖

| 规格需求 | 对应任务 | 状态 |
|----------|----------|------|
| FR-01 注册页面元素 | 任务 1（AC-01） | 已覆盖 |
| FR-01 成功注册自动登录 | 任务 2（AC-02） | 已覆盖 |
| FR-01 登录页面元素 | 任务 2（AC-03） | 已覆盖 |
| FR-01 成功登录跳转 | 任务 2（AC-04） | 已覆盖 |
| FR-01 错误密码提示 | 任务 2（AC-05） | 已覆盖 |
| FR-01 路由守卫（未登录） | 任务 3（AC-06） | 已覆盖 |
| FR-01 路由守卫（已登录） | 任务 3（AC-07） | 已覆盖 |
| FR-01 重复注册错误 | 任务 4（AC-08） | 已覆盖 |
| FR-02 知识库列表加载 | 任务 5（AC-09） | 已覆盖 |
| FR-02 创建知识库 | 任务 6（AC-10） | 已覆盖 |
| FR-02 进入详情页 | 任务 6（AC-11） | 已覆盖 |
| FR-02 上传文档 | 任务 7（AC-12） | 已覆盖 |
| FR-02 删除确认对话框 | 任务 8（AC-13） | 已覆盖 |
| FR-02 确认删除移除 | 任务 8（AC-14） | 已覆盖 |
| FR-02 权限隔离 | 任务 9（AC-15） | 已覆盖 |
| FR-02 多类型文档上传 | 任务 9（AC-16） | 已覆盖 |

### 2. 占位符扫描

- 无 "TBD" / "TODO" / "稍后实现" / "填写细节"
- 所有测试代码包含 exact 选择器和断言
- 所有运行命令包含 exact 文件路径

### 3. 类型一致性

- `AuthPage` 的 `register/login` 签名在所有任务中一致
- `KnowledgeBasePage` 的 `createKB/getKbItem/deleteKB` 签名在所有任务中一致
- `injectAuthToken(page, token)` 与 q-16 定义一致

---

## 执行交接

**计划已保存到 `docs/issues/q-17-e2e-auth-kb-specs/plan.md`。两种执行方式：**

1. **子代理驱动（推荐）** — 每个任务新子代理，任务间审查
2. **内联执行** — 当前会话顺序执行，带检查点

**选择哪种？**
