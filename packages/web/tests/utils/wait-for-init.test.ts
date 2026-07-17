import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchMe = vi.fn()
const invalidatePendingFetchMe = vi.fn()

vi.mock('@/features/auth/services', () => ({
  fetchMe: (...args: unknown[]) => fetchMe(...args),
  invalidatePendingFetchMe: (...args: unknown[]) => invalidatePendingFetchMe(...args),
}))

import { useAuthStore } from '@/stores/auth'
import { waitForAuthInit } from '@/utils/wait-for-init'

describe('waitForAuthInit', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    fetchMe.mockReset()
    invalidatePendingFetchMe.mockReset()
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      _hydrated: false,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns isAuthenticated when already initialized', async () => {
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: true,
      _hydrated: true,
    })

    await expect(waitForAuthInit(1000)).resolves.toBe(true)
    expect(fetchMe).not.toHaveBeenCalled()
  })

  it('returns false when initialized but not authenticated', async () => {
    useAuthStore.setState({
      isInitialized: true,
      isAuthenticated: false,
      // 缓存 user 不得被视为已登录
      user: { id: 'u1', email: 'a@b.com', name: 'A', roles: [], createdAt: '', updatedAt: '' },
      _hydrated: true,
    })

    await expect(waitForAuthInit(1000)).resolves.toBe(false)
    expect(fetchMe).not.toHaveBeenCalled()
  })

  it('calls fetchMe once after hydration and returns its result', async () => {
    fetchMe.mockResolvedValue(true)
    useAuthStore.setState({ _hydrated: true, isInitialized: false })

    const p = waitForAuthInit(1000)
    await vi.runAllTimersAsync()
    await expect(p).resolves.toBe(true)
    expect(fetchMe).toHaveBeenCalledTimes(1)
  })

  it('does not loop when fetchMe fails (backend down)', async () => {
    fetchMe.mockResolvedValue(false)
    useAuthStore.setState({
      _hydrated: true,
      isInitialized: false,
      user: { id: 'u1', email: 'a@b.com', name: 'A', roles: [], createdAt: '', updatedAt: '' },
    })

    const first = waitForAuthInit(1000)
    await vi.runAllTimersAsync()
    await expect(first).resolves.toBe(false)

    // 模拟 fetchMe 失败后标记已初始化（与真实 fetchMe 行为一致）
    useAuthStore.setState({ isInitialized: true, isAuthenticated: false })

    const second = waitForAuthInit(1000)
    await expect(second).resolves.toBe(false)
    // 第二次不得再请求
    expect(fetchMe).toHaveBeenCalledTimes(1)
  })

  it('times out and forces initialized when hydration never completes', async () => {
    useAuthStore.setState({ _hydrated: false, isInitialized: false })

    const p = waitForAuthInit(200)
    await vi.advanceTimersByTimeAsync(250)
    await expect(p).resolves.toBe(false)
    expect(useAuthStore.getState().isInitialized).toBe(true)
    expect(fetchMe).not.toHaveBeenCalled()
  })

  it('times out when fetchMe hangs (backend no response)', async () => {
    fetchMe.mockImplementation(() => new Promise(() => {})) // never resolves
    useAuthStore.setState({ _hydrated: true, isInitialized: false })

    const p = waitForAuthInit(300)
    await vi.advanceTimersByTimeAsync(350)
    await expect(p).resolves.toBe(false)
    expect(useAuthStore.getState().isInitialized).toBe(true)
    expect(invalidatePendingFetchMe).toHaveBeenCalled()
  })

  it('shares a single in-flight wait promise across callers', async () => {
    fetchMe.mockImplementation(() => new Promise(() => {}))
    useAuthStore.setState({ _hydrated: true, isInitialized: false })

    const p1 = waitForAuthInit(500)
    const p2 = waitForAuthInit(500)
    expect(p1).toBe(p2)
    await vi.advanceTimersByTimeAsync(550)
    await expect(p1).resolves.toBe(false)
    expect(fetchMe).toHaveBeenCalledTimes(1)
  })
})
