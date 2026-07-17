import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Chat 工作台 POM（AI SDK useChat + shadcn 消息列表，不再依赖 ant-design Bubble）。
 */
export class ChatPage {
  readonly page: Page
  readonly homeTextarea: Locator
  readonly homeSendButton: Locator
  readonly sessionInput: Locator
  readonly sessionSendButton: Locator
  readonly messageList: Locator
  readonly userMessages: Locator
  readonly assistantMessages: Locator
  readonly sideBar: Locator
  readonly tabBar: Locator
  readonly homeTitle: Locator
  readonly sessionEmptyTitle: Locator
  readonly sessionView: Locator

  constructor(page: Page) {
    this.page = page
    this.homeTextarea = page.locator('[data-testid="chat-empty-home"] textarea').first()
    this.homeSendButton = page.getByTestId('temp-send-btn')
    this.sessionInput = page.locator('[data-testid="chat-session-view"] textarea').first()
    this.sessionSendButton = page.getByTestId('session-send-btn')
    this.messageList = page.getByTestId('chat-message-list')
    this.userMessages = page.getByTestId('chat-msg-user')
    this.assistantMessages = page.getByTestId('chat-msg-assistant')
    this.sideBar = page.getByTestId('icon-rail')
    this.tabBar = page.getByTestId('tab-bar')
    this.homeTitle = page.getByTestId('chat-home-greeting')
    this.sessionEmptyTitle = page.getByText('开始知识库问答')
    this.sessionView = page.getByTestId('chat-session-view')
  }

  async waitForHome() {
    await expect(this.page.getByTestId('chat-empty-home')).toBeVisible({ timeout: 10_000 })
    await expect(this.homeTextarea).toBeVisible({ timeout: 10_000 })
  }

  async submitFromHome(text: string) {
    await this.homeTextarea.fill(text)
    const sessionResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/sessions') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )
    await this.homeSendButton.click()
    const sessionRes = await sessionResponsePromise
    const sessionUrl = new URL(sessionRes.url())
    const locationHeader = sessionRes.headers()?.location
    const sessionId = locationHeader ? locationHeader.split('/').pop() : ''
    return { sessionRes, sessionId, sessionUrl }
  }

  async waitForSessionView() {
    await expect(this.sessionView).toBeVisible({ timeout: 30_000 })
    await expect(this.sessionInput).toBeVisible({ timeout: 30_000 })
  }

  async waitForAssistantReply(timeoutMs = 30_000) {
    await expect(this.messageList).toBeVisible({ timeout: timeoutMs })
    await expect(this.assistantMessages.first()).toBeVisible({ timeout: timeoutMs })
  }

  async getAssistantMessageCount(): Promise<number> {
    return this.assistantMessages.count()
  }

  async getLastAssistantText(): Promise<string> {
    const count = await this.assistantMessages.count()
    if (count === 0) return ''
    return (await this.assistantMessages.nth(count - 1).innerText()) ?? ''
  }
}
