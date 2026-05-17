import type { Page } from '@playwright/test'

export async function mockApiRoutes(page: Page) {
  // Health check
  await page.route('**/health', (route) => {
    route.fulfill({ json: { status: 'ok' } })
  })

  // Auth endpoints (handled separately in auth fixture)

  // Chat endpoints
  await page.route('**/chat', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"content":"这是一个 AI 响应"}\n\n',
      })
    }
  })

  // Sessions endpoints
  await page.route('**/sessions', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: [
          { id: 'session-1', title: 'RAG 测试', createdAt: new Date().toISOString() },
          { id: 'session-2', title: '系统架构讨论', createdAt: new Date().toISOString() },
        ],
      })
    } else if (route.request().method() === 'POST') {
      route.fulfill({
        json: { id: 'session-new', title: '新会话', createdAt: new Date().toISOString() },
      })
    }
  })

  await page.route('**/sessions/*', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          id: 'session-1',
          title: 'RAG 测试',
          messages: [
            { id: 'msg-1', role: 'user', content: '你好' },
            { id: 'msg-2', role: 'assistant', content: '你好！有什么可以帮你？' },
          ],
        },
      })
    }
  })

  // Knowledge bases endpoints
  await page.route('**/knowledge-bases', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: [
          { id: 'kb-1', name: '技术文档', isPinned: false, sortOrder: 0 },
          { id: 'kb-2', name: '会议记录', isPinned: false, sortOrder: 1 },
        ],
      })
    }
  })

  // Documents endpoints
  await page.route('**/knowledge-bases/*/documents', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: [
          { id: 'doc-1', title: 'API 设计规范', size: 1024, createdAt: new Date().toISOString() },
          { id: 'doc-2', title: '架构图', size: 2048, createdAt: new Date().toISOString() },
        ],
      })
    }
  })
}
