import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IconSidebar } from '@/components/sidebar/Sidebar'
import { ROUTES_REGISTER } from '@/router-register'

vi.mock('@/utils/cn', () => ({
  cn: (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' '),
}))

vi.mock('@/features/auth/components/Avatar', () => ({
  Avatar: ({ fallback }: { fallback?: string }) => (
    <div data-testid="avatar">{fallback?.[0] ?? 'U'}</div>
  ),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: (selector?: (s: any) => any) => {
    const state = { user: { name: 'Test User', avatarUrl: null } }
    return selector ? selector(state) : state
  },
}))

const mockOpenRoute = vi.fn()

vi.mock('@/stores/tabManager', () => ({
  tabManager: {
    openRoute: (...args: any[]) => mockOpenRoute(...args),
  },
}))

vi.mock('@/stores/workspace.store', () => ({
  useWorkspaceStore: (selector?: (s: any) => any) => {
    const state = {
      activeTab: () => ({
        id: 'tab-1',
        type: ROUTES_REGISTER.history.key,
        title: '会话历史',
        closable: true,
        createdAt: Date.now(),
      }),
    }
    return selector ? selector(state) : state
  },
}))

describe('IconSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders avatar and nav items from ROUTES_REGISTER', () => {
    render(<IconSidebar />)

    expect(screen.getByTestId('avatar')).toBeDefined()
    expect(screen.getByTitle('个人资料')).toBeDefined()

    const primaryRoutes = Object.values(ROUTES_REGISTER).filter((m) => m.navSection === 'primary')
    for (const meta of primaryRoutes) {
      expect(screen.getByTitle(meta.title)).toBeDefined()
    }

    const secondaryRoutes = Object.values(ROUTES_REGISTER).filter(
      (m) => m.navSection === 'secondary',
    )
    for (const meta of secondaryRoutes) {
      expect(screen.getByTitle(meta.title)).toBeDefined()
    }
  })

  it('calls tabManager.openRoute when clicking nav item', () => {
    render(<IconSidebar />)

    fireEvent.click(screen.getByTitle('知识库'))
    expect(mockOpenRoute).toHaveBeenCalledWith(ROUTES_REGISTER.knowledgeBase.key)

    fireEvent.click(screen.getByTitle('设置'))
    expect(mockOpenRoute).toHaveBeenCalledWith(ROUTES_REGISTER.settings.key)
  })

  it('calls tabManager.openRoute(profile) when clicking avatar', () => {
    render(<IconSidebar />)

    fireEvent.click(screen.getByTitle('个人资料'))
    expect(mockOpenRoute).toHaveBeenCalledWith(ROUTES_REGISTER.profile.key)
  })

  it('marks active tab', () => {
    render(<IconSidebar />)

    const historyBtn = screen.getByTitle('会话历史')
    expect(historyBtn.className).toContain('bg-[#D1D5DB]')
  })
})
