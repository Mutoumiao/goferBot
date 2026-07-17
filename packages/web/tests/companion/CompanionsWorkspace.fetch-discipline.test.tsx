/**
 * 回归：CompanionsWorkspace 列表请求纪律
 * - 未激活（未访问路由 / 保活隐藏）不请求
 * - 按 tab 缓存，切回官方不会变空且会无感再拉
 * - 有缓存时二次刷新不置 blocking loading
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listSend = vi.fn()
const deleteSend = vi.fn()
let keepAliveActive = true

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('ahooks', () => ({
  useResponsive: () => ({ large: true }),
}))

vi.mock('@/lib/route-keepalive', () => ({
  useKeepAliveActive: () => keepAliveActive,
}))

vi.mock('@/features/companion/services', () => ({
  listCompanions: (params?: { tab?: string }) => ({
    send: () => listSend(params),
  }),
  deleteCompanion: (id: string) => ({
    send: () => deleteSend(id),
  }),
}))

vi.mock('@/features/companion/components/CompanionChatPage', () => ({
  CompanionChatPage: ({ companionId }: { companionId: string }) => (
    <div data-testid="mock-chat">{companionId}</div>
  ),
}))

import { CompanionsWorkspace } from '@/features/companion/components/CompanionsWorkspace'
import { useCompanionStore } from '@/features/companion/store'

const officialItem = {
  id: 'official-1',
  name: '官方甲',
  isBuiltin: true,
  status: 'published' as const,
}
const mineItem = {
  id: 'mine-1',
  name: '我的乙',
  isBuiltin: false,
  status: 'published' as const,
}

describe('CompanionsWorkspace fetch discipline', () => {
  beforeEach(() => {
    listSend.mockReset()
    deleteSend.mockReset()
    keepAliveActive = true
    useCompanionStore.setState({
      companions: [],
      isLoading: false,
      error: null,
      selectedCompanionId: null,
    })
    listSend.mockImplementation(async (params?: { tab?: string }) => {
      if (params?.tab === 'mine') {
        return { items: [mineItem] }
      }
      return { items: [officialItem] }
    })
  })

  it('未激活时不请求 companions API', async () => {
    keepAliveActive = false
    render(<CompanionsWorkspace />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 60))
    })
    expect(listSend).not.toHaveBeenCalled()
  })

  it('激活后才请求 official；切 mine 再切回 official 仍有列表且会再拉', async () => {
    const user = userEvent.setup()
    render(<CompanionsWorkspace />)

    await waitFor(() => {
      expect(listSend).toHaveBeenCalledWith({ tab: 'official' })
    })
    await waitFor(() => {
      expect(screen.getByText('官方甲')).toBeTruthy()
    })
    expect(listSend.mock.calls.filter((c) => c[0]?.tab === 'official')).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: '我的伴侣' }))
    await waitFor(() => {
      expect(screen.getByText('我的乙')).toBeTruthy()
    })
    expect(listSend.mock.calls.filter((c) => c[0]?.tab === 'mine')).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: '官方推荐' }))
    // 立即从缓存恢复，不应变空
    expect(screen.getByText('官方甲')).toBeTruthy()
    await waitFor(() => {
      // 无感再拉
      expect(listSend.mock.calls.filter((c) => c[0]?.tab === 'official').length).toBeGreaterThanOrEqual(
        2,
      )
    })
    expect(screen.getByText('官方甲')).toBeTruthy()
  })

  it('选中不在列表时切 mine 不循环请求', async () => {
    const user = userEvent.setup()
    listSend.mockImplementation(async (params?: { tab?: string }) => {
      if (params?.tab === 'mine') return { items: [] }
      return { items: [officialItem] }
    })

    render(<CompanionsWorkspace />)
    await waitFor(() => expect(screen.getByText('官方甲')).toBeTruthy())

    act(() => {
      useCompanionStore.getState().selectCompanion('official-1')
    })
    await user.click(screen.getByRole('tab', { name: '我的伴侣' }))

    await waitFor(() => {
      expect(listSend.mock.calls.filter((c) => c[0]?.tab === 'mine').length).toBeGreaterThanOrEqual(1)
    })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 80))
    })
    expect(listSend.mock.calls.filter((c) => c[0]?.tab === 'mine')).toHaveLength(1)
  })

  it('保活再激活会无感再拉当前 tab', async () => {
    const { rerender } = render(<CompanionsWorkspace />)
    await waitFor(() => expect(listSend).toHaveBeenCalledTimes(1))

    keepAliveActive = false
    rerender(<CompanionsWorkspace />)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    const callsWhileHidden = listSend.mock.calls.length

    keepAliveActive = true
    rerender(<CompanionsWorkspace />)
    await waitFor(() => {
      expect(listSend.mock.calls.length).toBeGreaterThan(callsWhileHidden)
    })
    expect(listSend.mock.calls.at(-1)?.[0]).toEqual({ tab: 'official' })
  })
})
