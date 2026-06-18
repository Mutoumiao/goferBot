import type { Pagination } from '@goferbot/data'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()
const mockOpenDialog = vi.fn()
const mockDeleteChatSessionWithReload = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createRootRoute: () => () => ({ component: () => null }),
  createFileRoute: () => () => ({ component: () => null }),
  useRouter: () => ({ navigate: mockNavigate }),
}))

vi.mock('@/stores/tabManager', () => ({
  tabManager: {
    openNewChat: vi.fn(),
    openConversation: vi.fn(),
    switchTab: vi.fn(),
    closeTab: vi.fn(),
  },
}))

vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: Object.assign(
    (selector?: (s: any) => any) => {
      const state = {
        tabs: [],
        activeTabId: '',
        findTabByConversationId: vi.fn(),
        updateTab: vi.fn(),
      }
      return selector ? selector(state) : state
    },
    { getState: () => ({ findTabByConversationId: vi.fn(), updateTab: vi.fn() }) },
  ),
}))

vi.mock('@/features/chat/hooks', () => ({
  useChatHistory: vi.fn(),
  useLazyChatHistory: vi.fn(),
}))

vi.mock('@/features/chat/services', () => ({
  confirmDeleteChatSession: vi.fn((...args: any[]) => mockDeleteChatSessionWithReload(...args)),
}))

vi.mock('@/overlays/services/overlay-service', () => ({
  openDialog: (...args: any[]) => mockOpenDialog(...args),
}))

vi.mock('@/overlays/dialogs/DeleteSessionDialog', () => ({
  DeleteSessionDialog: () => null,
}))

vi.mock('lucide-react', () => ({
  MessageCircleIcon: () => <svg data-testid="icon-message" />,
  ArrowRightIcon: () => <svg data-testid="icon-arrow" />,
  Trash2Icon: () => <svg data-testid="icon-trash" />,
  Clock3Icon: () => <svg data-testid="icon-clock" />,
  ChevronDownIcon: () => <svg data-testid="icon-chevron" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, title }: any) => (
    <button type="button" onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, ...props }: any) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/empty', () => ({
  Empty: ({ children }: any) => <div>{children}</div>,
  EmptyHeader: ({ children }: any) => <div>{children}</div>,
  EmptyMedia: ({ children }: any) => <div>{children}</div>,
  EmptyTitle: ({ children }: any) => <div>{children}</div>,
  EmptyDescription: ({ children }: any) => <div>{children}</div>,
  EmptyContent: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/pagination', () => ({
  Pagination: ({ children }: any) => <nav>{children}</nav>,
  PaginationContent: ({ children }: any) => <ul>{children}</ul>,
  PaginationEllipsis: () => <li>...</li>,
  PaginationItem: ({ children }: any) => <li>{children}</li>,
  PaginationLink: ({ children, isActive, onClick }: any) => (
    <button type="button" onClick={onClick} data-active={isActive}>
      {children}
    </button>
  ),
  PaginationNext: ({ text, onClick }: any) => <button type="button" onClick={onClick}>{text}</button>,
  PaginationPrevious: ({ text, onClick }: any) => <button type="button" onClick={onClick}>{text}</button>,
}))

vi.mock('@/router-register', () => ({
  ROUTES_REGISTER: {
    chat: { bindTo: (id: string) => `/chat/${id}` },
  },
}))

import { ChatHistoryPage } from '@/features/chat/components/ChatHistoryPage'
import { useLazyChatHistory } from '@/features/chat/hooks'
import { tabManager } from '@/stores/tabManager'

const createPagination = (total: number, currentPage: number, size: number): Pagination => ({
  total,
  currentPage,
  size,
  totalPage: Math.ceil(total / size),
  hasNextPage: currentPage < Math.ceil(total / size),
  hasPrevPage: currentPage > 1,
})

describe('ChatHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton', () => {
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions: [],
      pagination: null,
      loading: true,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('会话历史')).toBeDefined()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders empty state when no sessions', () => {
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions: [],
      pagination: null,
      loading: false,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('暂无历史会话')).toBeDefined()
  })

  it('renders session list and navigates to chat session on click', () => {
    const sessions = [
      {
        id: 's1',
        title: '测试会话',
        messageCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions,
      pagination: createPagination(1, 1, 10),
      loading: false,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('测试会话')).toBeDefined()

    fireEvent.click(screen.getByText('测试会话'))
    expect(tabManager.openConversation).toHaveBeenCalledWith('s1', '测试会话')
  })

  it('renders error state and allows retry', async () => {
    const mockReload = vi.fn()
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions: [],
      pagination: null,
      loading: false,
      error: new Error('加载失败'),
      reload: mockReload,
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)

    expect(screen.getByText('加载失败：加载失败')).toBeDefined()

    const retryBtn = screen.getByText('重试')
    fireEvent.click(retryBtn)

    expect(mockReload).toHaveBeenCalled()
  })

  it('deletes session after confirmation', async () => {
    const sessions = [
      {
        id: 's1',
        title: '待删除',
        messageCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    const mockReload = vi.fn()
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions,
      pagination: createPagination(1, 1, 10),
      loading: false,
      error: undefined,
      reload: mockReload,
      load: vi.fn(),
    })
    mockDeleteChatSessionWithReload.mockResolvedValue(true)

    render(<ChatHistoryPage />)
    expect(screen.getByText('待删除')).toBeDefined()

    const deleteBtn = screen.getByTitle('删除会话') as HTMLElement
    expect(deleteBtn).toBeDefined()
    fireEvent.click(deleteBtn)

    await waitFor(() => {
      expect(mockDeleteChatSessionWithReload).toHaveBeenCalledWith(
        expect.objectContaining({ id: 's1', title: '待删除' }),
        expect.objectContaining({
          onBefore: expect.any(Function),
          onAfter: expect.any(Function),
          onReload: expect.any(Function),
        }),
      )
    })

    const callArgs = mockDeleteChatSessionWithReload.mock.calls[0][1]
    callArgs.onReload()
    expect(mockReload).toHaveBeenCalled()
  })

  it('renders pagination and switches page', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      title: `会话 ${i}`,
      messageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions,
      pagination: createPagination(12, 1, 10),
      loading: false,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('会话 0')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })

  it('shows loading skeleton during initial load', () => {
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions: [],
      pagination: null,
      loading: true,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)

    const skeletons = document.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBe(4)
  })

  it('shows page header with title and description', () => {
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions: [],
      pagination: null,
      loading: false,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)

    expect(screen.getByText('会话历史')).toBeDefined()
    expect(
      screen.getByText('点击任意记录即可恢复到对应会话，继续追问、整理或查看引用来源。'),
    ).toBeDefined()
  })

  it('handles page change via pagination', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      title: `会话 ${i}`,
      messageCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    vi.mocked(useLazyChatHistory).mockReturnValue({
      sessions,
      pagination: createPagination(25, 1, 10),
      loading: false,
      error: undefined,
      reload: vi.fn(),
      load: vi.fn(),
    })

    render(<ChatHistoryPage />)

    const nextPageBtn = screen.getByText('下一页')
    fireEvent.click(nextPageBtn)

    expect(useLazyChatHistory).toHaveBeenCalledWith(2, 6)
  })
})
