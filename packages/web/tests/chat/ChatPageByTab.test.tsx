import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Tab } from '@/stores/workspace.store'
import { ChatPageByTab } from '@/features/chat/components/ChatPageByTab'

vi.mock('@ant-design/x', () => ({
  XProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('@ant-design/x-sdk', () => ({
  useXChat: () => ({
    messages: [],
    onRequest: vi.fn(),
    isRequesting: false,
    abort: vi.fn(),
    setMessages: vi.fn(),
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

vi.mock('@/stores/conversation.store', () => ({
  useConversationStore: Object.assign(
    () => ({
      conversationMap: {},
      setMessages: vi.fn(),
    }),
    { getState: () => ({ conversationMap: {}, setMessages: vi.fn() }) },
  ),
}))

vi.mock('@/features/chat/store', () => ({
  useChatStore: () => ({
    selectedProviderKey: null,
    setSelectedProviderKey: vi.fn(),
  }),
}))

describe('ChatPageByTab', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs.length = 0
    mockActiveTabId = ''
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
})
