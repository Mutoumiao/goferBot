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

  test('成功登录后跳转首页', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('test@example.com', 'Test123!@#')

    await expect(page).toHaveURL('/app/chat')
  })

  test('登录失败显示错误提示', async ({ page }) => {
    const loginPage = new LoginPage(page)
    await loginPage.goto()
    await loginPage.login('wrong@example.com', 'wrongpass')

    await expect(loginPage.errorMessage).toBeVisible()
  })

  test('成功注册后自动登录', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()
    await registerPage.register('newuser@example.com', 'NewPass123!@#', 'NewPass123!@#')

    await expect(page).toHaveURL('/app/chat')
  })

  test('注册时表单验证失败显示字段错误', async ({ page }) => {
    const registerPage = new RegisterPage(page)
    await registerPage.goto()

    await registerPage.emailInput.fill('invalid-email')
    await registerPage.passwordInput.fill('123')
    await registerPage.confirmPasswordInput.fill('456')
    await registerPage.submitButton.click()

    // 检查字段验证错误（前端验证，不发送请求）
    await expect(page.locator('text=请输入有效的邮箱地址')).toBeVisible()
    await expect(page.locator('text=密码长度不能少于 6 位')).toBeVisible()
    await expect(page.locator('text=两次输入的密码不一致')).toBeVisible()
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
    await page.route('**/auth/me', (route) => {
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
