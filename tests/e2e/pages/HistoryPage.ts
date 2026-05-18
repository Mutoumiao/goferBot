import type { Page, Locator } from '@playwright/test'

export class HistoryPage {
  readonly page: Page
  readonly historyList: Locator
  readonly historyItems: Locator
  readonly newChatBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.historyList = page.locator('[data-testid="session-list"]')
    this.historyItems = page.locator('[data-testid="session-item"]')
    this.newChatBtn = page.locator('[data-testid="new-chat-btn"]')
  }

  async goto() {
    await this.page.goto('/app/history')
  }

  async clickSession(title: string) {
    await this.historyItems.filter({ hasText: title }).first().click()
  }

  async deleteSession(title: string) {
    const item = this.historyItems.filter({ hasText: title }).first()
    // 先点击菜单按钮打开菜单
    await item.locator('[data-testid="session-menu-btn"]').click()
    // 然后点击删除按钮
    await item.locator('[data-testid="session-delete-btn"]').click()
  }

  async renameSession(oldTitle: string, newTitle: string) {
    const item = this.historyItems.filter({ hasText: oldTitle }).first()
    // 先点击菜单按钮打开菜单
    await item.locator('[data-testid="session-menu-btn"]').click()
    // 然后点击重命名按钮
    await item.locator('[data-testid="session-rename-btn"]').click()
    await this.page.locator('[data-testid="rename-input"]').fill(newTitle)
    await this.page.locator('[data-testid="rename-input"]').press('Enter')
  }

  getHistoryItemByTitle(title: string): Locator {
    return this.historyItems.filter({ hasText: title })
  }
}
