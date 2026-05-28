import { test, expect } from '@playwright/test'
import { cleanupDatabase } from '../e2e/fixtures/database'
import { isBackendAvailable } from '../e2e/fixtures/auth'
import { AuthPage } from '../e2e/pages/AuthPage'

let backendOk: boolean

test.describe('认证流程 (q-17)', () => {
  test.beforeAll(async () => {
    backendOk = await isBackendAvailable()
  })

  test.beforeEach(async () => {
    test.skip(!backendOk, 'Backend unavailable — skipping auth integration test')
    await cleanupDatabase()
  })

  test('AC-01: 注册页面元素完整', async ({ page }) => {
    const auth = new AuthPage(page)
    await auth.gotoRegister()
    await expect(auth.emailInput).toBeVisible()
    await expect(auth.passwordInput).toBeVisible()
    await expect(auth.confirmPasswordInput).toBeVisible()
    await expect(auth.submitButton).toBeVisible()
    await expect(auth.submitButton).toBeEnabled()
  })

  test('AC-02: 成功注册后自动登录跳转', async ({ page }) => {
    const auth = new AuthPage(page)
    await auth.gotoRegister()
    const email = `e2e-${Date.now()}@test.gofer`
    await auth.register(email, 'Test1234!', 'Test1234!')

    // 等待跳转（注册成功后跳转到 /app/chat）
    await page.waitForURL(/\/app\/chat/, { timeout: 10000 })
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

    // 等待跳转到 /app/chat
    await page.waitForURL(/\/app\/chat/, { timeout: 10000 })
    // 给页面一点时间完成 localStorage 写入和 Vue 初始化
    await page.waitForTimeout(500)
    const token = await page.evaluate(() => localStorage.getItem('goferbot_access_token'))
    expect(token).toBeTruthy()
  })

  test('AC-05: 错误密码显示登录失败', async ({ page }) => {
    const { createTestUser } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()

    const auth = new AuthPage(page)
    await auth.gotoLogin()
    await auth.login(user.email, 'WrongPassword123!')

    // 等待错误提示出现（可能是 alert 或表单错误）
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/login/)
  })

  test('AC-06: 未登录访问保护路由重定向到登录页', async ({ page }) => {
    // 直接访问受保护的路由
    await page.goto('/app/knowledge-base')
    // 应该被重定向到登录页
    await page.waitForURL(/\/login/, { timeout: 5000 })
    await expect(page.locator('input[type="email"]').first()).toBeVisible()
  })

  test('AC-07: 已登录访问登录页重定向到首页', async ({ page }) => {
    const { createTestUser } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()

    // 直接注入 token 模拟已登录状态，然后访问登录页
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${user.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${user.refreshToken}')
      `,
    })
    await page.goto('/login')
    await page.waitForURL(/\/app\/chat/, { timeout: 10000 })
  })

  test('AC-08: 重复注册相同邮箱返回错误', async ({ page }) => {
    const { createTestUser } = await import('../../e2e/fixtures/auth')
    const user = await createTestUser()

    const auth = new AuthPage(page)
    await auth.gotoRegister()
    // 使用相同的邮箱再次注册
    await auth.register(user.email, 'Test1234!', 'Test1234!')

    // 等待错误提示出现
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5000 })
    await expect(page).toHaveURL(/\/register/)
  })
})
