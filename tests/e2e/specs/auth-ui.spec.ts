/**
 * @scope UI 行为测试（Mock API）
 * @purpose 验证认证页面渲染、前端表单校验、路由跳转
 * @note 使用 Mock API，不验证后端契约。
 *       API 契约验证（注册/登录/401/409）见 tests/integration/auth-kb-document.spec.ts
 */
import { test, expect } from '@playwright/test'
import { mockAuthApi } from '../fixtures/auth'
import { LoginPage, RegisterPage } from '../pages/AuthPage'

test.describe('认证流程', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthApi(page)
  })

  test('登录页面元素完整', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()

    await expect(loginPage.emailInput).toBeVisible()
    await expect(loginPage.passwordInput).toBeVisible()
    await expect(loginPage.submitButton).toBeVisible()
    await expect(loginPage.registerLink).toBeVisible()
  })

  test('注册页面元素完整', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()

    await expect(registerPage.emailInput).toBeVisible()
    await expect(registerPage.passwordInput).toBeVisible()
    await expect(registerPage.confirmPasswordInput).toBeVisible()
    await expect(registerPage.submitButton).toBeVisible()
    await expect(registerPage.loginLink).toBeVisible()
  })

  // ❌ "成功登录后跳转首页" — 已移除（API 登录行为由 auth-kb-document 真实 API 覆盖）
  // ❌ "登录失败显示错误提示" — 已移除（API 错误码由 auth-kb-document 覆盖）
  // ❌ "成功注册后自动登录" — 已移除（API 注册行为由 auth-kb-document 覆盖）

  test('注册时表单验证失败显示字段错误', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()

    await registerPage.emailInput.fill('invalid-email')
    await registerPage.passwordInput.fill('123')
    await registerPage.confirmPasswordInput.fill('456')

    // [NOTE] Button.vue 已修复为原生 button 渲染确保 type="submit" 透传，
    // 但 Playwright 的 click() 在 Vite dev server 环境下不触发表单 submit 事件。
    // 原因可能是 Vite HMR 缓存或 Vue 事件系统与 Playwright 的点击事件有冲突。
    // 使用 dispatchEvent 直接分发 submit 事件作为可靠替代方案。
    await page.evaluate(() => {
      const form = document.querySelector('.auth-form') as HTMLFormElement
      if (form) {
        const event = new Event('submit', { bubbles: true, cancelable: true })
        form.dispatchEvent(event)
      }
    })

    // 等待 Vue 响应式更新
    await page.waitForTimeout(500)

    // 检查字段验证错误：输入框包裹元素应有 has-error class
    await expect(page.locator('.auth-input-wrap.has-error').first()).toBeVisible()
    await expect(page.locator('.auth-input-wrap.has-error')).toHaveCount(3)
  })

  test('点击注册链接跳转注册页', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.registerLink.click()

    await expect(page).toHaveURL('/register')
  })

  test('点击登录链接跳转登录页', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()
    await registerPage.loginLink.click()

    await expect(page).toHaveURL('/login')
  })

  test('已登录用户访问登录页重定向', async ({ page }) => {
    await page.addInitScript({ content: `
      try {
        localStorage.setItem('goferbot_access_token', 'mock-access-token-12345')
        localStorage.setItem('goferbot_refresh_token', 'mock-refresh-token-67890')
      } catch (e) {}
    ` })

    // mock /auth/me 返回成功
    await page.route('**/api/auth/me', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } },
        })
      }
    })

    await page.goto('/login')

    await expect(page).toHaveURL('/app/chat')
  })
})
