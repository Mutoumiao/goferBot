import { test, expect } from '@playwright/test'
import { injectMockToken } from '../../e2e/fixtures/auth'
import { mockApiRoutes } from '../../e2e/mocks/http-routes'

test.describe('聊天 SSE 流式响应与 @提及知识库 (q-18)', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)

    // 局部覆盖：SSE 流式逐字响应（格式与后端一致：{ chunk, done }）
    await page.route('**/api/chat', (route) => {
      if (route.request().method() === 'POST') {
        const body =
          'data: {"chunk":"你","done":false}\n\n' +
          'data: {"chunk":"好","done":false}\n\n' +
          'data: {"chunk":"！","done":false}\n\n'
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body,
        })
      }
    })

    await page.goto('/app/chat')
    await page.waitForLoadState('load')
    // 等待 EmptySession 或 ChatInput 出现
    await page.waitForSelector('[data-testid="empty-session-input"], [data-testid="chat-input"]', { timeout: 10000 })
  })

  test('AC-01: 聊天页面正常加载（输入框+发送按钮）', async ({ page }) => {
    // 页面可能是 EmptySession 或 ChatInput
    const hasChatInput = await page.locator('[data-testid="chat-input"]').isVisible().catch(() => false)
    if (hasChatInput) {
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
    } else {
      await expect(page.locator('[data-testid="empty-session-input"]')).toBeVisible()
    }
    await expect(page.locator('[data-testid="chat-send-btn"]')).toBeVisible()
  })

  test('AC-02: 发送消息显示在用户消息列表', async ({ page }) => {
    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    await page.locator('[data-testid="chat-input"] textarea').fill('Hello SSE')
    await page.click('[data-testid="chat-send-btn"]')

    // 等待消息列表出现
    await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })

    // 验证 Hello SSE 出现在消息列表中（不严格检查总数，因为 EmptySession 切换可能已有消息）
    await expect(
      page.locator('[data-testid="chat-message"]').filter({ hasText: 'Hello SSE' }),
    ).toBeVisible()
  })

  test('AC-03: SSE 流式响应显示 AI 回复', async ({ page }) => {
    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    await page.locator('[data-testid="chat-input"] textarea').fill('Hello')
    await page.click('[data-testid="chat-send-btn"]')

    // 等待消息列表出现
    await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })

    // 等待 AI 消息出现（最后一条消息）
    const messages = page.locator('[data-testid="chat-message"]')
    await expect.poll(async () => messages.count(), {
      timeout: 10000,
      message: '等待 AI 消息出现',
    }).toBeGreaterThanOrEqual(2)

    // 检查是否有错误提示
    const errorToast = page.locator('text=未配置 LLM 提供商')
    const hasLlmError = await errorToast.isVisible().catch(() => false)
    if (hasLlmError) {
      throw new Error('LLM provider not configured - settings not loaded')
    }

    // 给 SSE 流式数据一些时间累积
    await page.waitForTimeout(2000)

    // 验证 AI 消息最终内容（SSE mock 返回 "你好！"）— 取最后一条消息
    const allMessages = await messages.all()
    const aiMessage = allMessages[allMessages.length - 1]
    await expect(aiMessage).toContainText('你好！', { timeout: 10000 })
  })

  test('AC-04: @ 触发知识库选择器下拉', async ({ page }) => {
    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    const textarea = page.locator('[data-testid="chat-input"] [data-slot="textarea"]')
    await textarea.focus()
    await page.keyboard.type('@')

    // 等待下拉出现
    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })
    await expect(dropdown).toBeVisible()

    // 验证下拉中有知识库选项（依赖全局 mockApiRoutes 中的 /api/knowledge-bases）
    const items = dropdown.locator('[data-testid="kb-selector-item"]')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('技术文档')
    await expect(items.nth(1)).toContainText('会议记录')
  })

  test('AC-05: 选择知识库显示标签 pill', async ({ page }) => {
    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    const textarea = page.locator('[data-testid="chat-input"] [data-slot="textarea"]')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })

    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    const pill = page.locator('[data-testid="kb-mention-pill"]').first()
    await expect(pill).toBeVisible()
    await expect(pill).toContainText('技术文档')
  })

  test('AC-06: 多选知识库显示多个标签', async ({ page }) => {
    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    const textarea = page.locator('[data-testid="chat-input"] [data-slot="textarea"]')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })

    // KbSelector 使用 checkbox 多选，点击两次选择两个
    await dropdown.locator('[data-testid="kb-selector-item"]').nth(0).click()
    await dropdown.locator('[data-testid="kb-selector-item"]').nth(1).click()

    const pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(2)
  })

  test('AC-07: 删除已选标签', async ({ page }) => {
    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    const textarea = page.locator('[data-testid="chat-input"] [data-slot="textarea"]')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    // 关闭下拉
    await page.keyboard.press('Escape')
    await dropdown.waitFor({ state: 'hidden', timeout: 3000 })

    let pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(1)

    // 点击 pill 上的删除按钮
    const removeBtn = pills.first().locator('[data-testid="kb-mention-pill-remove"]')
    await removeBtn.click()

    pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(0)
  })

  test('AC-08: 发送请求 payload 包含 knowledgeBaseIds', async ({ page }) => {
    let capturedBody: any = null

    // 覆盖路由以捕获请求体
    await page.route('**/api/chat', (route) => {
      if (route.request().method() === 'POST') {
        capturedBody = route.request().postDataJSON()
        const body =
          'data: {"chunk":"O","done":false}\n\n' +
          'data: {"chunk":"K","done":false}\n\n'
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body,
        })
      }
    })

    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    const textarea = page.locator('[data-testid="chat-input"] [data-slot="textarea"]')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })
    await dropdown.locator('[data-testid="kb-selector-item"]').nth(0).click()
    await dropdown.locator('[data-testid="kb-selector-item"]').nth(1).click()

    await page.keyboard.press('Escape')
    await dropdown.waitFor({ state: 'hidden', timeout: 3000 })

    await textarea.fill('使用知识库')
    await page.click('[data-testid="chat-send-btn"]')

    // 等待请求被拦截
    await page.waitForTimeout(500)

    expect(capturedBody).not.toBeNull()
    expect(capturedBody.knowledgeBaseIds).toBeDefined()
    expect(capturedBody.knowledgeBaseIds.length).toBe(2)
  })

  test('AC-08b: SSE 错误时显示错误提示', async ({ page }) => {
    // 覆盖路由返回 500 错误
    await page.route('**/api/chat', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 500, body: 'Internal Server Error' })
      }
    })

    // 如果是 EmptySession，先发送消息切换到 ChatInput
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible().catch(() => false)) {
      await page.locator('[data-testid="empty-session-input"] textarea').fill('Setup')
      await page.click('[data-testid="chat-send-btn"]')
      await page.waitForSelector('[data-testid="chat-message-list"]', { timeout: 10000 })
    }

    await page.locator('[data-testid="chat-input"] textarea').fill('Trigger error')
    await page.click('[data-testid="chat-send-btn"]')

    // 等待错误 toast 出现（ChatView 中的错误提示）
    const errorToast = page.locator('text=Internal Server Error')
    await errorToast.waitFor({ timeout: 10000 })
    await expect(errorToast).toBeVisible()
  })
})
