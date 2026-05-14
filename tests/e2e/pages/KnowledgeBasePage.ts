import type { Page, Locator } from '@playwright/test'

export class KnowledgeBasePage {
  readonly page: Page
  readonly kbList: Locator
  readonly createBtn: Locator
  readonly importBtn: Locator
  readonly fileExplorer: Locator
  readonly contextMenu: Locator

  constructor(page: Page) {
    this.page = page
    this.kbList = page.locator('[data-testid="kb-list"]')
    this.createBtn = page.locator('[data-testid="create-kb-btn"]')
    this.importBtn = page.locator('[data-testid="import-files-btn"]')
    this.fileExplorer = page.locator('[data-testid="file-explorer"]')
    this.contextMenu = page.locator('[data-testid="context-menu"]')
  }

  async goto() {
    await this.page.goto('/knowledge-base')
  }

  async openKbContextMenu(kbName: string) {
    const item = this.page.locator('[data-testid="kb-item"]').filter({ hasText: kbName })
    await item.click({ button: 'right' })
  }

  async clickContextMenuItem(label: string) {
    await this.contextMenu.locator('text=' + label).click()
  }

  async createKnowledgeBase(name: string) {
    await this.createBtn.click()
    await this.page.locator('input[placeholder="输入知识库名称"]').fill(name)
    await this.page.locator('button:has-text("创建")').click()
  }

  async getKbItem(name: string): Promise<Locator> {
    return this.page.locator('[data-testid="kb-item"]').filter({ hasText: name })
  }
}
