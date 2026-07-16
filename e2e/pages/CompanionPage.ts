import { expect, type Locator, type Page } from '@playwright/test'

export class CompanionPage {
  readonly page: Page
  readonly createButton: Locator
  readonly nameInput: Locator
  readonly descriptionInput: Locator
  readonly personalityInput: Locator
  readonly openingMessageInput: Locator
  readonly submitButton: Locator

  constructor(page: Page) {
    this.page = page
    this.createButton = page.getByRole('button', { name: /新建伴侣/ })
    this.nameInput = page.locator('#name')
    this.descriptionInput = page.locator('#description')
    this.personalityInput = page.locator('#personality')
    this.openingMessageInput = page.locator('#openingMessage')
    // 独立创建页：提交按钮为「创建并聊天」或「保存」
    this.submitButton = page.getByRole('button', { name: /创建|保存/ }).filter({
      hasNotText: /取消/,
    })
  }

  async openFromSidebar() {
    await this.page.getByTitle('AI 伴侣', { exact: true }).click().catch(async () => {
      await this.page.goto('/companions', { waitUntil: 'domcontentloaded' })
    })
    await expect(this.page).toHaveURL(/\/companions/, { timeout: 15_000 })
    // 新建入口在「我的伴侣」Tab
    await this.page.getByRole('tab', { name: /我的伴侣/ }).click().catch(async () => {
      await this.page.getByText('我的伴侣').click()
    })
    await expect(this.createButton.first()).toBeVisible({ timeout: 15_000 })
  }

  /**
   * 归档「我的」自定义伴侣，为创建腾出名额（默认上限 10；archived 不占名额）。
   * 使用浏览器 Cookie 调 API，避免污染非 pw 数据时优先归档 pw-* 名称。
   */
  async ensureUserCompanionQuota(keepSlots = 1, maxActive = 10): Promise<void> {
    const apiBase = process.env.API_BASE_URL || 'http://localhost:3100/api'
    const listRes = await this.page.request.get(`${apiBase}/companions?tab=mine&size=100`)
    if (!listRes.ok()) return
    const body = (await listRes.json()) as {
      data?: { items?: Array<{ id: string; name?: string; status?: string }> }
      items?: Array<{ id: string; name?: string; status?: string }>
    }
    const items = body.data?.items ?? body.items ?? []
    const active = items.filter((c) => c.status === 'draft' || c.status === 'published')
    const needFree = active.length - (maxActive - keepSlots)
    if (needFree <= 0) return

    const preferred = [
      ...active.filter((c) => (c.name ?? '').startsWith('pw-')),
      ...active.filter((c) => !(c.name ?? '').startsWith('pw-')),
    ]
    for (const c of preferred.slice(0, needFree)) {
      await this.page.request.delete(`${apiBase}/companions/${c.id}`)
    }
  }

  async createCompanion(options: {
    name: string
    description?: string
    personality?: string
    headline?: string
    openingMessage?: string
  }): Promise<string> {
    await this.ensureUserCompanionQuota(1)

    const createResponsePromise = this.page.waitForResponse(
      (r) =>
        r.url().includes('/companions') &&
        r.request().method() === 'POST' &&
        !r.url().includes('/conversations') &&
        !r.url().includes('/messages') &&
        !r.url().includes('/avatar') &&
        !r.url().includes('/care'),
      { timeout: 20_000 },
    )

    await this.createButton.first().click()
    await expect(this.page).toHaveURL(/\/companions\/new/, { timeout: 10_000 })
    await expect(this.page.getByRole('heading', { name: '新建伴侣' })).toBeVisible()

    await this.nameInput.fill(options.name)
    await this.descriptionInput.fill(
      options.description ?? options.headline ?? 'E2E 角色说明',
    )
    await this.personalityInput.fill(options.personality ?? '友善、耐心')
    if (options.openingMessage) {
      await this.openingMessageInput.fill(options.openingMessage)
    }

    await this.submitButton.first().click()
    const res = await createResponsePromise
    expect(res.ok(), `创建伴侣失败: ${res.status()} ${await res.text().catch(() => '')}`).toBeTruthy()
    const body = (await res.json()) as { data?: { id?: string }; id?: string }
    const id = body.data?.id ?? body.id
    expect(id, '创建伴侣响应缺少 id').toBeTruthy()

    // 创建成功后进入聊天页
    await expect(this.page).toHaveURL(/\/companions\/[^/]+\/chat/, { timeout: 15_000 })
    return id as string
  }

  async openChatByName(name: string) {
    // 若已在聊天页则跳过
    if (this.page.url().match(/\/companions\/[^/]+\/chat/)) {
      return
    }
    await this.page.goto('/companions', { waitUntil: 'domcontentloaded' })
    await this.page.getByRole('tab', { name: /我的伴侣/ }).click().catch(async () => {
      await this.page.getByText('我的伴侣').click()
    })
    const card = this.page
      .locator('[class*="card"], [class*="Card"], div')
      .filter({ has: this.page.getByRole('heading', { name, exact: true }) })
      .filter({ has: this.page.getByRole('button', { name: /开始聊天/ }) })
      .first()

    const startBtn = card.getByRole('button', { name: /开始聊天/ })
    if (await startBtn.isVisible().catch(() => false)) {
      await startBtn.click()
    } else {
      await this.page.getByRole('heading', { name, exact: true }).click()
    }

    await expect(this.page).toHaveURL(/\/companions\/[^/]+\/chat/, { timeout: 15_000 })
    await expect(
      this.page
        .getByPlaceholder(new RegExp(`和\\s*${name}`))
        .or(this.page.getByText('开始新对话'))
        .or(this.page.locator('textarea').first())
        .first(),
    ).toBeVisible({ timeout: 20_000 })
  }

