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

    const chatPage = new ChatPage(page)
    await chatPage.goto()
  })

  test('输入 @ 弹出知识库下拉列表', async ({ page }) => {
    const chatPage = new ChatPage(page)
    await chatPage.triggerMention()
    await expect(chatPage.mentionDropdown).toBeVisible()
    await expect(chatPage.mentionDropdown.locator('li')).toHaveCount(2)
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
        route.request().text().then((text) => {
          capturedBody = JSON.parse(text)
        })
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
