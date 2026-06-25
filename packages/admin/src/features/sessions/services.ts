export interface SessionItem {
  id: string
  title: string
  userId: string
  userEmail: string
  model: string
  messageCount: number
  status: 'active' | 'archived' | 'stopped'
  createdAt: string
  updatedAt: string
}

export interface SessionMessage {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
  tokenCount?: number
  retrievalDocs?: Array<{
    id: string
    name: string
    score: number
    snippet: string
  }>
}

export interface ListSessionsQuery {
  page?: number
  pageSize?: number
  userId?: string
  model?: string
  status?: string
  startDate?: string
  endDate?: string
}

export async function fetchSessions(
  query: ListSessionsQuery = {},
): Promise<{ items: SessionItem[]; total: number }> {
  try {
    const mod = await import('@/utils/server')
    const data = await mod.alovaInstance
      .Get<{ items: SessionItem[]; total: number }>('/admin/sessions', { params: query })
      .send()
    return data
  } catch {
    const items = getMockSessions()
    return { items, total: items.length }
  }
}

export async function fetchSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  try {
    const mod = await import('@/utils/server')
    return await mod.alovaInstance
      .Get<SessionMessage[]>(`/admin/sessions/${sessionId}/messages`)
      .send()
  } catch {
    return getMockMessages(sessionId)
  }
}

export async function fetchSession(sessionId: string): Promise<SessionItem | null> {
  try {
    const mod = await import('@/utils/server')
    return await mod.alovaInstance.Get<SessionItem>(`/admin/sessions/${sessionId}`).send()
  } catch {
    return getMockSessions().find((s) => s.id === sessionId) ?? null
  }
}

function getMockSessions(): SessionItem[] {
  const now = Date.now()
  return [
    {
      id: 's1',
      title: '产品使用咨询',
      userId: 'u1',
      userEmail: 'user1@example.com',
      model: 'deepseek',
      messageCount: 12,
      status: 'active',
      createdAt: new Date(now - 3600000).toISOString(),
      updatedAt: new Date(now - 60000).toISOString(),
    },
    {
      id: 's2',
      title: 'API 集成问题',
      userId: 'u2',
      userEmail: 'user2@example.com',
      model: 'gpt-4o',
      messageCount: 8,
      status: 'active',
      createdAt: new Date(now - 7200000).toISOString(),
      updatedAt: new Date(now - 300000).toISOString(),
    },
    {
      id: 's3',
      title: '文档检索示例',
      userId: 'u3',
      userEmail: 'user3@example.com',
      model: 'deepseek',
      messageCount: 20,
      status: 'archived',
      createdAt: new Date(now - 86400000).toISOString(),
      updatedAt: new Date(now - 86400000).toISOString(),
    },
  ]
}

function getMockMessages(sessionId: string): SessionMessage[] {
  return [
    {
      id: 'm1',
      sessionId,
      role: 'user',
      content: '你好，请问如何快速接入系统？',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      tokenCount: 12,
    },
    {
      id: 'm2',
      sessionId,
      role: 'assistant',
      content: '您好，首先您需要注册账号并完成实名认证，然后在控制台创建应用获取 API Key。',
      createdAt: new Date(Date.now() - 3599000).toISOString(),
      tokenCount: 30,
      retrievalDocs: [
        {
          id: 'd1',
          name: '快速上手指南',
          score: 0.92,
          snippet: '快速上手指南第一章介绍了如何创建应用...',
        },
      ],
    },
  ]
}
