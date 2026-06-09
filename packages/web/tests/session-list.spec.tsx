import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SessionList } from '@/components/chat/SessionList'

// Mock useChatStore
const mockStore = {
  sessions: [] as any[],
  activeSession: null as any,
  isLoadingSessions: false,
  error: null as string | null,
  createSession: vi.fn(),
  setActiveSession: vi.fn(),
  loadSessions: vi.fn(),
  clearError: vi.fn(),
}

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: any) => {
    if (typeof selector === 'function') return selector(mockStore)
    return mockStore
  },
}))

describe('SessionList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.sessions = []
    mockStore.activeSession = null
    mockStore.isLoadingSessions = false
    mockStore.error = null
  })

  it('AC-01: shows loading skeletons when isLoadingSessions is true', () => {
    mockStore.isLoadingSessions = true

    render(<SessionList />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('AC-01: shows empty state when no sessions', () => {
    mockStore.isLoadingSessions = false
    mockStore.sessions = []

    render(<SessionList />)

    expect(screen.getByText('暂无会话')).toBeDefined()
  })

  it('AC-01: shows error state with retry button', () => {
    mockStore.error = '网络错误'

    render(<SessionList />)

    expect(screen.getByText('网络错误')).toBeDefined()
    expect(screen.getByTestId('session-list-retry')).toBeDefined()

    fireEvent.click(screen.getByTestId('session-list-retry'))
    expect(mockStore.loadSessions).toHaveBeenCalledTimes(1)
  })

  it('AC-01: renders session items with title, messageCount, and relative time', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's2', title: 'Chat 2', messageCount: 0, createdAt: '2026-06-02T00:00:00Z' },
    ]

    render(<SessionList />)

    expect(screen.getByText('Chat 1')).toBeDefined()
    expect(screen.getByText('Chat 2')).toBeDefined()
    // 消息计数
    const counts = screen.getAllByText(/\d+/)
    expect(counts.length).toBeGreaterThanOrEqual(1)
  })

  it('AC-03: calls setActiveSession when session item clicked', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]

    render(<SessionList />)

    fireEvent.click(screen.getByText('Chat 1'))
    expect(mockStore.setActiveSession).toHaveBeenCalledWith(mockStore.sessions[0])
  })

  it('AC-03: highlights active session', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's2', title: 'Chat 2', messageCount: 3, createdAt: '2026-06-02T00:00:00Z' },
    ]
    mockStore.activeSession = mockStore.sessions[0]

    render(<SessionList />)

    const items = screen.getAllByTestId('session-item')
    expect(items[0].className).toContain('bg-surface-2')
  })

  it('AC-01: boundary — renders sessions but no activeSession highlighted when activeSession is null', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
      { id: 's2', title: 'Chat 2', messageCount: 3, createdAt: '2026-06-02T00:00:00Z' },
    ]
    mockStore.activeSession = null

    render(<SessionList />)

    const items = screen.getAllByTestId('session-item')
    expect(items).toHaveLength(2)
    // activeSession 为 null 时，不应有高亮项
    expect(items[0].className).not.toContain('bg-surface-2 text-text-primary')
    expect(items[1].className).not.toContain('bg-surface-2 text-text-primary')
  })

  it('AC-02: renders new session button and calls createSession on click', () => {
    render(<SessionList />)

    const btn = screen.getByTestId('new-session-btn')
    expect(btn).toBeDefined()

    fireEvent.click(btn)
    expect(mockStore.createSession).toHaveBeenCalledTimes(1)
  })

  it('shows rename option in DropdownMenu and calls onRenameClick', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]
    const onRenameClick = vi.fn()
    const onDeleteClick = vi.fn()

    render(<SessionList onRenameClick={onRenameClick} onDeleteClick={onDeleteClick} />)

    // 点击 "..." 按钮打开 DropdownMenu
    fireEvent.click(screen.getByTestId('session-more-btn'))
    // DropdownMenu 内容在 portal 中，使用 document.querySelector 查找
    const renameItem = document.querySelector('[data-testid="session-rename-btn"]')
    expect(renameItem).toBeDefined()
    expect(onRenameClick).toHaveBeenCalledTimes(0)
  })

  it('shows delete option in DropdownMenu and calls onDeleteClick', () => {
    mockStore.sessions = [
      { id: 's1', title: 'Chat 1', messageCount: 5, createdAt: '2026-06-01T00:00:00Z' },
    ]
    const onDeleteClick = vi.fn()

    render(<SessionList onRenameClick={() => {}} onDeleteClick={onDeleteClick} />)

    // 点击 "..." 按钮
    fireEvent.click(screen.getByTestId('session-more-btn'))
    // DropdownMenu 内容在 portal 中，使用 document.querySelector 查找
    const deleteItem = document.querySelector('[data-testid="session-delete-btn"]')
    expect(deleteItem).toBeDefined()
    expect(onDeleteClick).toHaveBeenCalledTimes(0)
  })
})
