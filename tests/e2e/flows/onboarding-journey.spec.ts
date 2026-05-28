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
    await expect(page.locator('[data-testid="chat-input"]')).toBeVisible()
  })

  test('AC-09: 创建第一个知识库', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    await kbPage.goto()
    await page.waitForSelector('[data-testid="create-kb-btn"]', { timeout: 10000 })

    const kbName = `我的知识库_${Date.now()}`
    await kbPage.createKnowledgeBase(kbName)

    const kbItem = await kbPage.getKbItem(kbName)
    await expect(kbItem).toBeVisible()
  })

  test('AC-10: 上传第一个文档', async ({ page }) => {
    const kbPage = new KnowledgeBasePage(page)
    await kbPage.goto()
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })

    // 选择 mock 路由中已存在的知识库
    await kbPage.selectKb('技术文档')
    await page.waitForSelector('[data-testid="file-explorer"]', { timeout: 10000 })

    await kbPage.uploadDocument('tests/e2e/fixtures/sample-doc.txt')
    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible()
  })

  test('AC-11: 新建会话并发送首条消息', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })

    await chatPage.sendMessage('你好，请介绍一下自己')
    await expect(
      page.locator('[data-testid="chat-message"]').filter({ hasText: '你好，请介绍一下自己' }),
    ).toBeVisible()
  })

  test('AC-12: 验证 AI 响应显示', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })

    await chatPage.sendMessage('你好')
    await chatPage.waitForAiResponse()

    const messages = await chatPage.getMessages()
    expect(messages.length).toBeGreaterThanOrEqual(2)
  })

  test('AC-13: 未创建 KB 直接聊天可用', async ({ page }) => {
    // mockApiRoutes 已提供 chat SSE mock，无需额外配置
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 })

    await chatPage.sendMessage('直接聊天测试')
    await expect(
      page.locator('[data-testid="chat-message"]').filter({ hasText: '直接聊天测试' }),
    ).toBeVisible()
    await chatPage.waitForAiResponse()
  })
})
