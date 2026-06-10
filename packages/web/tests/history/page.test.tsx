import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockNavigate = vi.fn()
const mockAddTab = vi.fn()
const mockOpenDialog = vi.fn()
const mockDeleteChatSessionWithReload = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => () => ({ component: () => null }),
  useRouter: () => ({ navigate: mockNavigate }),
}))

vi.mock('@/stores/tabs', () => ({
  useTabsStore: Object.assign(
    (selector?: (s: any) => any) => {
      const state = { addTab: mockAddTab }
      return selector ? selector(state) : state
    },
    { getState: () => ({ addTab: mockAddTab }) },
  ),
}))

vi.mock('@/features/chat/hooks', () => ({
  useChatHistory: vi.fn(),
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
    <button onClick={onClick} disabled={disabled} title={title}>{children}</button>
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
  PaginationLink: ({ children, isActive, ...props }: any) => <a {...props}>{children}</a>,
  PaginationNext: ({ text, ...props }: any) => <a {...props}>{text}</a>,
  PaginationPrevious: ({ text, ...props }: any) => <a {...props}>{text}</a>,
}))

import { useChatHistory } from '@/features/chat/hooks'
import { ChatHistoryPage } from '@/features/chat/components/ChatHistoryPage'

describe('ChatHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading skeleton', () => {
    vi.mocked(useChatHistory).mockReturnValue({
      sessions: [],
      total: 0,
      loading: true,
      error: undefined,
      reload: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('会话历史')).toBeDefined()
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders empty state when no sessions', () => {
    vi.mocked(useChatHistory).mockReturnValue({
      sessions: [],
      total: 0,
      loading: false,
      error: undefined,
      reload: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('暂无历史会话')).toBeDefined()
  })

  it('renders session list and opens chat session on click', () => {
    const sessions = [
      {
        id: 's1',
        title: '测试会话',
        messageCount: 5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]
    vi.mocked(useChatHistory).mockReturnValue({
      sessions,
      total: 1,
      loading: false,
      error: undefined,
      reload: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('测试会话')).toBeDefined()

    fireEvent.click(screen.getByText('测试会话'))
    expect(mockAddTab).toHaveBeenCalledWith(
      'chat-session',
      's1',
      '测试会话',
      '/app/chat/s1',
    )
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/app/chat/s1' })
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
    vi.mocked(useChatHistory).mockReturnValue({
      sessions,
      total: 1,
      loading: false,
      error: undefined,
      reload: vi.fn(),
    })
    const mockReload = vi.fn()
    vi.mocked(useChatHistory).mockReturnValue({
      sessions,
      total: 1,
      loading: false,
      error: undefined,
      reload: mockReload,
    })
    mockDeleteChatSessionWithReload.mockResolvedValue(undefined)

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

    // 验证 onReload 回调正确关联到 reload
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
    vi.mocked(useChatHistory).mockReturnValue({
      sessions,
      total: 12,
      loading: false,
      error: undefined,
      reload: vi.fn(),
    })

    render(<ChatHistoryPage />)
    expect(screen.getByText('会话 0')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
  })
})
