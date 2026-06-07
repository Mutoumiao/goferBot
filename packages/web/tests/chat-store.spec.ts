import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSessions = [
  { id: 's1', title: 'Chat 1', provider: 'openai', model: 'gpt-4', messageCount: 5, createdAt: '2025-01-01', updatedAt: '2025-01-01' },
  { id: 's2', title: 'Chat 2', provider: 'claude', model: 'claude-3', messageCount: 3, createdAt: '2025-01-02', updatedAt: '2025-01-02' },
]

// Mock API modules
vi.mock('@/api/chat', () => ({
  getSessions: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
}))

import * as chatApi from '@/api/chat'

async function resetStore() {
  const { useChatStore } = await import('@/stores/chat')
  useChatStore.setState({
    activeSession: null,
    messages: [],
    sessions: [],
    isLoadingHistory: false,
    isStreaming: false,
    streamingContent: '',
    isLoadingSessions: false,
    error: null,
  })
  return useChatStore
}

describe('ChatStore — 扩展字段 + 同步 actions（AC-01, AC-02）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetStore()
  })

  it('AC-01: 初始状态包含 sessions + isLoadingSessions + error', async () => {
    const { useChatStore } = await import('@/stores/chat')
    const state = useChatStore.getState()
    expect(state.sessions).toEqual([])
    expect(state.isLoadingSessions).toBe(false)
    expect(state.error).toBeNull()
  })

  it('AC-08: 已有字段 activeSession/messages/isStreaming 正常工作', async () => {
    const { useChatStore } = await import('@/stores/chat')
    const state = useChatStore.getState()
    expect(state.activeSession).toBeNull()
    expect(state.messages).toEqual([])
    expect(state.isStreaming).toBe(false)
    expect(state.streamingContent).toBe('')
  })

  it('AC-02: setSessions 同步替换 sessions 数组', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions(mockSessions)
    expect(useChatStore.getState().sessions).toEqual(mockSessions)
  })

  it('AC-02: addSession 同步添加到列表头部', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    const newSession = { id: 's3', title: 'New', provider: null, model: null, messageCount: 0, createdAt: '', updatedAt: '' }
    useChatStore.getState().addSession(newSession)

    const sessions = useChatStore.getState().sessions
    expect(sessions).toHaveLength(3)
    expect(sessions[0].id).toBe('s3')
  })

  it('AC-02: removeSession 同步移除指定会话', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    useChatStore.getState().removeSession('s1')

    expect(useChatStore.getState().sessions).toHaveLength(1)
    expect(useChatStore.getState().sessions[0].id).toBe('s2')
  })

  it('AC-02: updateSession 同步更新指定会话字段', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    useChatStore.getState().updateSession('s1', { title: 'Renamed' })

    expect(useChatStore.getState().sessions[0].title).toBe('Renamed')
    expect(useChatStore.getState().sessions[0].messageCount).toBe(5)
  })

  it('AC-08: stream 字段 appendStreamContent + flushStreamContent 行为不变', async () => {
    const { useChatStore } = await import('@/stores/chat')
    const store = useChatStore.getState()

    store.appendStreamContent('Hello')
    expect(useChatStore.getState().streamingContent).toBe('Hello')

    store.appendStreamContent(' World')
    expect(useChatStore.getState().streamingContent).toBe('Hello World')
  })

  it('AC-08: clearChat 清除所有状态（含新增字段）', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.setState({
      activeSession: mockSessions[0],
      messages: [{ id: 'm1', sessionId: 's1', role: 'user', content: 'hi', createdAt: '' }],
      sessions: [...mockSessions],
      streamingContent: 'partial',
      isStreaming: true,
      isLoadingSessions: true,
      error: 'oops',
    })

    useChatStore.getState().clearChat()
    const s = useChatStore.getState()
    expect(s.activeSession).toBeNull()
    expect(s.messages).toEqual([])
    expect(s.sessions).toEqual([])
    expect(s.streamingContent).toBe('')
    expect(s.isStreaming).toBe(false)
    expect(s.isLoadingSessions).toBe(false)
    expect(s.error).toBeNull()
  })
})

