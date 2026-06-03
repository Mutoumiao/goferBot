import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'

test.describe('知识库选择器 (f-11)', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)

    // 只 mock 必要的路由
    await page.route('**/api/auth/me', (route) => {
      route.fulfill({ json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } } })
    })
    await page.route('**/api/knowledge-bases', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: [
            { id: 'kb-1', name: '技术文档', icon: 'mdi-database', isPinned: false, sortOrder: 0, documentCount: 10 },
            { id: 'kb-2', name: '会议记录', icon: 'mdi-file-text', isPinned: true, sortOrder: 999, documentCount: 5 },
          ],
        })
      }
    })
    await page.route('**/api/sessions', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ json: { id: 'session-1', title: '新会话', createdAt: new Date().toISOString() } })
      } else if (route.request().method() === 'GET') {
        route.fulfill({ json: { items: [] } })
      }
    })
    await page.route('**/api/sessions/*', (route) => {
      route.fulfill({ json: { data: { session: { id: 'session-1', title: '新会话' }, messages: [] } } })
    })
    await page.route('**/api/chat', (route) => {
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"content":"AI 响应"}\n\n',
      })
    })
    await page.route('**/api/settings', (route) => {
      route.fulfill({
        json: {
          providers: { openai: { apiKey: '', model: 'gpt-4o' }, deepseek: { apiKey: 'fake', model: 'deepseek-chat' } },
          temperature: 0.7,
          defaultChatProvider: 'deepseek',
        },
      })
    })

    await page.goto('/app/chat')
    await page.waitForLoadState('networkidle')
    // 等待 EmptySession 或 ChatInput 出现
    await page.waitForSelector('[data-testid="empty-session-input"], [data-testid="chat-input"]', { timeout: 10000 })
  })

  async function ensureChatInputVisible(page: any) {
    // 检查是否显示 EmptySession
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible()) {
      // 需要发送一条消息创建会话，才能看到 ChatInput
      // EmptySession 中 textarea 是唯一的 textbox
      await page.locator('textarea').fill('Hello')
      await page.locator('[data-testid="chat-send-btn"]').click()
      // 等待消息发送完成，切换到 ChatInput
      await page.waitForTimeout(500)
    }
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })
  }

  test('TC-F11-001: @ 触发下拉显示知识库列表', async ({ page }) => {
    await ensureChatInputVisible(page)

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })
    await expect(dropdown).toBeVisible()

    const items = dropdown.locator('[data-testid="kb-selector-item"]')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('技术文档')
    await expect(items.nth(1)).toContainText('会议记录')
  })

  test('TC-F11-002: 选择知识库显示标签', async ({ page }) => {
    await ensureChatInputVisible(page)

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })

    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    const pill = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pill).toBeVisible()
    await expect(pill).toContainText('技术文档')
  })

  test('TC-F11-003: 多选知识库显示多个标签', async ({ page }) => {
    await ensureChatInputVisible(page)

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })

    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()
    await dropdown.locator('[data-testid="kb-selector-item"]').nth(1).click()

    const pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(2)
  })

  test('TC-F11-005: 按 Escape 关闭下拉', async ({ page }) => {
    await ensureChatInputVisible(page)

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })
    await expect(dropdown).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(dropdown).toBeHidden()
  })

  test('TC-F11-006: 删除已选标签', async ({ page }) => {
    await ensureChatInputVisible(page)

    const textarea = page.locator('[data-testid="chat-input"] textarea')
    await textarea.focus()
    await page.keyboard.type('@')

    const dropdown = page.locator('[data-testid="kb-selector-dropdown"]')
    await dropdown.waitFor({ timeout: 5000 })
    await dropdown.locator('[data-testid="kb-selector-item"]').first().click()

    // 点击后需要先关闭下拉菜单（点击页面其他地方或按Escape）
    await page.keyboard.press('Escape')
    await dropdown.waitFor({ state: 'hidden', timeout: 3000 })

    let pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(1)

    const removeBtn = page.locator('[data-testid="kb-mention-pill-remove"]')
    await removeBtn.click()

    pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(0)
  })
})
