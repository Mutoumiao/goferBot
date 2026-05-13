import type { Page, Locator } from '@playwright/test'

export class HistoryPage {
  readonly page: Page
  readonly historyList: Locator
  readonly newChatBtn: Locator
  readonly emptyState: Locator

  constructor(page: Page) {
    this.page = page
    this.historyList = page.locator('[data-testid="history-list"]')
    this.newChatBtn = page.locator('[data-testid="new-chat-btn"]')
    this.emptyState = page.locator('[data-testid="history-empty"]')
  }

  async goto() {
    await this.page.goto('/history')
  }

  async getSessionItems(): Promise<Locator[]> {
    return this.historyList.locator('[data-testid="history-item"]').all()
  }

  async clickSession(name: string) {
    await this.historyList.locator('[data-testid="history-item"]').filter({ hasText: name }).click()
  }

  async deleteSession(name: string) {
    const item = this.historyList.locator('[data-testid="history-item"]').filter({ hasText: name })
    await item.hover()
    await item.locator('[data-testid="history-delete-btn"]').click()
  }

  async renameSession(name: string, newName: string) {
    const item = this.historyList.locator('[data-testid="history-item"]').filter({ hasText: name })
    await item.hover()
    await item.locator('[data-testid="history-rename-btn"]').click()
    const input = item.locator('[data-testid="history-rename-input"]')
    await input.fill(newName)
    await input.press('Enter')
  }
}
