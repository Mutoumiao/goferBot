import type { Session } from '@goferbot/data'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SessionListPanel } from '@/features/chat/components/SessionListPanel'

function makeSession(partial: Partial<Session> & { id: string }): Session {
  return {
    title: '会话标题',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    userId: 'u1',
    ...partial,
  } as Session
}

describe('SessionListPanel', () => {
  it('renders empty state', () => {
    render(
      <SessionListPanel sessions={[]} selectedId={undefined} onSelect={vi.fn()} onNewChat={vi.fn()} />,
    )
    expect(screen.getByTestId('session-list-empty')).toBeTruthy()
    expect(screen.getByText('暂无历史会话')).toBeTruthy()
    expect(screen.getByTestId('session-home-entry').getAttribute('data-active')).toBe('true')
    expect(screen.queryByTestId('session-copilot-entry')).toBeNull()
    expect(screen.queryByTestId('session-more-toggle')).toBeNull()
  })

  it('renders loading skeletons', () => {
    render(
      <SessionListPanel
        sessions={[]}
        loading
        selectedId={undefined}
        onSelect={vi.fn()}
        onNewChat={vi.fn()}
      />,
    )
    expect(screen.getByTestId('session-list-loading')).toBeTruthy()
  })

  it('renders error with retry', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    render(
      <SessionListPanel
        sessions={[]}
        error={new Error('网络错误')}
        selectedId={undefined}
        onSelect={vi.fn()}
        onNewChat={vi.fn()}
        onRetry={onRetry}
      />,
    )
    expect(screen.getByTestId('session-list-error')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: '重试' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('highlights selected session and calls onSelect', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    const sessions = [
      makeSession({ id: 's1', title: '第一' }),
      makeSession({ id: 's2', title: '第二' }),
    ]
    render(
      <SessionListPanel
        sessions={sessions}
        selectedId="s1"
        onSelect={onSelect}
        onNewChat={vi.fn()}
      />,
    )

    const active = screen.getByTestId('session-item-s1')
    expect(active.getAttribute('data-active')).toBe('true')
    expect(active.getAttribute('aria-current')).toBe('true')
    expect(screen.getByTestId('session-item-s2').getAttribute('data-active')).toBeNull()

    await user.click(screen.getByTestId('session-item-s2'))
    expect(onSelect).toHaveBeenCalledWith(sessions[1])
  })

  it('calls onNewChat when clicking 智能对话（无单独新会话按钮）', async () => {
    const onNewChat = vi.fn()
    const user = userEvent.setup()
    render(
      <SessionListPanel sessions={[]} selectedId={undefined} onSelect={vi.fn()} onNewChat={onNewChat} />,
    )
    expect(screen.queryByTestId('new-chat-btn')).toBeNull()
    await user.click(screen.getByTestId('session-home-entry'))
    expect(onNewChat).toHaveBeenCalled()
  })
})
