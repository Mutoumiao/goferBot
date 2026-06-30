import type { Pagination, Session } from '@goferbot/data'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('lucide-react', () => ({
  MessageCircleIcon: () => <svg data-testid="icon-message" />,
  ArrowRightIcon: () => <svg data-testid="icon-arrow" />,
  Trash2Icon: () => <svg data-testid="icon-trash" />,
  MoreHorizontalIcon: () => <svg data-testid="icon-more" />,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, title, type, ...rest }: any) => (
    <button type={type ?? 'button'} onClick={onClick} disabled={disabled} title={title} {...rest}>
      {children}
    </button>
  ),
}))

vi.mock('@/components/ui/dropdown-menu', () => {
  const React = require('react')
  return {
    DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
    DropdownMenuTrigger: ({ children, onClick }: any) => (
      <div data-testid="dropdown-menu-trigger" onClick={onClick}>
        {children}
      </div>
    ),
    DropdownMenuContent: ({ children, align, className }: any) => (
      <div data-testid="dropdown-menu-content" data-align={align} className={className}>
        {children}
      </div>
    ),
    DropdownMenuItem: ({ children, onClick, disabled, variant }: any) => (
      <button
        type="button"
        data-testid="dropdown-menu-item"
        data-variant={variant}
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    ),
  }
})

vi.mock('@/components/ui/empty', () => ({
  Empty: ({ children }: any) => <div data-testid="empty">{children}</div>,
  EmptyHeader: ({ children }: any) => <div>{children}</div>,
  EmptyMedia: ({ children }: any) => <div>{children}</div>,
  EmptyTitle: ({ children }: any) => <div>{children}</div>,
  EmptyDescription: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@/components/ui/pagination', () => ({
  Pagination: ({ children }: any) => <nav data-testid="pagination">{children}</nav>,
  PaginationContent: ({ children }: any) => <ul>{children}</ul>,
  PaginationEllipsis: () => <li>...</li>,
  PaginationItem: ({ children }: any) => <li>{children}</li>,
  PaginationLink: ({ children, isActive, onClick }: any) => (
    <button type="button" onClick={onClick} data-active={isActive}>
      {children}
    </button>
  ),
  PaginationNext: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
  PaginationPrevious: ({ text, onClick }: any) => (
    <button type="button" onClick={onClick}>
      {text}
    </button>
  ),
}))

import { ChatHistoryList } from '@/features/chat/components/ChatHistoryList'

const createPagination = (total: number, currentPage: number, size: number): Pagination => ({
  total,
  currentPage,
  size,
  totalPage: Math.ceil(total / size),
  hasNextPage: currentPage < Math.ceil(total / size),
  hasPrevPage: currentPage > 1,
})

describe('ChatHistoryList', () => {
  const createSession = (id: string, title: string, messageCount = 1): Session => ({
    id,
    title,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    messageCount,
  })

  it('renders empty state when no sessions', () => {
    render(
      <ChatHistoryList
        sessions={[]}
        page={1}
        pagination={null}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('empty')).toBeDefined()
    expect(screen.getByText('暂无历史会话')).toBeDefined()
  })

  it('renders session list with multiple sessions', () => {
    const sessions = [createSession('s1', '会话一', 5), createSession('s2', '会话二', 3)]

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(2, 1, 10)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByText('会话一')).toBeDefined()
    expect(screen.getByText('会话二')).toBeDefined()
    expect(screen.getAllByText('5 条消息').length).toBe(2)
    expect(screen.getAllByText('3 条消息').length).toBe(2)
  })

  it('calls onResume when session card is clicked', () => {
    const onResume = vi.fn()
    const sessions = [createSession('s1', '测试会话')]

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(1, 1, 10)}
        onResume={onResume}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByText('测试会话'))

    expect(onResume).toHaveBeenCalledWith(sessions[0])
  })

  it('calls onDelete when delete item in dropdown is clicked', () => {
    const onDelete = vi.fn()
    const sessions = [createSession('s1', '测试会话')]

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(1, 1, 10)}
        onResume={vi.fn()}
        onDelete={onDelete}
        onPageChange={vi.fn()}
      />,
    )

    const trigger = screen.getByTestId('session-menu-trigger-s1')
    fireEvent.click(trigger)

    const deleteItem = screen.getByText('删除会话')
    fireEvent.click(deleteItem)

    expect(onDelete).toHaveBeenCalled()
    expect(onDelete.mock.calls[0][0]).toEqual(sessions[0])
  })

  it('disables menu trigger when deletingId matches', () => {
    const sessions = [createSession('s1', '测试会话')]

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(1, 1, 10)}
        deletingId="s1"
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    const trigger = screen.getByTestId('session-menu-trigger-s1') as HTMLButtonElement
    expect(trigger.disabled).toBe(true)
  })

  it('renders pagination when total exceeds pageSize', () => {
    const sessions = Array.from({ length: 10 }, (_, i) => createSession(`s${i}`, `会话 ${i}`))

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(12, 1, 5)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('pagination')).toBeDefined()
    expect(screen.getByText('2')).toBeDefined()
    expect(screen.getByText('下一页')).toBeDefined()
  })

  it('does not render pagination when total fits in one page', () => {
    const sessions = [createSession('s1', '会话一')]

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(1, 1, 10)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.queryByTestId('pagination')).toBeNull()
  })

  it('calls onPageChange when pagination links are clicked', () => {
    const onPageChange = vi.fn()
    const sessions = Array.from({ length: 10 }, (_, i) => createSession(`s${i}`, `会话 ${i}`))

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(12, 1, 5)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={onPageChange}
      />,
    )

    const page2Btn = screen.getByText('2')
    fireEvent.click(page2Btn)

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('formats session time correctly', () => {
    const now = new Date()
    const todaySession = createSession('s1', 'Test Session')
    todaySession.createdAt = now.toISOString()
    todaySession.updatedAt = now.toISOString()

    render(
      <ChatHistoryList
        sessions={[todaySession]}
        page={1}
        pagination={createPagination(1, 1, 10)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    const timeElements = screen.getAllByText(/今天/)
    expect(timeElements.length).toBeGreaterThanOrEqual(1)
  })

  it('displays "未命名会话" when title is empty', () => {
    const sessions = [{ ...createSession('s1', ''), title: '' }]

    render(
      <ChatHistoryList
        sessions={sessions}
        page={1}
        pagination={createPagination(1, 1, 10)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={vi.fn()}
      />,
    )

    expect(screen.getByText('未命名会话')).toBeDefined()
  })

  it('handles previous/next pagination clicks', () => {
    const onPageChange = vi.fn()
    const sessions = Array.from({ length: 10 }, (_, i) => createSession(`s${i}`, `会话 ${i}`))

    render(
      <ChatHistoryList
        sessions={sessions}
        page={2}
        pagination={createPagination(12, 2, 5)}
        onResume={vi.fn()}
        onDelete={vi.fn()}
        onPageChange={onPageChange}
      />,
    )

    const prevBtn = screen.getByText('上一页')
    const nextBtn = screen.getByText('下一页')

    fireEvent.click(prevBtn)
    expect(onPageChange).toHaveBeenCalledWith(1)

    fireEvent.click(nextBtn)
    expect(onPageChange).toHaveBeenCalledWith(3)
  })
})
