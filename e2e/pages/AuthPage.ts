import { expect, type Locator, type Page, type Response } from '@playwright/test'

export class AuthPage {
  readonly page: Page
  readonly nameInput: Locator
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly registerSwitchButton: Locator
  readonly loginSwitchButton: Locator
  readonly goBackButton: Locator

  constructor(page: Page) {
    this.page = page
    this.nameInput = page.getByPlaceholder('你的名字')
    this.emailInput = page.locator('input[type="email"]').first()
    this.passwordInput = page.locator('input[type="password"]')
    this.confirmPasswordInput = page.locator('input[type="password"]').nth(1)
    this.submitButton = page.locator('button[type="submit"]').first()
    // LoginForm 错误区为内联 style 红底，无 role=alert；兼容 toast
    this.errorMessage = page.locator(
      [
        '.bg-destructive\\/10',
        '[data-sonner-toast]',
        '[role="alert"]',
        'form div:has(svg)',
      ].join(', '),
    )
    this.registerSwitchButton = page.getByRole('button', { name: /立即注册/ })
    this.loginSwitchButton = page.getByRole('button', { name: /去登录/ })
    this.goBackButton = page.getByRole('button', { name: /返回登录/ })
  }

  private async submitAuthForm(endpoint: 'register' | 'login'): Promise<Response> {
    // 实际路径为 /api/web/auth/{login|register}（VITE_API_BASE_URL 指向 Nest）
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          r.request().method() === 'POST' &&
          (r.url().includes(`/web/auth/${endpoint}`) || r.url().includes(`/auth/${endpoint}`)),
        { timeout: 20_000 },
      ),
      this.submitButton.click(),
    ])
    return response
  }

  async gotoLogin() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' })
    await expect(this.emailInput).toBeVisible({ timeout: 10_000 })
  }

  async gotoRegister() {
    await this.gotoLogin()
    await this.switchToRegister()
  }

  async switchToRegister() {
    await this.registerSwitchButton.click()
    await expect(this.nameInput).toBeVisible()
  }

  async switchToLogin() {
    await this.loginSwitchButton.click()
    await expect(this.passwordInput.first()).toBeVisible()
  }

  async register(
    name: string,
    email: string,
    password: string,
    invitationCode = process.env.E2E_INVITE_CODE || 'GF-test-code-001',
  ) {
    await this.nameInput.fill(name)
    await this.emailInput.fill(email)
    const invite = this.page.getByPlaceholder('请输入邀请码')
    if (await invite.isVisible().catch(() => false)) {
      await invite.fill(invitationCode)
    }
    await this.passwordInput.first().fill(password)
    await this.confirmPasswordInput.fill(password)
    return this.submitAuthForm('register')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.first().fill(password)
    // 前端强制 4 位验证码；后端 CAPTCHA_ENABLED=false 或 Origin 白名单可跳过真校验
    // 须等验证码挑战加载完成，否则 Controlled input 在 challenge=null 时忽略输入
    const captcha = this.page.getByPlaceholder('验证码')
    if (await captcha.isVisible().catch(() => false)) {
      await expect(this.page.getByRole('img', { name: '验证码' })).toBeVisible({
        timeout: 15_000,
      })
      await captcha.fill('TEST')
      await expect(captcha).toHaveValue('TEST')
    }
    return this.submitAuthForm('login')
  }

  async expectErrorMessageContains(text: string) {
    await expect(this.page.getByText(text).first()).toBeVisible({ timeout: 10_000 })
  }
}
