import type { Page, Locator } from '@playwright/test'

export class HistoryPage {
  readonly page: Page
  readonly historyList: Locator
  readonly historyItems: Locator
  readonly newChatBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.historyList = page.locator('[data-testid="history-list"]')
    this.historyItems = page.locator('[data-testid="history-item"]')
    this.newChatBtn = page.locator('[data-testid="new-chat-btn"]')
  }

  async goto() {
    await this.page.goto('/history')
  }

  async clickSession(title: string) {
    await this.historyItems.filter({ hasText: title }).first().click()
  }

  async deleteSession(title: string) {
    const item = this.historyItems.filter({ hasText: title }).first()
    await item.hover()
    await item.locator('[data-testid="delete-session-btn"]').click()
  }

  async renameSession(oldTitle: string, newTitle: string) {
    const item = this.historyItems.filter({ hasText: oldTitle }).first()
    await item.hover()
    await item.locator('[data-testid="rename-session-btn"]').click()
    await this.page.locator('[data-testid="rename-input"]').fill(newTitle)
    await this.page.locator('[data-testid="rename-confirm"]').click()
  }

  getHistoryItemByTitle(title: string): Locator {
    return this.historyItems.filter({ hasText: title })
  }
}
