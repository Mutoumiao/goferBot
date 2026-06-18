import { test, expect } from '@playwright/test'
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
    await authPage.register('E2E User', email, password)

    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
  })

  test('已注册用户可以登录', async ({ page }) => {
    const email = `e2e-login-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    await authPage.register('E2E User', email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })

    await page.goto('http://localhost:1420/login')
    await expect(authPage.emailInput.first()).toBeVisible()

    await authPage.login(email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
  })

  test('错误密码登录失败', async () => {
    const email = `e2e-fail-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    await authPage.register('E2E User', email, password)

    await authPage.gotoLogin()
    await authPage.login(email, 'WrongPassword1')

    await authPage.expectErrorMessageContains('邮箱或密码错误')
  })

  test('已登录用户访问 /login 重定向首页', async ({ page }) => {
    // NOTE: 前端尚未实现登录路由守卫（issue f-02-route-guard），
    // 已登录用户访问 /login 应重定向到 /chat/* 的逻辑待实现。
    // 当前先以 fixme 记录，路由守卫落地后立即恢复。
    test.fixme(true, 'blocked by f-02-route-guard: /login has no beforeLoad redirect for authenticated users')

    const email = `e2e-redirect-${Date.now()}@example.com`
    const password = 'Password123'

    await authPage.gotoRegister()
    await authPage.register('E2E User', email, password)
    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })

    await page.goto('http://localhost:1420/login')
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

  test('首页显示输入框与标题', async () => {
    await chatPage.waitForHome()
    await expect(chatPage.homeTitle).toBeVisible()
    await expect(chatPage.homeTextarea).toBeVisible()
  })

  test('首页输入提交后切换到会话页并显示对话', async ({ page }) => {
    // NOTE: 真实后端需配置可用的 LLM provider（DEEPSEEK_API_KEY 等）。
    // 当前环境 providers 为空，聊天流无法返回 AI 回复，跳过该用例。
    test.fixme(true, 'blocked by no-llm-provider: backend /api/chat-messages/providers returns empty, assistant reply unavailable')

    await chatPage.waitForHome()
    await chatPage.submitFromHome('你好，请介绍一下知识库系统')

    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
    await chatPage.waitForAssistantReply(45_000)

    const assistantCount = await chatPage.getAssistantMessageCount()
    expect(assistantCount).toBeGreaterThanOrEqual(1)
  })

  test('会话页可以看到用户和 AI 双向对话', async ({ page }) => {
    test.fixme(true, 'blocked by no-llm-provider: backend /api/chat-messages/providers returns empty, assistant reply unavailable')

    await chatPage.waitForHome()
    await chatPage.submitFromHome('写一首关于 AI 的诗')

    await expect(page).toHaveURL(/\/chat\//, { timeout: 30_000 })
    await chatPage.waitForAssistantReply(45_000)

    const lastText = await chatPage.getLastAssistantText()
    expect(lastText.length).toBeGreaterThan(0)
  })
})
