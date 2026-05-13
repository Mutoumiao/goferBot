const mockSessions = [
  {
    id: 'sess1',
    title: 'RAG 使用讨论',
    provider: 'openai',
    model: 'gpt-4o',
    created_at: 1715173800000,
    updated_at: 1715173800000,
    message_count: 2,
    summary: '你好，请问如何使用 RAG？',
  },
  {
    id: 'sess2',
    title: '知识库导入问题',
    provider: 'claude',
    model: 'claude-3-opus',
    created_at: 1715061300000,
    updated_at: 1715061300000,
    message_count: 1,
    summary: '导入文件后没有自动索引',
  },
]

const mockSessionDetail = {
  id: 'sess1',
  title: 'RAG 使用讨论',
  provider: 'openai',
  model: 'gpt-4o',
  created_at: 1715173800000,
  updated_at: 1715173800000,
  message_count: 2,
  messages: [
    { id: 'm1', session_id: 'sess1', role: 'user', content: '你好，请问如何使用 RAG？', knowledge_base_ids: null, created_at: 1715173600000 },
    { id: 'm2', session_id: 'sess1', role: 'assistant', content: 'RAG（检索增强生成）是一种将知识库检索与 LLM 结合的技术...', knowledge_base_ids: null, created_at: 1715173800000 },
  ],
}

export async function mockHttpRoutes(page: any) {
  await page.route('http://127.0.0.1:*/settings', (route: any) => {
    route.fulfill({ json: {} })
  })

  await page.route('http://127.0.0.1:*/knowledge-bases', (route: any) => {
    route.fulfill({ json: [] })
  })

  await page.route('http://127.0.0.1:*/sessions', (route: any) => {
    if (route.request().method() === 'GET') {
      route.fulfill({ json: mockSessions })
    } else if (route.request().method() === 'POST') {
      route.fulfill({ status: 201, json: { id: 'sess-new', title: '首页', created_at: Date.now() } })
    } else {
      route.continue()
    }
  })

  await page.route('http://127.0.0.1:*/sessions/*', (route: any) => {
    const url = route.request().url()
    const method = route.request().method()

    if (url.includes('/rename') && method === 'POST') {
      route.fulfill({ status: 200, json: { success: true } })
      return
    }

    if (method === 'DELETE') {
      route.fulfill({ status: 200, json: { success: true } })
      return
    }

    if (method === 'GET') {
      route.fulfill({ json: mockSessionDetail })
      return
    }

    route.continue()
  })
}
