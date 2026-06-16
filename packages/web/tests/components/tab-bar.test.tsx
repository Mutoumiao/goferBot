import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from '@/components/tab-bar/TabBar'
import type { Tab } from '@/stores/workspace.store'
import { ROUTES_REGISTER } from '@/router-register'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: () => () => ({ component: () => null }),
  createFileRoute: () => () => ({ component: () => null }),
  useRouter: () => ({ navigate: mockNavigate }),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

vi.mock('lucide-react', () => ({
  Plus: () => <svg data-testid="icon-plus" />,
  X: () => <svg data-testid="icon-x" />,
  MessageCircle: () => <svg data-testid="icon-message" />,
  BookOpen: () => <svg data-testid="icon-book" />,
  Clock: () => <svg data-testid="icon-clock" />,
  Settings: () => <svg data-testid="icon-settings" />,
  Trash2: () => <svg data-testid="icon-trash" />,
  User: () => <svg data-testid="icon-user" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, title, className, variant, size, 'aria-label': ariaLabel }: any) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={className}
      data-variant={variant}
      data-size={size}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  ),
}))

const mockTabs: Tab[] = []
let mockActiveTabId = ''

const mockState = {
  get tabs() {
    return mockTabs
  },
  get activeTabId() {
    return mockActiveTabId
  },
  activeTab: () => mockTabs.find((t) => t.id === mockActiveTabId) ?? null,
  switchTab: vi.fn(),
  removeTab: vi.fn(() => ({ removed: true, nextTab: null as Tab | null })),
  updateTab: vi.fn(),
  addTab: vi.fn((tab: Omit<Tab, 'id' | 'createdAt'>) => {
    const newTab = { ...tab, id: 'new-tab-id', createdAt: Date.now() } as Tab
    mockTabs.push(newTab)
    return newTab
  }),
  renameTab: vi.fn(),
  findTabByConversationId: vi.fn(),
  findTabByType: vi.fn(),
  reset: vi.fn(),
}

vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (s: any) => any) => {
      return selector ? selector(mockState) : mockState
    },
    { getState: () => mockState },
  ),
}))

vi.mock('@/stores/tabManager', () => ({
  tabManager: {
    openNewChat: vi.fn(),
    openConversation: vi.fn(),
    switchTab: vi.fn(),
    closeTab: vi.fn(),
  },
}))

import { tabManager } from '@/stores/tabManager'

describe('TabBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTabs.length = 0
    mockActiveTabId = ''
  })

  it('renders with no tabs', () => {
    render(<TabBar />)
    expect(screen.getByTitle('新建问答会话')).toBeDefined()
  })

  it('renders tabs from store with icon and name', () => {
    mockTabs.push(
      { id: 'home', type: ROUTES_REGISTER.chat.key, title: '问答首页', closable: false, createdAt: Date.now() },
      { id: 't1', type: ROUTES_REGISTER.knowledgeBase.key, title: '知识库', closable: true, createdAt: Date.now() },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    expect(screen.getByText('问答首页')).toBeDefined()
    expect(screen.getByText('知识库')).toBeDefined()
    expect(screen.getByTestId('icon-message')).toBeDefined()
    expect(screen.getByTestId('icon-book')).toBeDefined()
  })

  it('does not hide tabs behind a scroll container', () => {
    mockTabs.push(
      { id: 't1', type: ROUTES_REGISTER.chat.key, title: '会话 1', closable: true, createdAt: Date.now() },
      { id: 't2', type: ROUTES_REGISTER.knowledgeBase.key, title: '知识库', closable: true, createdAt: Date.now() },
      { id: 't3', type: ROUTES_REGISTER.history.key, title: '历史', closable: true, createdAt: Date.now() },
      { id: 't4', type: ROUTES_REGISTER.settings.key, title: '设置', closable: true, createdAt: Date.now() },
      { id: 't5', type: ROUTES_REGISTER.recycle.key, title: '回收站', closable: true, createdAt: Date.now() },
    )
    mockActiveTabId = 't1'

    render(<TabBar />)
    expect(screen.getByText('会话 1')).toBeDefined()
    expect(screen.getByText('知识库')).toBeDefined()
    expect(screen.getByText('历史')).toBeDefined()
    expect(screen.getByText('设置')).toBeDefined()
    expect(screen.getByText('回收站')).toBeDefined()

    const tabList = screen.getByRole('tablist')
    expect(tabList).toBeDefined()
    expect(tabList.className).not.toContain('overflow-x-auto')
    expect(tabList.className).not.toContain('scrollbar-hide')
  })

  it('activates tab on click', () => {
    mockTabs.push(
      { id: 'home', type: ROUTES_REGISTER.chat.key, title: '问答首页', closable: false, createdAt: Date.now() },
      { id: 't1', type: ROUTES_REGISTER.knowledgeBase.key, title: '知识库', closable: true, createdAt: Date.now() },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    fireEvent.click(screen.getByText('知识库'))
    expect(tabManager.switchTab).toHaveBeenCalledWith('t1')
  })

  it('does not switch when clicking already active tab', () => {
    mockTabs.push(
      { id: 'home', type: ROUTES_REGISTER.chat.key, title: '问答首页', closable: false, createdAt: Date.now() },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    fireEvent.click(screen.getByText('问答首页'))
    expect(tabManager.switchTab).not.toHaveBeenCalled()
  })

  it('closes tab when close button clicked', () => {
    mockTabs.push(
      { id: 'home', type: ROUTES_REGISTER.chat.key, title: '问答首页', closable: false, createdAt: Date.now() },
      { id: 't1', type: ROUTES_REGISTER.knowledgeBase.key, title: '知识库', closable: true, createdAt: Date.now() },
    )
    mockActiveTabId = 't1'

    render(<TabBar />)
    const closeBtn = screen.getByLabelText('关闭 知识库')
    fireEvent.click(closeBtn)

    expect(tabManager.closeTab).toHaveBeenCalledWith('t1')
    expect(tabManager.switchTab).not.toHaveBeenCalled()
  })

  it('creates new chat tab on plus button click', () => {
    render(<TabBar />)
    fireEvent.click(screen.getByTitle('新建问答会话'))
    expect(tabManager.openNewChat).toHaveBeenCalled()
  })

  it('shows active state for chat-session tab', () => {
    mockTabs.push(
      { id: 'home', type: ROUTES_REGISTER.chat.key, title: '问答首页', closable: false, createdAt: Date.now() },
      { id: 't1', type: ROUTES_REGISTER.chat.key, title: '会话1', closable: true, conversationId: 's1', createdAt: Date.now() },
    )
    mockActiveTabId = 't1'

    render(<TabBar />)
    const activeTab = screen.getByText('会话1').closest('[data-active="true"]') as HTMLElement
    expect(activeTab).toBeDefined()
  })

  it('does not show close button for non-closable tab', () => {
    mockTabs.push(
      { id: 'home', type: ROUTES_REGISTER.chat.key, title: '问答首页', closable: false, createdAt: Date.now() },
    )
    mockActiveTabId = 'home'

    render(<TabBar />)
    const tab = screen.getByText('问答首页').closest('[data-active]') as HTMLElement
    fireEvent.mouseEnter(tab)
    expect(screen.queryByLabelText('关闭 问答首页')).toBeNull()
  })
})
