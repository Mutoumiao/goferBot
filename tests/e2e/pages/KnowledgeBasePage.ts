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
    await this.page.goto('/app/knowledge-base')
  }

  async openKbContextMenu(kbName: string) {
    const item = this.page.locator('[data-testid="kb-item"]').filter({ hasText: kbName })
    await item.click({ button: 'right' })
  }

  async clickContextMenuItem(label: string) {
    await this.contextMenu.locator(`text=${label}`).click()
  }

  async createKnowledgeBase(name: string) {
    await this.createBtn.click()
    await this.page.locator('[data-testid="kb-name-input"]').fill(name)
    await this.page.locator('[data-testid="kb-create-confirm"]').click()
  }

  async getKbItem(name: string): Promise<Locator> {
    return this.page.locator('[data-testid="kb-item"]').filter({ hasText: name })
  }

  async selectKb(name: string) {
    await this.page.locator('[data-testid="kb-item"]').filter({ hasText: name }).click()
  }

  async uploadDocument(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]')
    await fileInput.setInputFiles(filePath)
    // 等待上传完成（根据前端实现调整）
    await this.page.waitForTimeout(1000)
  }
}
