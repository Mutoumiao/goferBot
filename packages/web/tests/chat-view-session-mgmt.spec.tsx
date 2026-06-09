import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatSession } from '@/routes/app/chat/ChatSession'

// Mock 依赖
const mockStore = {
  activeSession: null as any,
  messages: [] as any[],
  sessions: [] as any[],
  streamingContent: '',
  isStreaming: false,
  isLoadingHistory: false,
  isLoadingSessions: false,
  error: null as string | null,
  setMessages: vi.fn(),
  appendMessage: vi.fn(),
  setIsLoadingHistory: vi.fn(),
  setIsStreaming: vi.fn(),
  appendStreamContent: vi.fn(),
  flushStreamContent: vi.fn(),
  clearChat: vi.fn(),
  setActiveSession: vi.fn(),
  loadSessions: vi.fn().mockResolvedValue(undefined),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  renameSession: vi.fn(),
  clearError: vi.fn(),
}

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (selector: any) => {
      if (typeof selector === 'function') return selector(mockStore)
      return mockStore
    },
    {
      getState: () => mockStore,
    }
  ),
}))

vi.mock('alova/client', () => ({
  useRequest: vi.fn(() => ({
    data: undefined,
    send: vi.fn().mockResolvedValue({ data: { messages: [] } }),
    loading: false,
    error: undefined,
  })),
  useSSE: vi.fn(() => ({
    send: vi.fn(),
    close: vi.fn(),
    onMessage: vi.fn().mockReturnThis(),
    onError: vi.fn().mockReturnThis(),
    onOpen: vi.fn().mockReturnThis(),
  })),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({
    component: (c: any) => c,
  }),
  useSearch: () => ({}),
}))

describe('ChatView session management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockStore, {
      activeSession: null,
      messages: [],
      sessions: [],
      streamingContent: '',
      isStreaming: false,
      isLoadingHistory: false,
      isLoadingSessions: false,
      error: null,
    })
  })

  it('AC-08: shows empty guide when no activeSession and no sessions', () => {
    mockStore.sessions = []
    mockStore.activeSession = null

    render(<ChatSession sessionId="s1" />)

    expect(screen.getByText('开始新对话')).toBeDefined()
    expect(screen.getByText(/在下方输入消息，开始与 AI 对话/)).toBeDefined()
  })

  it('AC-01: renders SessionList when sessions exist', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]

    render(<ChatSession sessionId="s1" />)

    expect(screen.getByText('Chat 1')).toBeDefined()
  })

  it('AC-06: double-click title enters inline rename mode', () => {
    mockStore.activeSession = { id: 's1', title: 'Old Title', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' }

    render(<ChatSession sessionId="s1" />)

    const title = screen.getByText('Old Title')
    fireEvent.doubleClick(title)

    // 应出现 input
    const input = screen.getByDisplayValue('Old Title') as HTMLInputElement
    expect(input).toBeDefined()
    expect(input.tagName).toBe('INPUT')
  })

  it('AC-06: Enter confirms rename and calls renameSession', async () => {
    mockStore.activeSession = { id: 's1', title: 'Old Title', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' }
    mockStore.renameSession = vi.fn().mockResolvedValue(undefined)

    render(<ChatSession sessionId="s1" />)

    fireEvent.doubleClick(screen.getByText('Old Title'))

    const input = screen.getByDisplayValue('Old Title') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'New Title' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(mockStore.renameSession).toHaveBeenCalledWith('s1', 'New Title')
  })

  it('AC-06: Escape cancels rename', () => {
    mockStore.activeSession = { id: 's1', title: 'Old Title', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' }

    render(<ChatSession sessionId="s1" />)

    fireEvent.doubleClick(screen.getByText('Old Title'))

    const input = screen.getByDisplayValue('Old Title') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Escape' })

    // 应恢复为原标题
    expect(screen.getByText('Old Title')).toBeDefined()
    expect(screen.queryByDisplayValue('Old Title')).toBeNull()
  })

  it('AC-09: shows error toast when error exists', () => {
    mockStore.error = '操作失败'

    render(<ChatSession sessionId="s1" />)

    expect(screen.getByTestId('error-toast-close')).toBeDefined()
  })

  it('AC-09: dismisses error toast on close button click', () => {
    mockStore.error = '操作失败'

    render(<ChatSession sessionId="s1" />)

    fireEvent.click(screen.getByTestId('error-toast-close'))
    expect(mockStore.clearError).toHaveBeenCalledTimes(1)
  })

  it('AC-05: renders empty guide when deleting activeSession', () => {
    // 模拟删除活跃会话后的状态
    mockStore.activeSession = null
    mockStore.sessions = [
      { id: 's2', title: 'Remaining', messageCount: 1, createdAt: '2026-06-02T00:00:00Z' },
    ]

    render(<ChatSession sessionId="s1" />)

    expect(screen.getByText('开始新对话')).toBeDefined()
  })
})