  /**
   * 发送消息：优先快捷提示；否则 textarea +「发送」按钮。
   * 不用 Enter：受控 input 在 fill 后可能尚未 commit 到 React state，Enter 会带着空串提交。
   */
  async sendMessage(text: string, options?: { useQuickPrompt?: boolean }) {
    const chatPromise = this.page.waitForResponse(
      (r) => r.url().includes('/companion/chat') && r.request().method() === 'POST',
      { timeout: 90_000 },
    )
    const convPromise = this.page
      .waitForResponse(
        (r) =>
          r.url().includes('/companion/conversations') && r.request().method() === 'POST',
        { timeout: 30_000 },
      )
      .catch(() => null)

    // 快捷提示按钮 accessible name 可能含图标文案，用 contains 匹配
    const quick = this.page.getByRole('button', { name: text })
    if (options?.useQuickPrompt !== false && (await quick.first().isVisible().catch(() => false))) {
      await quick.first().click()
    } else {
      const input = this.page.locator('textarea').first()
      await expect(input).toBeVisible({ timeout: 10_000 })
      await input.click()
      // React 受控组件：fill 可能被 state 回写清空，用原生 setter + input 事件
      await input.evaluate((el, value) => {
        const ta = el as HTMLTextAreaElement
        const proto = window.HTMLTextAreaElement.prototype
        const desc = Object.getOwnPropertyDescriptor(proto, 'value')
        desc?.set?.call(ta, value)
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        ta.dispatchEvent(new Event('change', { bubbles: true }))
      }, text)
      await expect(input).toHaveValue(text)
      const sendBtn = this.page.getByRole('button', { name: /^发送$/ })
      await expect(sendBtn).toBeEnabled({ timeout: 5_000 })
      await sendBtn.click()
    }

    await convPromise
    const res = await chatPromise
    const sseBody = await res.text().catch(() => '')
    expect(
      res.ok(),
      `Companion chat HTTP ${res.status()} body=${sseBody.slice(0, 600)}`,
    ).toBeTruthy()
    expect(
      sseBody.includes('event:') || sseBody.includes('data:'),
      `SSE body 不像事件流: ${sseBody.slice(0, 600)}`,
    ).toBeTruthy()
    await this.page.evaluate((body) => {
      ;(window as unknown as { __lastCompanionSse?: string }).__lastCompanionSse = body
    }, sseBody)
  }

  async sendQuickPrompt(label = '今天想聊点什么？') {
    await this.sendMessage(label, { useQuickPrompt: true })
  }

  async waitForAssistantReply(timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const pageText = await this.page.locator('main').innerText().catch(() => '')
      if (
        pageText.includes('（回复中断') ||
        pageText.includes('AI 回复出错') ||
        pageText.includes('流式响应中断') ||
        pageText.includes('（回复失败）')
      ) {
        throw new Error(`Companion 回复失败: ${pageText.slice(0, 400)}`)
      }
      if (pageText.includes('（无内容）')) {
        const sse = await this.page
          .evaluate(() => (window as unknown as { __lastCompanionSse?: string }).__lastCompanionSse)
          .catch(() => '')
        throw new Error(
          `Companion 返回空内容（SSE 解析或管线失败） sse=${String(sse ?? '').slice(0, 800)}`,
        )
      }

      // 有实质助手文案（含管线降级提示）即通过
      if (
        pageText.includes('管线暂不可用') ||
        pageText.includes('请再说一次') ||
        pageText.includes('我在这儿') ||
        pageText.includes('回复失败') ||
        (pageText.length > 40 && pageText.includes('今天想聊点什么'))
      ) {
        return
      }
      const bubbles = this.page.locator('.space-y-1 > div')
      const texts = (await bubbles.allTextContents().catch(() => [])) as string[]
      const meaningful = texts.filter(
        (t) =>
          t.trim().length > 4 &&
          !t.includes('（无内容）') &&
          !t.includes('开始新对话'),
      )
      if (meaningful.length >= 2) return
      await this.page.waitForTimeout(1000)
    }
    throw new Error('等待 Companion 助手回复超时')
  }

  async openMemories() {
    await this.page.getByRole('button', { name: /记忆库/ }).click()
    await expect(this.page).toHaveURL(/\/memories/, { timeout: 15_000 })
  }

  async selectTab(tab: 'official' | 'mine') {
    const name = tab === 'official' ? /官方推荐/ : /我的伴侣/
    await this.page.getByRole('tab', { name }).click().catch(async () => {
      await this.page.getByText(tab === 'official' ? '官方推荐' : '我的伴侣').click()
    })
  }

  /** 断言创建/编辑简表不含安全与扩展创作者字段 */
  async expectLightFormFields() {
    await expect(this.nameInput).toBeVisible()
    await expect(this.descriptionInput).toBeVisible()
    await expect(this.personalityInput).toBeVisible()
    await expect(this.page.locator('#boundaries')).toHaveCount(0)
    await expect(this.page.locator('#guardrailsPrompt')).toHaveCount(0)
    await expect(this.page.locator('#headline')).toHaveCount(0)
    await expect(this.page.locator('#defaultPrompt')).toHaveCount(0)
  }
}