describe('ChatStore — 异步 actions（AC-03 ~ AC-07）', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await resetStore()
  })

  it('AC-03: loadSessions 成功 → setSessions + isLoadingSessions=false', async () => {
    vi.mocked(chatApi.getSessions).mockReturnValue({ send: vi.fn().mockResolvedValue({ sessions: mockSessions }) } as any)
    const { useChatStore } = await import('@/stores/chat')
    await useChatStore.getState().loadSessions()

    const state = useChatStore.getState()
    expect(state.sessions).toEqual(mockSessions)
    expect(state.isLoadingSessions).toBe(false)
  })

  it('AC-03: loadSessions 失败 → error 设置', async () => {
    vi.mocked(chatApi.getSessions).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('网络错误')) } as any)
    const { useChatStore } = await import('@/stores/chat')
    await useChatStore.getState().loadSessions()

    const state = useChatStore.getState()
    expect(state.error).toBeTruthy()
    expect(state.isLoadingSessions).toBe(false)
  })

  it('AC-04: createSession 成功 → addSession + 激活', async () => {
    const newSession = { id: 'new', title: 'New Chat', provider: 'openai', model: 'gpt-4', messageCount: 0, createdAt: '', updatedAt: '' }
    vi.mocked(chatApi.createSession).mockReturnValue({ send: vi.fn().mockResolvedValue(newSession) } as any)
    const { useChatStore } = await import('@/stores/chat')
    const result = await useChatStore.getState().createSession()

    expect(result).toEqual(newSession)
    const state = useChatStore.getState()
    expect(state.sessions[0]).toEqual(newSession)
    expect(state.activeSession).toEqual(newSession)
    expect(state.isLoadingSessions).toBe(false)
  })

  it('AC-04: createSession 失败 → error 设置，sessions 不变', async () => {
    vi.mocked(chatApi.createSession).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('创建失败')) } as any)
    const { useChatStore } = await import('@/stores/chat')
    const result = await useChatStore.getState().createSession()

    expect(result).toBeUndefined()
    const state = useChatStore.getState()
    expect(state.sessions).toHaveLength(0)
    expect(state.error).toBeTruthy()
  })

  it('AC-05: renameSession 成功 → updateSession', async () => {
    vi.mocked(chatApi.renameSession).mockReturnValue({ send: vi.fn().mockResolvedValue({ id: 's1', title: 'Renamed' }) } as any)
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    await useChatStore.getState().renameSession('s1', 'Renamed')

    expect(useChatStore.getState().sessions[0].title).toBe('Renamed')
    expect(useChatStore.getState().isLoadingSessions).toBe(false)
  })

  it('AC-05: renameSession 空标题 → 不调 API 直接 return', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    await useChatStore.getState().renameSession('s1', '  ')

    expect(chatApi.renameSession).not.toHaveBeenCalled()
  })

  it('AC-06: deleteSession 成功 → removeSession', async () => {
    vi.mocked(chatApi.deleteSession).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    await useChatStore.getState().deleteSession('s1')

    expect(useChatStore.getState().sessions).toHaveLength(1)
    expect(useChatStore.getState().isLoadingSessions).toBe(false)
  })

  it('AC-07: deleteSession 删除活跃会话 → activeSession=null', async () => {
    vi.mocked(chatApi.deleteSession).mockReturnValue({ send: vi.fn().mockResolvedValue(undefined) } as any)
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.setState({
      sessions: [...mockSessions],
      activeSession: mockSessions[0],
    })
    await useChatStore.getState().deleteSession('s1')

    expect(useChatStore.getState().activeSession).toBeNull()
  })

  it('AC-06: deleteSession 失败 → error 设置', async () => {
    vi.mocked(chatApi.deleteSession).mockReturnValue({ send: vi.fn().mockRejectedValue(new Error('删除失败')) } as any)
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.getState().setSessions([...mockSessions])
    await useChatStore.getState().deleteSession('s1')

    expect(useChatStore.getState().sessions).toHaveLength(2)
    expect(useChatStore.getState().error).toBeTruthy()
  })

  it('AC-01: clearError 清除 error', async () => {
    const { useChatStore } = await import('@/stores/chat')
    useChatStore.setState({ error: 'some error' })
    useChatStore.getState().clearError()
    expect(useChatStore.getState().error).toBeNull()
  })
})
