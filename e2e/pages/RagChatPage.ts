import { expect, type Locator, type Page } from '@playwright/test'

/**
 * 知识库强制绑定后的 Chat 首页 / 会话页 POM。
 * 与旧 ChatPage 区分：占位符与 KB 选择器均已变更。
 */
export class RagChatPage {
  readonly page: Page
  readonly homeTitle: Locator
  readonly homeTextarea: Locator
  readonly homeSendButton: Locator
  readonly kbSelectorTrigger: Locator
  readonly kbSelectorDropdown: Locator
  readonly sourcesPanel: Locator
  readonly sourceItems: Locator
  readonly sourcesEmpty: Locator

  constructor(page: Page) {
    this.page = page
    this.homeTitle = page.getByText('今天想从知识库里理解什么？')
    this.homeTextarea = page.locator('textarea').first()
    this.homeSendButton = page.getByTestId('temp-send-btn')
    this.kbSelectorTrigger = page.getByTestId('kb-selector-trigger')
    this.kbSelectorDropdown = page.getByTestId('kb-selector-dropdown')
    this.sourcesPanel = page.getByTestId('sources-panel')
    this.sourceItems = page.getByTestId('source-item')
    this.sourcesEmpty = page.getByTestId('sources-empty')
  }

  async openChatHome() {
    await this.page.getByTitle('聊天', { exact: true }).click().catch(async () => {
      // 侧栏 title 来自 ROUTES_REGISTER.chat.title
      await this.page.getByTitle('对话', { exact: true }).click().catch(() => undefined)
    })
    // 直接走路由更稳：打开/chat 会 redirect 到临时 tab
    await this.page.goto('/chat', { waitUntil: 'domcontentloaded' })
    await expect(this.homeTitle).toBeVisible({ timeout: 20_000 })
  }

  async selectKnowledgeBaseByName(kbName: string) {
    await this.kbSelectorTrigger.click()
    await expect(this.kbSelectorDropdown).toBeVisible({ timeout: 10_000 })
    const item = this.kbSelectorDropdown.getByTestId('kb-selector-item').filter({
      hasText: kbName,
    })
    await expect(item).toBeVisible({ timeout: 10_000 })
    await item.click()
    // 关闭 popover：再点一次 trigger 或按 Escape
    await this.page.keyboard.press('Escape')
    await expect(this.kbSelectorTrigger).toContainText(/[1-9]/, { timeout: 5_000 })
  }

  async submitFromHome(question: string) {
    // 占位符随是否选 KB 变化，直接 fill textarea
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

  async waitForAssistantWithSources(timeoutMs = 90_000) {
    await expect(this.sourcesPanel).toBeVisible({ timeout: timeoutMs })
    await expect(this.sourceItems.first()).toBeVisible({ timeout: 10_000 })
  }

  async getVisibleAssistantText(): Promise<string> {
    // 会话页 Bubble + XMarkdown；尽量取 sources 附近正文
    const panel = this.sourcesPanel.first()
    const parent = panel.locator('xpath=ancestor::div[1]')
    const text = await parent.innerText().catch(() => '')
    if (text.trim()) return text

    const bubbles = this.page.locator(
      '.ant-design-x-bubble-list [role="assistant"], .ant-design-x-bubble-assistant, [class*="bubble"]',
    )
    const all = await bubbles.allTextContents()
    return all.join('\n')
  }
}
