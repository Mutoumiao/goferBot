import { expect, type Page, type Locator, type Response } from '@playwright/test'

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
    this.nameInput = page.locator('input[type="text"]').first()
    this.emailInput = page.locator('input[type="email"]').first()
    this.passwordInput = page.locator('input[type="password"]')
    this.confirmPasswordInput = page.locator('input[type="password"]').nth(1)
    this.submitButton = page.locator('button[type="submit"]').first()
    this.errorMessage = page.locator('.bg-destructive\\/10, [data-sonner-toast], [role="alert"]')
    this.registerSwitchButton = page.getByRole('button', { name: /立即注册/ })
    this.loginSwitchButton = page.getByRole('button', { name: /去登录/ })
    this.goBackButton = page.getByRole('button', { name: /返回登录/ })
  }

  private async submitAuthForm(endpoint: 'register' | 'login'): Promise<Response> {
    const urlPart = `/api/auth/${endpoint}`
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) => r.url().includes(urlPart),
        { timeout: 15_000 },
      ),
      this.submitButton.click(),
    ])
    return response
  }

  async gotoLogin() {
    await this.page.goto('http://localhost:1420/login', { waitUntil: 'domcontentloaded' })
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

  async register(name: string, email: string, password: string) {
    await this.nameInput.fill(name)
    await this.emailInput.fill(email)
    await this.passwordInput.first().fill(password)
    await this.confirmPasswordInput.fill(password)
    return this.submitAuthForm('register')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.first().fill(password)
    return this.submitAuthForm('login')
  }

  async expectErrorMessageContains(text: string) {
    await expect(this.errorMessage.first()).toContainText(text)
  }
}
