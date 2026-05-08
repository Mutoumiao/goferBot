import type { Page, Locator } from '@playwright/test'

export class ChatPage {
  readonly page: Page
  readonly input: Locator
  readonly sendBtn: Locator
  readonly messageList: Locator
  readonly mentionDropdown: Locator

  constructor(page: Page) {
    this.page = page
    this.input = page.locator('[data-testid="chat-input"] textarea, [data-testid="chat-input"] input')
    this.sendBtn = page.locator('[data-testid="chat-send-btn"]')
    this.messageList = page.locator('[data-testid="chat-message-list"]')
    this.mentionDropdown = page.locator('[data-testid="kb-mention-dropdown"]')
  }

  async goto() {
    await this.page.goto('/')
  }

  async sendMessage(content: string) {
    await this.input.fill(content)
    await this.sendBtn.click()
  }

  async triggerMention() {
    await this.input.click()
    // 绕过键盘布局差异，直接派发 key 为 '@' 的 keydown 事件
    await this.input.evaluate((el: HTMLElement) => {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: '@', bubbles: true }))
    })
  }

  async selectMentionItem(index: number = 0) {
    await this.mentionDropdown.locator('[data-testid="kb-mention-item"]').nth(index).click()
  }

  async getMessages(): Promise<Locator[]> {
    return this.messageList.locator('[data-testid="chat-message"]').all()
  }
}
