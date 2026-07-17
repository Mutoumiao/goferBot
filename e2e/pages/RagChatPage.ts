import { expect, type Locator, type Page } from '@playwright/test'

/**
 * 知识库强制绑定后的 Chat 首页 / 会话页 POM。
 * UI：紧凑「引用 N 篇资料」+ SourceCitations（非旧 Bubble / source-item）。
 */
export class RagChatPage {
  readonly page: Page
  readonly homeTitle: Locator
  readonly homeTextarea: Locator
  readonly homeSendButton: Locator
  readonly kbSelectorTrigger: Locator
  readonly kbSelectorDropdown: Locator
  readonly sourcesPanel: Locator
  readonly sourcesTrigger: Locator
  readonly sourceDocItems: Locator
  readonly sourcesEmpty: Locator
  readonly assistantMessages: Locator
  readonly sessionView: Locator

  constructor(page: Page) {
    this.page = page
    this.homeTitle = page.getByTestId('chat-home-greeting')
    this.homeTextarea = page.locator('[data-testid="chat-empty-home"] textarea').first()
    this.homeSendButton = page.getByTestId('temp-send-btn')
    this.kbSelectorTrigger = page.getByTestId('kb-selector-trigger')
    this.kbSelectorDropdown = page.getByTestId('kb-selector-dropdown')
    this.sourcesPanel = page.getByTestId('sources-panel')
    this.sourcesTrigger = page.getByTestId('sources-trigger')
    this.sourceDocItems = page.getByTestId('source-doc-item')
    this.sourcesEmpty = page.getByTestId('sources-empty')
    this.assistantMessages = page.getByTestId('chat-msg-assistant')
    this.sessionView = page.getByTestId('chat-session-view')
  }

  async openChatHome() {
    await this.page.getByTestId('rail-chats').click().catch(() => undefined)
    await this.page.goto('/chats', { waitUntil: 'domcontentloaded' })
    await expect(this.page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 20_000 })
    await expect(this.homeTitle).toBeVisible({ timeout: 20_000 })
  }

  async selectKnowledgeBaseByName(kbName: string) {
    await this.kbSelectorTrigger.click()
    await expect(this.kbSelectorDropdown).toBeVisible({ timeout: 10_000 })
    const item = this.kbSelectorDropdown.getByTestId('kb-selector-item').filter({
      hasText: kbName,
    })
    await expect(item).toBeVisible({ timeout: 10_000 })
    // Popover 列表可能被 overflow 裁切，Playwright 原生 click 报 outside viewport
    await item.evaluate((el) => {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      ;(el as HTMLElement).click()
    })
    await this.page.keyboard.press('Escape')
    await expect(this.kbSelectorTrigger).toContainText(/[1-9]|·/, { timeout: 5_000 })
  }

  async submitFromHome(question: string) {
    await this.homeTextarea.fill(question)
    await expect(this.homeSendButton).toBeEnabled({ timeout: 5_000 })

    const sessionPromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/sessions') && r.request().method() === 'POST',
      { timeout: 20_000 },
    )
    const chatPromise = this.page.waitForResponse(
      (r) => r.url().includes('/chat-messages') && r.request().method() === 'POST',
      { timeout: 30_000 },
    )

    await this.homeSendButton.click()
    await sessionPromise
    await chatPromise
  }

  /** 等待引用摘要条出现（sources 可先于正文） */
  async waitForAssistantWithSources(timeoutMs = 90_000) {
    await expect(this.sessionView).toBeVisible({ timeout: Math.min(timeoutMs, 30_000) })
    await expect(this.sourcesPanel).toBeVisible({ timeout: timeoutMs })
    await expect(this.sourcesTrigger).toBeVisible({ timeout: 10_000 })
    await expect(this.sourcesTrigger).toContainText(/引用\s*\d+\s*篇/, { timeout: 5_000 })
  }

  /** 展开文档列表并校验至少一篇文档级引用 */
  async openSourcesAndExpectDocs(minCount = 1) {
    await this.sourcesTrigger.click()
    await expect(this.sourceDocItems.first()).toBeVisible({ timeout: 10_000 })
    const count = await this.sourceDocItems.count()
    expect(count, '应至少有文档级引用').toBeGreaterThanOrEqual(minCount)
    return count
  }

  async getVisibleAssistantText(): Promise<string> {
    const count = await this.assistantMessages.count()
    if (count === 0) {
      // 回退：sources 旁正文
      const panel = this.sourcesPanel.first()
      const parent = panel.locator('xpath=ancestor::div[1]')
      return (await parent.innerText().catch(() => '')) || ''
    }
    return (await this.assistantMessages.nth(count - 1).innerText()) ?? ''
  }
}
