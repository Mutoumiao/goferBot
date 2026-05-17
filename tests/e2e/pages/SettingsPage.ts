import type { Page, Locator } from '@playwright/test'

export class SettingsPage {
  readonly page: Page
  readonly navTabs: Locator
  readonly saveBtn: Locator
  readonly errorMessage: Locator

  constructor(page: Page) {
    this.page = page
    this.navTabs = page.locator('[data-testid="settings-nav-tabs"]')
    this.saveBtn = page.locator('[data-testid="settings-save-btn"]')
    this.errorMessage = page.locator('[data-testid="settings-error"]')
  }

  async goto() {
    await this.page.goto('/settings')
  }

  async clickTab(name: string) {
    await this.navTabs.locator(`text=${name}`).click()
  }

  async fillInput(name: string, value: string) {
    await this.page.locator(`[name="${name}"]`).fill(value)
  }

  async save() {
    await this.saveBtn.click()
  }

  async getErrorMessages(): Promise<string[]> {
    return this.errorMessage.allTextContents()
  }
}
