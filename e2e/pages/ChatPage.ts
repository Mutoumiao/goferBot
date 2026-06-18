import { expect, type Page, type Locator } from '@playwright/test'

export class ChatPage {
  readonly page: Page
  readonly homeTextarea: Locator
  readonly homeSendButton: Locator
  readonly sessionInput: Locator
  readonly sessionSendButton: Locator
  readonly bubbleList: Locator
  readonly userBubbles: Locator
  readonly assistantBubbles: Locator
  readonly sideBar: Locator
  readonly tabBar: Locator
  readonly homeTitle: Locator
  readonly sessionEmptyTitle: Locator

  constructor(page: Page) {
    this.page = page
    this.homeTextarea = page.getByPlaceholder('询问、总结或让 AI 帮你整理桌面资料...')
    this.homeSendButton = page.getByTestId('temp-send-btn')
    this.sessionInput = page.getByPlaceholder('继续追问，或让 AI 生成需求条目...')
    this.sessionSendButton = page.locator('.ant-design-x-sender-suffix button, button.ant-btn-primary').first()
    this.bubbleList = page.locator('.ant-design-x-bubble-list')
    this.userBubbles = page.locator('.ant-design-x-bubble-list .ant-design-x-bubble-user, [role="user"]')
    this.assistantBubbles = page.locator('.ant-design-x-bubble-list .ant-design-x-bubble-assistant, [role="assistant"]')
    this.sideBar = page.locator('aside, [data-slot="sidebar"]').first()
    this.tabBar = page.locator('[data-slot="tabbar"], nav[class*="tab-bar"]').first()
    this.homeTitle = page.getByText('今天想从知识库里理解什么？')
    this.sessionEmptyTitle = page.getByText('开始新对话')
  }

  async waitForHome() {
    await expect(this.homeTextarea).toBeVisible({ timeout: 10_000 })
  }

  async submitFromHome(text: string) {
    await this.homeTextarea.fill(text)
    const sessionResponsePromise = this.page.waitForResponse(
      (r) => r.url().includes('/api/sessions') && r.request().method() === 'POST',
      { timeout: 15_000 },
    )
    this.homeSendButton.click()
    const sessionRes = await sessionResponsePromise
    const sessionUrl = new URL(sessionRes.url())
    const locationHeader = sessionRes.headers()?.location
    const sessionId = locationHeader ? locationHeader.split('/').pop() : ''
    return { sessionRes, sessionId, sessionUrl }
  }

  async waitForSessionView() {
    await expect(this.sessionInput.first()).toBeVisible({ timeout: 30_000 })
  }

  async waitForAssistantReply(timeoutMs = 30_000) {
    await expect(this.bubbleList).toBeVisible({ timeout: timeoutMs })
    await this.page.waitForSelector('.ant-design-x-bubble-list [role="assistant"], .ant-design-x-bubble-assistant', {
      state: 'visible',
      timeout: timeoutMs,
    })
  }

  async getAssistantMessageCount(): Promise<number> {
    return await this.page.locator('.ant-design-x-bubble-list [role="assistant"], .ant-design-x-bubble-assistant').count()
  }

  async getLastAssistantText(): Promise<string> {
    const texts = await this.page.locator('.ant-design-x-bubble-list [role="assistant"] .ant-design-x-bubble-content, .ant-design-x-bubble-assistant .ant-design-x-bubble-content').allTextContents()
    return texts[texts.length - 1] ?? ''
  }
}
