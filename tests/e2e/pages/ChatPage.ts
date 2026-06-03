import { expect, type Page, type Locator } from '@playwright/test'

export class ChatPage {
  readonly page: Page
  readonly input: Locator
  readonly sendBtn: Locator
  readonly messageList: Locator
  readonly mentionDropdown: Locator

  constructor(page: Page) {
    this.page = page
    // ChatInput 组件中 textarea 在 [data-testid="chat-input"] 内部
    this.input = page.locator('[data-testid="chat-input"] textarea')
    this.sendBtn = page.locator('[data-testid="chat-send-btn"]')
    this.messageList = page.locator('[data-testid="chat-message-list"]')
    this.mentionDropdown = page.locator('[data-testid="kb-mention-dropdown"]')
  }

  async goto() {
    await this.page.goto('/app/chat')
  }

  /**
   * 确保 ChatInput 可见（处理 EmptySession → ChatInput 切换）
   */
  async ensureChatInputVisible() {
    const emptySession = this.page.locator('[data-testid="empty-session-input"]')
    try {
      const isVisible = await emptySession.isVisible()
      if (isVisible) {
        // 在 EmptySession 中发送消息创建会话
        await this.page.locator('[data-testid="empty-session-input"] textarea').fill('Hello')
        await this.sendBtn.click()
        await this.page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
      }
    } catch {
      // empty-session-input 不存在，说明已经是 ChatInput 状态
    }
    await this.page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })
  }

  async sendMessage(content: string) {
    // 如果当前是 EmptySession，先发送一条消息切换到 ChatInput
    const emptySession = this.page.locator('[data-testid="empty-session-input"]')
    try {
      const isVisible = await emptySession.isVisible()
      if (isVisible) {
        await this.page.locator('[data-testid="empty-session-input"] textarea').fill(content)
        await this.sendBtn.click()
        await this.page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
        return
      }
    } catch {
      // empty-session-input 不存在，继续用 ChatInput 方式发送
    }
    await this.input.fill(content)
    await this.sendBtn.click()
  }

  async triggerMention() {
    await this.input.click()
    await this.input.type('@')
    await this.page.waitForTimeout(300)
  }

  async selectMentionItem(index: number = 0) {
    await this.mentionDropdown.locator('[data-testid="kb-mention-item"]').nth(index).click()
  }

  async getMessages(): Promise<Locator[]> {
    return this.messageList.locator('[data-testid="chat-message"]').all()
  }

  async waitForMessageAppear(content: string, timeout: number = 5000) {
    await this.messageList.locator(`text=${content}`).waitFor({ timeout })
  }

  async waitForAiResponse(timeout: number = 15000) {
    // 等待 AI 消息出现（不假设位置，通过 data-role="assistant" 定位）
    const aiMessages = this.messageList.locator('[data-testid="chat-message"][data-role="assistant"]')
    await expect.poll(async () => aiMessages.count(), {
      timeout,
      message: '等待 AI 响应消息出现',
    }).toBeGreaterThanOrEqual(1)
  }
}
