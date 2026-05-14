import type { Page, Locator } from '@playwright/test'

export class HistoryPage {
  readonly page: Page
  readonly historyList: Locator
  readonly historyItems: Locator

  constructor(page: Page) {
    this.page = page
    this.historyList = page.locator('[data-testid="history-list"]')
    this.historyItems = page.locator('[data-testid="history-item"]')
  }

  async goto() {
    await this.page.goto('/')
    await this.page.locator('button:has(.lucide-history)').click()
  }

  getHistoryItemByTitle(title: string): Locator {
    return this.historyItems.filter({ hasText: title })
  }

  async renameSession(oldTitle: string, newTitle: string) {
    const item = this.getHistoryItemByTitle(oldTitle)
    await item.locator('[data-testid="history-menu-btn"]').click()
    await item.locator('[data-testid="history-rename-btn"]').click()
    const input = this.page.locator('[data-testid="history-rename-input"]')
    await input.waitFor({ state: 'visible' })
    await this.page.waitForTimeout(300)
    await input.fill(newTitle)
    await input.press('Enter')
  }

  async deleteSession(title: string) {
    const item = this.getHistoryItemByTitle(title)
    await item.locator('[data-testid="history-menu-btn"]').click()
    await item.locator('[data-testid="history-delete-btn"]').click()
  }

  async clickSession(title: string) {
    await this.getHistoryItemByTitle(title).click()
  }
}
