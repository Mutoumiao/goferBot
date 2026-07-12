/**
 * 账户与会话冒烟（真实后端）
 *
 * 注意：依赖邀请码 TEST_INVITATION_CODES 与验证码白名单/占位。
 * 全量 Web 业务链请优先跑：pnpm test:e2e:web
 */
import { expect, test } from '@playwright/test'
import { AuthPage } from '../pages/AuthPage'
import { ChatPage } from '../pages/ChatPage'

test.describe.configure({ mode: 'serial' })

test.describe('账户注册与登录（真实后端）', () => {
  let authPage: AuthPage

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page)
  })

  test('注册页面元素完整', async () => {
    await authPage.gotoRegister()

    await expect(authPage.nameInput).toBeVisible()
    await expect(authPage.emailInput).toBeVisible()
    await expect(authPage.passwordInput.first()).toBeVisible()
    await expect(authPage.confirmPasswordInput).toBeVisible()
    await expect(authPage.submitButton.first()).toBeVisible()
    await expect(authPage.page.getByPlaceholder('请输入邀请码')).toBeVisible()
  })

  test('登录页面元素完整', async () => {
    await authPage.gotoLogin()

    await expect(authPage.emailInput.first()).toBeVisible()
    await expect(authPage.passwordInput.first()).toBeVisible()
    await expect(authPage.submitButton.first()).toBeVisible()
  })

  test('注册新用户并跳转首页', async ({ page }) => {
    const email = `e2e-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    const res = await authPage.register('E2E User', email, password)
    expect(res.ok(), `注册失败 ${res.status()}`).toBeTruthy()

    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
  })

  test('已注册用户可以登录', async ({ page }) => {
    const email = `e2e-login-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    await authPage.register('E2E User', email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })

    // 已登录访问 /login 会 beforeLoad 重定向；先退出再测登录
    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })

    await authPage.login(email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
  })

  test('错误密码登录失败', async ({ page }) => {
    const email = `e2e-fail-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    await authPage.register('E2E User', email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })

    await page.goto('/profile', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login/, { timeout: 15_000 })

    await authPage.login(email, 'WrongPassword1')
    await authPage.expectErrorMessageContains('邮箱或密码错误')
  })

  test('已登录用户访问 /login 重定向首页', async ({ page }) => {
    const email = `e2e-redirect-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    await authPage.register('E2E User', email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })

    await page.goto('/login')
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
  })
})

test.describe('首页输入 -> 会话页（真实后端）', () => {
  let authPage: AuthPage
  let chatPage: ChatPage
  let testEmail: string
  const testPassword = 'Password123'

  test.beforeEach(async ({ page }) => {
    testEmail = `e2e-chat-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
    authPage = new AuthPage(page)
    chatPage = new ChatPage(page)

    await authPage.gotoRegister()
    await authPage.register('E2E User', testEmail, testPassword)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
  })

  test('首页显示输入框与标题，未选知识库时发送禁用', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await expect(chatPage.homeTitle).toBeVisible({ timeout: 15_000 })
    // 占位符随是否选 KB 变化；textarea 始终存在
    await expect(page.locator('textarea').first()).toBeVisible()
    await expect(page.getByTestId('temp-send-btn')).toBeDisabled()
    await expect(page.getByTestId('kb-selector-trigger')).toBeVisible()
  })

  // 完整「选 KB → 发问 → 引用」见 knowledge-ai-rag.spec.ts
})
