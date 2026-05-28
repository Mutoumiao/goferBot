import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'

test.describe('知识库选择器 (f-11)', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)

    // Mock 知识库列表（覆盖 mockApiRoutes 默认值以适配选择器测试）
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

    // Mock 会话创建
    await page.route('**/api/sessions', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          json: { id: 'session-1', title: '新会话', createdAt: new Date().toISOString() },
        })
      }
    })

    await page.goto('/app/chat')
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })
  })

  async function ensureChatInputVisible(page: any) {
    // 检查是否显示 EmptySession
    const emptySession = page.locator('[data-testid="empty-session-input"]')
    if (await emptySession.isVisible()) {
      // 需要新建会话才能看到 ChatInput
      await page.locator('[data-testid="new-chat-btn"]').click()
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
    await removeBtn.click({ force: true })

    pills = page.locator('[data-testid="kb-mention-pill"]')
    await expect(pills).toHaveCount(0)
  })
})
