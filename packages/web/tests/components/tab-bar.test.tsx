import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from '@/components/tab-bar/TabBar'

// ---- mock router ----
const mockNavigate = vi.fn()
const mockMatches = [
  { pathname: '/app/chat', staticData: { tabMeta: { title: '问答首页', singleton: true, closable: false } } },
  { pathname: '/app/chat/$sessionId', staticData: { tabMeta: { title: '新对话', singleton: false, closable: true } } },
]

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({
    navigate: mockNavigate,
    state: { matches: mockMatches },
  }),
  useRouterState: ({ select }: { select: (s: any) => any }) => {
    const state = { location: { href: '/app/chat', pathname: '/app/chat', search: '' } }
    return select(state)
  },
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

// ---- mock tabs store ----
const mockTabs: any[] = []
let mockActiveTabId = 'home'
let mockOpenRoute = vi.fn()
let mockActivateTab = vi.fn()
let mockRemoveTab = vi.fn()

const mockStoreState = () => ({
  tabs: mockTabs,
  activeTabId: mockActiveTabId,
  openRoute: mockOpenRoute,
  activateTab: mockActivateTab,
  removeTab: mockRemoveTab,
  findTabByRoute: (route: string) => mockTabs.find((t) => t.route === route) ?? null,
})

vi.mock('@/stores/tabs', () => ({
  useTabsStore: Object.assign(
    (selector?: (s: any) => any) => {
      const state = mockStoreState()
      return selector ? selector(state) : state
    },
    {
      getState: () => mockStoreState(),
    },
  ),
}))

// ---- mock chat service ----
vi.mock('@/features/chat/services', () => ({
  createChatSession: vi.fn(),
}))

import { createChatSession } from '@/features/chat/services'

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs.length = 0
    mockActiveTabId = 'home'
    mockOpenRoute = vi.fn()
    mockActivateTab = vi.fn()
    mockRemoveTab = vi.fn()
  })

  it('renders with no tabs', () => {
    render(<TabBar />)
    expect(screen.getByTitle('新建问答会话')).toBeDefined()
  })

  it('renders tabs from store', () => {
    mockTabs.push(
      { id: 'home', route: '/app/chat', title: '问答首页', closable: false },
      { id: 't1', route: '/app/kb', title: '知识库', closable: true },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    expect(screen.getByText('问答首页')).toBeDefined()
    expect(screen.getByText('知识库')).toBeDefined()
  })

  it('activates tab on click', () => {
    mockTabs.push(
      { id: 'home', route: '/app/chat', title: '问答首页', closable: false },
      { id: 't1', route: '/app/kb', title: '知识库', closable: true },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    fireEvent.click(screen.getByText('知识库'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/kb' })
  })

  it('does not navigate when clicking already active tab', () => {
    mockTabs.push(
      { id: 'home', route: '/app/chat', title: '问答首页', closable: false },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    fireEvent.click(screen.getByText('问答首页'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('closes tab when close button clicked', () => {
    mockTabs.push(
      { id: 'home', route: '/app/chat', title: '问答首页', closable: false },
      { id: 't1', route: '/app/kb', title: '知识库', closable: true },
    )
    mockActiveTabId = 't1'
    mockRemoveTab.mockReturnValue('home')

    render(<TabBar />)
    // hover to show close button
    const tab = screen.getByText('知识库').closest('[data-active]') as HTMLElement
    fireEvent.mouseEnter(tab)
    const closeBtn = screen.getByLabelText('关闭 知识库')
    fireEvent.click(closeBtn)

    expect(mockRemoveTab).toHaveBeenCalledWith('t1')
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/chat' })
  })

  it('creates new chat session on plus button click', async () => {
    vi.mocked(createChatSession).mockResolvedValue({ id: 's1', title: '新对话', messageCount: 0, createdAt: '', updatedAt: '' })

    render(<TabBar />)
    fireEvent.click(screen.getByTitle('新建问答会话'))

    // wait for async
    await new Promise((r) => setTimeout(r, 10))

    expect(createChatSession).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/chat/s1' })
  })

  it('shows blue dot for active chat-session tab', () => {
    mockTabs.push(
      { id: 'home', route: '/app/chat', title: '问答首页', closable: false },
      { id: 't1', route: '/app/chat/s1', title: '会话1', closable: true, sessionId: 's1' },
    )
    mockActiveTabId = 't1'

    render(<TabBar />)
    const activeTab = screen.getByText('会话1').closest('[data-active="true"]') as HTMLElement
    expect(activeTab).toBeDefined()
  })

  it('does not show close button for non-closable tab', () => {
    mockTabs.push(
      { id: 'home', route: '/app/chat', title: '问答首页', closable: false },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    const tab = screen.getByText('问答首页').closest('[data-active]') as HTMLElement
    fireEvent.mouseEnter(tab)
    expect(screen.queryByLabelText('关闭 问答首页')).toBeNull()
  })
})
