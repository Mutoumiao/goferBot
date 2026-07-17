import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockNavigate = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) => {
    const state = { location: { pathname: '/chats' } }
    return opts?.select ? opts.select(state) : state
  },
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector?: (s: { user: { name: string; avatar?: string } | null }) => unknown) => {
    const state = { user: { name: 'Tester', avatar: undefined } }
    return selector ? selector(state) : state
  },
}))

vi.mock('@/features/auth/components/Avatar', () => ({
  Avatar: () => <div data-testid="avatar" />,
}))

import { IconSidebar } from '@/components/sidebar/Sidebar'

describe('IconSidebar', () => {
  beforeEach(() => {
    mockNavigate.mockReset()
  })

  it('renders primary rail items: 会话 / 知识库 / 伴侣（无用户 icon，头像进个人资料）', () => {
    render(<IconSidebar />)
    expect(screen.getByTestId('rail-chats')).toBeTruthy()
    expect(screen.getByTestId('rail-knowledgeBase')).toBeTruthy()
    expect(screen.getByTestId('rail-companion')).toBeTruthy()
    expect(screen.queryByTestId('rail-profile')).toBeNull()
    expect(screen.getByTestId('rail-avatar')).toBeTruthy()
  })

  it('renders secondary rail items: 设置 / 回收站', () => {
    render(<IconSidebar />)
    expect(screen.getByTestId('rail-settings')).toBeTruthy()
    expect(screen.getByTestId('rail-recycle')).toBeTruthy()
    expect(screen.queryByTestId('rail-menu')).toBeNull()
  })

  it('marks current route active with aria-current', () => {
    render(<IconSidebar />)
    expect(screen.getByTestId('rail-chats').getAttribute('aria-current')).toBe('page')
    expect(screen.getByTestId('rail-chats').getAttribute('data-active')).toBe('true')
  })

  it('navigates with router.navigate when clicking nav item', async () => {
    const user = userEvent.setup()
    render(<IconSidebar />)
    await user.click(screen.getByTestId('rail-knowledgeBase'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/knowledgeBase' })
  })

  it('navigates to profile when clicking avatar', async () => {
    const user = userEvent.setup()
    render(<IconSidebar />)
    await user.click(screen.getByLabelText('个人资料'))
    expect(mockNavigate).toHaveBeenCalledWith({ to: '/profile' })
  })

  it('does not navigate when clicking already active item', async () => {
    const user = userEvent.setup()
    render(<IconSidebar />)
    await user.click(screen.getByTestId('rail-chats'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
