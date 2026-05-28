import type { Page } from '@playwright/test'

export async function mockApiRoutes(page: Page) {
  // Health check
  await page.route('**/api/health', (route) => {
    route.fulfill({ json: { status: 'ok' } })
  })

  // Auth endpoints
  await page.route('**/api/auth/me', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: { data: { id: 'user-1', email: 'test@example.com', name: 'Test User' } },
      })
    }
  })

  await page.route('**/api/auth/refresh', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        json: {
          data: {
            accessToken: 'mock-access-token-refreshed',
            refreshToken: 'mock-refresh-token-refreshed',
          },
        },
      })
    }
  })

  // Chat endpoints
  await page.route('**/api/chat', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
        body: 'data: {"content":"这是一个 AI 响应"}\n\n',
      })
    }
  })

  // Sessions endpoints
  await page.route('**/api/sessions', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          items: [
            { id: 'session-1', title: 'RAG 测试', createdAt: new Date(Date.now() - 3600000).toISOString(), updatedAt: new Date(Date.now() - 3600000).toISOString(), messageCount: 5 },
            { id: 'session-2', title: '系统架构讨论', createdAt: new Date(Date.now() - 7200000).toISOString(), updatedAt: new Date(Date.now() - 7200000).toISOString(), messageCount: 3 },
          ],
        },
      })
    } else if (route.request().method() === 'POST') {
      route.fulfill({
        json: { id: 'session-new', title: '新会话', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messageCount: 0 },
      })
    }
  })

  await page.route('**/api/sessions/*', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          data: {
            session: { id: 'session-1', title: 'RAG 测试', provider: null, model: null, messageCount: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
            messages: [
              { id: 'msg-1', role: 'user', content: '你好', createdAt: new Date().toISOString() },
              { id: 'msg-2', role: 'assistant', content: '你好！有什么可以帮你？', createdAt: new Date().toISOString() },
            ],
          },
        },
      })
    } else if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { data: { success: true } } })
    } else if (route.request().method() === 'PATCH') {
      route.fulfill({ json: { data: { success: true } } })
    }
  })

  // Knowledge bases endpoints
  await page.route('**/api/knowledge-bases', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          data: [
            { id: 'kb-1', name: '技术文档', is_pinned: 0, sort_order: 0, created_at: Date.now() },
            { id: 'kb-2', name: '会议记录', is_pinned: 0, sort_order: 1, created_at: Date.now() },
          ],
        },
      })
    } else if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON()
      route.fulfill({
        json: {
          data: { id: `kb-${Date.now()}`, name: body?.name || 'New KB', is_pinned: 0, sort_order: 0, created_at: Date.now() },
        },
      })
    }
  })

  await page.route('**/api/knowledge-bases/*', (route) => {
    if (route.request().method() === 'DELETE') {
      route.fulfill({ json: { data: { success: true } } })
    } else if (route.request().method() === 'PATCH') {
      route.fulfill({ json: { data: { success: true } } })
    }
  })

  // Documents endpoints
  await page.route('**/api/knowledge-bases/*/documents', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          data: [
            { id: 'doc-1', title: 'API 设计规范', size: 1024, created_at: new Date().toISOString() },
            { id: 'doc-2', title: '架构图', size: 2048, created_at: new Date().toISOString() },
          ],
        },
      })
    }
  })

  await page.route('**/api/knowledge-bases/*/documents/upload', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        json: {
          data: { id: `doc-${Date.now()}`, title: 'sample-doc.txt', size: 1024, created_at: new Date().toISOString() },
        },
      })
    }
  })

  // Settings endpoints
  await page.route('**/api/settings', (route) => {
    if (route.request().method() === 'GET') {
      route.fulfill({
        json: {
          providers: {
            openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
            claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
            deepseek: { apiKey: 'fake-api-key-for-e2e', model: 'deepseek-chat', baseUrl: '' },
            custom: { apiKey: '', model: '', baseUrl: '' },
            ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
          },
          embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
          temperature: 0.7,
          defaultChatProvider: 'deepseek',
        },
      })
    } else if (route.request().method() === 'POST') {
      route.fulfill({ json: { data: { success: true } } })
    }
  })
}
