import { act, render, screen } from '@testing-library/react'
import { useMemo } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  destroyAllKeepAliveCaches,
  KeepAliveProvider,
  KeepAliveRouteContext,
  matchKeepAliveKey,
  useKeepAlive,
  useKeepAliveSilentRefresh,
  type KeepAliveRefreshOptions,
} from '@/lib/route-keepalive'
import { KeepAliveOutlet } from '@/lib/route-keepalive-outlet'

vi.mock('@tanstack/react-router', () => ({
  Outlet: () => <div data-testid="live-outlet" />,
  useRouter: () => ({
    routesById: {},
  }),
  useRouterState: (opts?: { select?: (s: unknown) => unknown }) => {
    const state = {
      location: { pathname: '/chats', search: {} },
      matches: [],
    }
    return opts?.select ? opts.select(state) : state
  },
}))

vi.mock('@/features/chat/components/ChatsPage', () => ({
  ChatsPage: () => <div data-testid="cached-chats">chats</div>,
}))
vi.mock('@/features/KnowledgeBase/components/KnowledgeBasePage', () => ({
  KnowledgeBasePage: () => <div data-testid="cached-kb">kb</div>,
}))
vi.mock('@/features/companion/components/CompanionsWorkspace', () => ({
  CompanionsWorkspace: () => <div data-testid="cached-companions">companions</div>,
}))
vi.mock('@/features/settings/components/SettingsPage', () => ({
  SettingsPage: () => <div data-testid="cached-settings">settings</div>,
}))
vi.mock('@/features/recycle/RecycleBinPage', () => ({
  RecycleBinPage: () => <div data-testid="cached-recycle">recycle</div>,
}))
vi.mock('@/features/auth/components/ProfilePage', () => ({
  ProfilePage: () => <div>profile</div>,
}))

function Probe() {
  const { destroyAll, keys } = useKeepAlive()
  return (
    <div>
      <span data-testid="keys-len">{keys.length}</span>
      <button type="button" onClick={() => destroyAll()} data-testid="destroy-all">
        clear
      </button>
    </div>
  )
}

describe('route-keepalive', () => {
  it('matchKeepAliveKey maps primary paths only (no secondary path keep-alive)', () => {
    expect(matchKeepAliveKey('/chats')).toBe('chats')
    expect(matchKeepAliveKey('/knowledgeBase')).toBe('knowledgeBase')
    expect(matchKeepAliveKey('/companions')).toBe('companions')
    expect(matchKeepAliveKey('/companions/')).toBe('companions')
    // 二级 path 不得命中 keep-alive（产品上已取消此类路由）
    expect(matchKeepAliveKey('/companions/x/chat')).toBeNull()
    expect(matchKeepAliveKey('/companions/new')).toBeNull()
    expect(matchKeepAliveKey('/settings')).toBe('settings')
    expect(matchKeepAliveKey('/profile')).toBe('profile')
    expect(matchKeepAliveKey('/recycle')).toBe('recycle')
  })

  it('provides destroyAll without throwing', () => {
    render(
      <KeepAliveProvider>
        <Probe />
      </KeepAliveProvider>,
    )
    expect(screen.getByTestId('keys-len').textContent).toBe('0')
    act(() => {
      screen.getByTestId('destroy-all').click()
    })
    expect(() => destroyAllKeepAliveCaches()).not.toThrow()
  })

  it('warms primary pages and keeps chats active without Outlet', async () => {
    render(
      <KeepAliveProvider>
        <KeepAliveOutlet />
      </KeepAliveProvider>,
    )
    // ensure 在 effect 中执行
    await act(async () => {})
    expect(screen.getByTestId('cached-chats')).toBeTruthy()
    expect(screen.getByTestId('cached-kb')).toBeTruthy()
    expect(screen.getByTestId('cached-settings')).toBeTruthy()
    expect(screen.getByTestId('keepalive-outlet')).toBeTruthy()
    expect(screen.queryByTestId('live-outlet')).toBeNull()
    expect(screen.getByTestId('cached-chats').closest('[data-keepalive-active]')?.getAttribute('data-keepalive-active')).toBe(
      'true',
    )
  })

  it('useKeepAliveSilentRefresh：隐藏不刷，首进 silent=false，再进 silent=true', async () => {
    const calls: KeepAliveRefreshOptions[] = []

    function ProbeRefresh({ active }: { active: boolean }) {
      const value = useMemo(
        () => ({ isActive: active, cacheKey: 'chats' as const }),
        [active],
      )
      return (
        <KeepAliveRouteContext.Provider value={value}>
          <SilentProbe onCall={(o) => calls.push(o)} />
        </KeepAliveRouteContext.Provider>
      )
    }

    function SilentProbe({ onCall }: { onCall: (o: KeepAliveRefreshOptions) => void }) {
      useKeepAliveSilentRefresh(onCall)
      return <div data-testid="silent-probe" />
    }

    const { rerender } = render(<ProbeRefresh active={false} />)
    await act(async () => {})
    expect(calls).toHaveLength(0)

    rerender(<ProbeRefresh active={true} />)
    await act(async () => {})
    expect(calls).toEqual([{ silent: false }])

    rerender(<ProbeRefresh active={false} />)
    await act(async () => {})
    expect(calls).toHaveLength(1)

    rerender(<ProbeRefresh active={true} />)
    await act(async () => {})
    expect(calls).toEqual([{ silent: false }, { silent: true }])

    // 持续激活不重复
    rerender(<ProbeRefresh active={true} />)
    await act(async () => {})
    expect(calls).toHaveLength(2)
  })
})

