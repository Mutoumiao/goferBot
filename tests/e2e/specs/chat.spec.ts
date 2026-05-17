import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../mocks/http-routes'
import { injectAuthToken } from '../fixtures/auth'
import { ChatPage } from '../pages/ChatPage'

test.describe('聊天功能', () => {
  test.beforeEach(async ({ page }) => {
    await injectAuthToken(page)
    await mockApiRoutes(page)

    await page.route('**/auth/me', (route) => {
      if (route.request().method() === 'GET') {
        route.fulfill({
          json: { id: 'user-1', email: 'test@example.com', name: 'Test User' },
        })
      }
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('聊天页面正常加载', async ({ page }) => {
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
    await expect(page.locator('[data-testid="chat-send-btn"]')).toBeVisible()
  })

  test('输入框支持多行文本', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await page.locator('[data-testid="chat-input"]').fill('第一行\n第二行\n第三行')
    await expect(page.locator('[data-testid="chat-input"]')).toContainText('第一行')
    await expect(page.locator('[data-testid="chat-input"]')).toContainText('第二行')
    await expect(page.locator('[data-testid="chat-input"]')).toContainText('第三行')
  })
})
