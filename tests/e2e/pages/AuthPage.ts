import type { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly registerLink: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.submitButton = page.locator('button:has-text("登录")')
    this.errorMessage = page.locator('[role="alert"]')
    this.registerLink = page.locator('text=立即注册')
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
    if (await this.nameInput.isVisible().catch(() => false)) {
      await this.nameInput.fill('E2E User')
    }
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

export class RegisterPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly confirmPasswordInput: Locator
  readonly submitButton: Locator
  readonly errorMessage: Locator
  readonly loginLink: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('#email')
    this.passwordInput = page.locator('#password')
    this.confirmPasswordInput = page.locator('#confirmPassword')
    this.submitButton = page.locator('button:has-text("注册")')
    this.errorMessage = page.locator('[role="alert"]')
    this.loginLink = page.locator('text=去登录')
  }

  async goto() {
    await this.page.goto('/register')
  }

  async register(email: string, password: string, confirmPassword?: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    if (confirmPassword) {
      await this.confirmPasswordInput.fill(confirmPassword)
    }
    await this.submitButton.click()
  }

  async getErrorMessage(): Promise<string> {
    return (await this.errorMessage.textContent()) ?? ''
  }
}
