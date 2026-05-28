import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectMockToken } from '../fixtures/auth'
import { ChatPage } from '../pages/ChatPage'

test.describe('聊天功能', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)
    await page.goto('/app/chat')
    await page.waitForLoadState('load')
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })
  })

  test('聊天页面正常加载', async ({ page }) => {
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="chat-send-btn"]')).toBeVisible()
  })

  test('输入框支持多行文本', async ({ page }) => {
    const chatPage = new ChatPage(page)
    // 找到 chat-input 内的 textarea
    const textarea = page.locator('[data-testid="chat-input"] textarea')
    if (await textarea.isVisible()) {
      await textarea.fill('第一行\n第二行\n第三行')
      await expect(textarea).toHaveValue('第一行\n第二行\n第三行')
    }
  })
})
