import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { Tab } from '@/stores/workspace.store'
import { ChatPageByTab } from '@/features/chat/components/ChatPageByTab'

const mockSetMessages = vi.fn()
const mockOnRequest = vi.fn()
const mockXMessages: any[] = []

vi.mock('@ant-design/x', () => ({
  XProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@ant-design/x-sdk', () => ({
  useXChat: () => ({
    messages: mockXMessages,
    onRequest: mockOnRequest,
    isRequesting: false,
    abort: vi.fn(),
    setMessages: mockSetMessages,
  }),
}))

vi.mock('@/features/chat/services', () => ({
  createGoferProvider: vi.fn(),
  fetchProviders: vi.fn(),
  loadChatHistory: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/features/chat/constants', () => ({
  getPendingMessageKey: (id: string) => `pending:${id}`,
}))

vi.mock('@/features/chat/components/ChatTempHome', () => ({
  ChatTempHome: ({ tabId }: { tabId: string }) => <div data-testid="chat-temp-home">temp-{tabId}</div>,
}))

vi.mock('@/features/chat/components/ChatSessionView', () => ({
  ChatSessionView: ({ conversationId }: { conversationId: string }) => (
    <div data-testid="chat-session-view">session-{conversationId}</div>
  ),
}))

const mockTabs: Tab[] = []
let mockActiveTabId = ''

const mockWorkspaceState = {
  get tabs() {
    return mockTabs
  },
  get activeTabId() {
    return mockActiveTabId
  },
  activeTab: () => mockTabs.find((t) => t.id === mockActiveTabId) ?? null,
  addTab: vi.fn((tab) => {
    const newTab = { ...tab, createdAt: Date.now() } as Tab
    mockTabs.push(newTab)
    return newTab
  }),
  switchTab: vi.fn(),
  removeTab: vi.fn(),
  updateTab: vi.fn(),
  renameTab: vi.fn(),
  findTabByConversationId: vi.fn(),
  findTabByType: vi.fn(),
  reset: vi.fn(),
}

vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (s: any) => any) => (selector ? selector(mockWorkspaceState) : mockWorkspaceState),
    { getState: () => mockWorkspaceState },
  ),
}))

const conversationMap: Record<string, { id: string; messages: any[] }> = {}

vi.mock('@/stores/conversation.store', () => ({
  useConversationStore: Object.assign(
    () => ({
      conversationMap,
      setMessages: (id: string, messages: any[]) => {
        conversationMap[id] = { id, messages }
      },
    }),
    {
      getState: () => ({
        conversationMap,
        setMessages: (id: string, messages: any[]) => {
          conversationMap[id] = { id, messages }
        },
      }),
    },
  ),
}))

vi.mock('@/features/chat/store', () => ({
  useChatStore: () => ({
    selectedProviderKey: 'openai',
    setSelectedProviderKey: vi.fn(),
  }),
}))

describe('ChatPageByTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs.length = 0
    mockActiveTabId = ''
    Object.keys(conversationMap).forEach((key) => delete conversationMap[key])
  })

  it('当标签不存在时显示恢复占位', () => {
    render(<ChatPageByTab tabId="orphan-tab" />)

    expect(screen.getByText('正在恢复标签...')).toBeDefined()
    expect(screen.queryByTestId('chat-temp-home')).toBeNull()
  })

  it('当标签存在且无 conversationId 时渲染临时首页', () => {
    mockTabs.push({
      id: 'fresh-tab',
      type: 'chat',
      title: '新会话',
      closable: true,
      createdAt: Date.now(),
    })

    render(<ChatPageByTab tabId="fresh-tab" />)

    expect(screen.getByTestId('chat-temp-home').textContent).toBe('temp-fresh-tab')
  })

  it('当标签存在且绑定 conversationId 时渲染会话视图', () => {
    mockTabs.push({
      id: 'conv-tab',
      type: 'chat',
      title: '会话 1',
      closable: true,
      conversationId: 'conv-123',
      createdAt: Date.now(),
    })

    render(<ChatPageByTab tabId="conv-tab" />)

    expect(screen.getByTestId('chat-session-view').textContent).toBe('session-conv-123')
  })

  it('会话历史加载后应通过 conversationStore 设置到 useXChat', async () => {
    const { loadChatHistory } = await import('@/features/chat/services')
    vi.mocked(loadChatHistory).mockImplementation(async (sessionId: string) => {
      conversationMap[sessionId] = {
        id: sessionId,
        messages: [{ id: 'm1', sessionId, role: 'user', content: '历史消息', createdAt: '' }],
      }
    })

    mockTabs.push({
      id: 'hist-tab',
      type: 'chat',
      title: '历史会话',
      closable: true,
      conversationId: 'conv-hist',
      createdAt: Date.now(),
    })

    render(<ChatPageByTab tabId="hist-tab" />)

    await waitFor(() => {
      expect(loadChatHistory).toHaveBeenCalledWith('conv-hist')
      expect(mockSetMessages).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'm1',
            message: expect.objectContaining({ content: '历史消息', role: 'user' }),
            status: 'success',
          }),
        ]),
      )
    })
  })

  it('切换 conversationId 时应清空旧消息并加载新会话历史', async () => {
    const { loadChatHistory } = await import('@/features/chat/services')
    vi.mocked(loadChatHistory).mockImplementation(async (sessionId: string) => {
      conversationMap[sessionId] = {
        id: sessionId,
        messages: [{ id: `m-${sessionId}`, sessionId, role: 'user', content: `msg-${sessionId}`, createdAt: '' }],
      }
    })

    mockTabs.push({
      id: 'switch-tab',
      type: 'chat',
      title: '会话 A',
      closable: true,
      conversationId: 'conv-a',
      createdAt: Date.now(),
    })

    const { rerender } = render(<ChatPageByTab tabId="switch-tab" />)

    await waitFor(() => expect(loadChatHistory).toHaveBeenCalledWith('conv-a'))
    expect(mockSetMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.objectContaining({ content: 'msg-conv-a' }),
        }),
      ]),
    )

    // 模拟切换到会话 B
    mockTabs[0].conversationId = 'conv-b'
    rerender(<ChatPageByTab tabId="switch-tab" />)

    await waitFor(() => expect(loadChatHistory).toHaveBeenCalledWith('conv-b'))
    expect(mockSetMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          message: expect.objectContaining({ content: 'msg-conv-b' }),
        }),
      ]),
    )
  })

  it('自动发送 pending message 时应传递当前选中的 provider_key', async () => {
    const { loadChatHistory } = await import('@/features/chat/services')
    vi.mocked(loadChatHistory).mockImplementation(async () => {
      /* no-op */
    })

    sessionStorage.setItem('pending:conv-pending', JSON.stringify({ content: 'hello' }))

    mockTabs.push({
      id: 'pending-tab',
      type: 'chat',
      title: '待发送会话',
      closable: true,
      conversationId: 'conv-pending',
      createdAt: Date.now(),
    })

    render(<ChatPageByTab tabId="pending-tab" />)

    await waitFor(() => {
      expect(mockOnRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'hello',
          conversation_id: 'conv-pending',
          provider_key: 'openai',
        }),
      )
    })

    sessionStorage.removeItem('pending:conv-pending')
  })
})
