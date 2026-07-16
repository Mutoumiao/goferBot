import { expect, type Locator, type Page } from '@playwright/test'

export class AdminPage {
  readonly page: Page
  readonly pageHeader: Locator

  constructor(page: Page) {
    this.page = page
    this.pageHeader = page.locator('h1, [class*="PageHeader"]').first()
  }

  async expectDashboard() {
    await expect(this.page).toHaveURL(/\/dashboard/)
    await expect(this.page.getByText('控制台').first()).toBeVisible({ timeout: 15_000 })
  }

  async gotoUsers() {
    await this.page.goto('/users', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/users/)
    await expect(this.page.getByText(/用户管理|用户列表/).first()).toBeVisible({
      timeout: 15_000,
    })
  }

  async gotoRoles() {
    await this.page.goto('/roles', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/roles/)
    await expect(this.page.getByText(/权限管理|角色/).first()).toBeVisible({ timeout: 15_000 })
  }

  async gotoModelProviders() {
    await this.page.goto('/model-providers', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/model-providers/)
    await expect(this.page.getByText(/模型提供商|Provider|提供商/).first()).toBeVisible({
      timeout: 15_000,
    })
  }

  async gotoModuleSettings() {
    await this.page.goto('/module-settings', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/module-settings/)
    await expect(this.page.getByText(/模块配置|Chat|RAG|Companion/).first()).toBeVisible({
      timeout: 15_000,
    })
  }

  async gotoInvitations() {
    await this.page.goto('/invitations', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/invitations/)
    await expect(this.page.getByText(/邀请码/).first()).toBeVisible({ timeout: 15_000 })
  }

  async gotoAudit() {
    await this.page.goto('/audit', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/audit/)
    await expect(this.page.getByText(/审计/).first()).toBeVisible({ timeout: 15_000 })
  }

  async gotoCompanions() {
    await this.page.goto('/companions', { waitUntil: 'domcontentloaded' })
    await expect(this.page).toHaveURL(/\/companions/)
    await expect(this.page.getByText(/内置伴侣/).first()).toBeVisible({ timeout: 15_000 })
  }

  async openCreateProviderModal() {
    const btn = this.page.getByRole('button', { name: /新建|添加|创建/ }).first()
    await btn.click()
    await expect(this.page.getByRole('dialog')).toBeVisible({ timeout: 10_000 })
    await expect(this.page.getByText(/新建提供商|编辑提供商/).first()).toBeVisible()
  }

  async selectPreset(label: string | RegExp) {
    const dialog = this.page.getByRole('dialog')
    // antd Select：点开后选选项
    await dialog.locator('.ant-select').first().click()
    await this.page.getByTitle(label).click().catch(async () => {
      await this.page.locator('.ant-select-item-option').filter({ hasText: label }).first().click()
    })
  }

  async fillProviderBasics(options: {
    name?: string
    apiKey: string
    baseUrl: string
  }) {
    const dialog = this.page.getByRole('dialog')
    if (options.name) {
      await dialog.getByPlaceholder('如 DeepSeek').fill(options.name)
    }
    await dialog.getByPlaceholder('sk-...').fill(options.apiKey)
    await dialog.getByPlaceholder('https://api.example.com/v1').fill(options.baseUrl)
  }

  async clickFetchModels() {
    const dialog = this.page.getByRole('dialog')
    const fetchBtn = dialog.getByRole('button', { name: /获取模型|拉取模型|一键获取/ })
    await expect(fetchBtn).toBeVisible({ timeout: 10_000 })

    const resPromise = this.page.waitForResponse(
      (r) => r.url().includes('/fetch-models') && r.request().method() === 'POST',
      { timeout: 60_000 },
    )
    await fetchBtn.click()
    return resPromise
  }
}
