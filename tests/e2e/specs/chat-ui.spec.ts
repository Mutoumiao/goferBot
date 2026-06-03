/**
 * @scope UI 行为测试（Mock API）
 * @purpose 验证聊天页面渲染、输入交互
 * @note 使用 Mock API，不验证 SSE 流式响应。
 *       SSE 流式响应验证见 tests/e2e/flows/chat-with-rag.spec.ts（真实后端）
 */
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
    // 等待 EmptySession 或 ChatInput 出现
    await page.waitForSelector('[data-testid="empty-session-input"], [data-testid="chat-input"]', { timeout: 10000 })
  })

  test('聊天页面正常加载', async ({ page }) => {
    // 页面可能是 EmptySession 或 ChatInput
    const hasChatInput = await page.locator('[data-testid="chat-input"]').isVisible().catch(() => false)
    if (hasChatInput) {
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="chat-send-btn"]')).toBeVisible()
    } else {
      // EmptySession 状态
      await expect(page.locator('[data-testid="empty-session-input"]')).toBeVisible()
      await expect(page.locator('[data-testid="chat-send-btn"]')).toBeVisible()
    }
  })

  test('输入框支持多行文本', async ({ page }) => {
    // 找到 textarea（EmptySession 或 ChatInput 中都有）
    const textarea = page.locator('textarea').first()
    await textarea.fill('第一行\n第二行\n第三行')
    await expect(textarea).toHaveValue('第一行\n第二行\n第三行')
  })
})
