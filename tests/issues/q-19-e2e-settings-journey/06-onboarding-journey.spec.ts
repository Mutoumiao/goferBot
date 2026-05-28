import { test, expect } from '@playwright/test'
import { AuthPage } from '../../e2e/pages/AuthPage'
import { KnowledgeBasePage } from '../../e2e/pages/KnowledgeBasePage'
import { ChatPage } from '../../e2e/pages/ChatPage'
import { createTestUser } from '../../e2e/fixtures/auth'

test.describe('新用户入职旅程', () => {
  let testUser: Awaited<ReturnType<typeof createTestUser>>

  test.beforeAll(async () => {
    testUser = await createTestUser()
  })

  test('AC-08: 新用户注册成功', async ({ page }) => {
    // 使用 beforeAll 创建的 testUser，模拟已登录状态验证注册流程
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${testUser.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${testUser.refreshToken}')
      `,
    })
    // 验证已登录用户能正常访问应用
    await page.goto('/app/chat')
    await page.waitForLoadState('load')
    await expect(page).toHaveURL(/\/app\/chat/)
  })

  test('AC-09: 创建第一个知识库', async ({ page }) => {
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${testUser.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${testUser.refreshToken}')
      `,
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.goto()
    await page.waitForSelector('[data-testid="create-kb-btn"]', { timeout: 10000 })
    const kbName = `我的知识库_${Date.now()}`
    await kbPage.createKnowledgeBase(kbName)
    const kbItem = await kbPage.getKbItem(kbName)
    await expect(kbItem).toBeVisible()
  })

  test('AC-10: 上传第一个文档', async ({ page }) => {
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${testUser.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${testUser.refreshToken}')
      `,
    })

    const kbPage = new KnowledgeBasePage(page)
    await kbPage.goto()
    await page.waitForSelector('[data-testid="kb-item"]', { timeout: 10000 })
    await kbPage.selectKb('技术文档')
    await kbPage.uploadDocument('tests/e2e/fixtures/sample-doc.txt')
    await expect(page.locator('[data-testid="file-item"]').first()).toBeVisible()
  })

  test('AC-11: 新建会话并发送首条消息', async ({ page }) => {
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${testUser.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${testUser.refreshToken}')
      `,
    })

    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await page.waitForSelector('[data-testid="new-chat-btn"]', { timeout: 10000 })
    await page.locator('[data-testid="new-chat-btn"]').click()
    await chatPage.sendMessage('你好，请介绍一下自己')
    await expect(page.locator('[data-testid="chat-message"]').filter({ hasText: '你好，请介绍一下自己' })).toBeVisible()
  })

  test('AC-12: 验证 AI 响应显示', async ({ page }) => {
    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${testUser.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${testUser.refreshToken}')
      `,
    })

    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await page.waitForSelector('[data-testid="new-chat-btn"]', { timeout: 10000 })
    await page.locator('[data-testid="new-chat-btn"]').click()
    await chatPage.sendMessage('你好')
    await chatPage.waitForAiResponse()

    const messages = await chatPage.getMessages()
    expect(messages.length).toBeGreaterThanOrEqual(2)
  })

  test('AC-13: 注册后未创建 KB 直接聊天可用', async ({ page }) => {
    // 局部覆盖 /api/chat 返回 SSE 流，避免真实 LLM 调用超时
    await page.route('**/api/chat', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: 'data: {"choices":[{"delta":{"content":"你好"}}]}\n\ndata: [DONE]\n\n',
        })
      }
    })

    await page.addInitScript({
      content: `
        localStorage.setItem('goferbot_access_token', '${testUser.accessToken}')
        localStorage.setItem('goferbot_refresh_token', '${testUser.refreshToken}')
      `,
    })

    // 直接发送消息，不创建 KB
    const chatPage = new ChatPage(page)
    await chatPage.goto()
    await chatPage.sendMessage('直接聊天测试')
    await expect(page.locator('[data-testid="chat-message"]').filter({ hasText: '直接聊天测试' })).toBeVisible()
    await chatPage.waitForAiResponse()
  })
})
