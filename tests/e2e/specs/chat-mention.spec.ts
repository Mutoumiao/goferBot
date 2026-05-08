import { test, expect } from '@playwright/test'
import { injectMockTauri } from '../mocks/tauri-ipc'
import { mockKnowledgeBases } from '../fixtures/knowledge-bases'
import { ChatPage } from '../pages/ChatPage'

test.describe('聊天 @提及 交互', () => {
  test.beforeEach(async ({ page }) => {
    await injectMockTauri(page)

    await page.route('http://127.0.0.1:*/knowledge-bases', (route) => {
      route.fulfill({ json: mockKnowledgeBases })
    })

    await page.route('http://127.0.0.1:*/sessions', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({ status: 201, json: { id: 'sess-new', title: '首页', created_at: new Date().toISOString() } })
      } else {
        route.fulfill({ json: [] })
      }
    })

    await page.route('http://127.0.0.1:*/chat', (route) => {
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: 'data: {"content":"Mock reply"}\n\n',
        })
      } else {
        route.continue()
      }
    })

    // 导航到首页，加载知识库列表，再进入对话态
    await page.goto('/')

    // 先切换到知识库页面，让知识库列表加载
    await page.getByRole('button', { name: '知识库', exact: true }).click()
    await page.waitForSelector('[data-testid="kb-item"]')

    // 切回问答页面
    await page.getByRole('button', { name: '问答', exact: true }).click()

    // 点击快捷提问进入对话态
    await page.getByText('什么是 RAG 检索增强生成？').click()
    await page.waitForSelector('[data-testid="chat-input"]')
  })

  test('输入 @ 弹出知识库下拉列表', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.triggerMention()
    await expect(chatPage.mentionDropdown).toBeVisible()
    await expect(chatPage.mentionDropdown.locator('[data-testid="kb-mention-item"]')).toHaveCount(2)
  })

  test('选择知识库后渲染 pill', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.triggerMention()
    await chatPage.selectMentionItem(0)

    await expect(page.locator('[data-testid="kb-mention-pill"]')).toBeVisible()
    await expect(page.locator('[data-testid="kb-mention-pill"]')).toContainText('技术文档')
  })

  test('发送消息后携带 knowledgeBaseIds', async ({ page }) => {
    let capturedBody: Record<string, unknown> | null = null

    await page.route('http://127.0.0.1:*/chat', (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postData()
        if (postData) {
          capturedBody = JSON.parse(postData)
        }
        route.fulfill({
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
          body: 'data: {"content":"Done"}\n\n',
        })
      } else {
        route.continue()
      }
    })

    const chatPage = new ChatPage(page)
    await chatPage.triggerMention()
    await chatPage.selectMentionItem(0)
    await chatPage.sendMessage('什么是 RAG？')

    await expect.poll(() => capturedBody).toBeTruthy()
    expect(capturedBody?.knowledgeBaseIds).toEqual(['kb1'])
  })
})
