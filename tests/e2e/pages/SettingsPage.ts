import { expect, type Page, type Locator } from '@playwright/test'

export class SettingsPage {
  readonly page: Page
  readonly navTabs: Locator
  readonly saveBtn: Locator
  readonly formInputs: Locator

  constructor(page: Page) {
    this.page = page
    this.navTabs = page.locator('[data-testid="settings-nav-tabs"]')
    this.saveBtn = page.locator('[data-testid="settings-save-btn"]')
    this.formInputs = page.locator('[data-testid="settings-form"] input, [data-testid="settings-form"] select')
  }

  async goto() {
    await this.page.goto('/')
    await this.page.locator('button:has(.lucide-settings)').first().click()
    await expect(this.navTabs).toBeVisible()
  }

  async clickTab(label: string) {
    await this.navTabs.locator('text=' + label).click()
  }

  async fillInput(name: string, value: string) {
    await this.page.locator(`[data-testid="settings-form"] [name="${name}"]`).fill(value)
  }

  async save() {
    await expect(this.saveBtn).toBeEnabled()
    await this.saveBtn.click()
  }

  async getErrorMessages(): Promise<string[]> {
    return this.page.locator('[data-testid="settings-error"]').allTextContents()
  }
}
