/**
 * @scope UI 行为测试（Mock API）
 * @purpose 验证新用户入职旅程中的路由守卫、页面导航、聊天交互
 * @note 使用 Mock API，不验证后端契约。
 *       创建 KB/上传文档的 API 契约验证见 tests/integration/auth-kb-document.spec.ts
 */
import { test, expect } from '@playwright/test'
import { mockApiRoutes } from '../../e2e/mocks/http-routes'
import { injectMockToken } from '../../e2e/fixtures/auth'
import { KnowledgeBasePage } from '../../e2e/pages/KnowledgeBasePage'
import { ChatPage } from '../../e2e/pages/ChatPage'

test.describe('新用户入职旅程', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockToken(page)
    await mockApiRoutes(page)
  })

  test('AC-08: 新用户注册后进入聊天页面', async ({ page }) => {
    await page.goto('/app/chat')
    await page.waitForLoadState('load')

    // 验证已登录用户停留在聊天页面（未被重定向到登录页）
    await expect(page).not.toHaveURL(/\/login/)
    // 页面可能是 EmptySession 或 ChatInput
    const hasChatInput = await page.locator('[data-testid="chat-input"]').isVisible().catch(() => false)
    if (hasChatInput) {
      await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
    } else {
      await expect(page.locator('[data-testid="empty-session-input"]')).toBeVisible()
    }
  })

  // ❌ AC-09 "创建第一个知识库" — 已移除（API 创建行为由 auth-kb-document 覆盖）
  // ❌ AC-10 "上传第一个文档" — 已移除（API 上传行为由 auth-kb-document 覆盖）

  test('AC-11: 新建会话并发送首条消息', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await chatPage.ensureChatInputVisible()

    await chatPage.sendMessage('你好，请介绍一下自己')
    await expect(
      page.locator('[data-testid="chat-message"]').filter({ hasText: '你好，请介绍一下自己' }),
    ).toBeVisible()
  })

  test('AC-12: 验证 AI 响应显示', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await chatPage.ensureChatInputVisible()

    await chatPage.sendMessage('你好')
    await chatPage.waitForAiResponse()

    const messages = await chatPage.getMessages()
    expect(messages.length).toBeGreaterThanOrEqual(2)
  })

  test('AC-13: 未创建 KB 直接聊天可用', async ({ page }) => {
    // mockApiRoutes 已提供 chat SSE mock，无需额外配置
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await chatPage.ensureChatInputVisible()

    await chatPage.sendMessage('直接聊天测试')
    await expect(
      page.locator('[data-testid="chat-message"]').filter({ hasText: '直接聊天测试' }),
    ).toBeVisible()
    await chatPage.waitForAiResponse()
  })
})
