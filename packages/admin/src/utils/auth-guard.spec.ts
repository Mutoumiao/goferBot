import { describe, expect, it, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { isAdmin, getAuthSnapshot, waitForAuthInit } from '@/utils/auth-guard'

describe('auth-guard', () => {
  beforeEach(() => {
    useAuthStore.setState(
      {
        user: null,
        token: null,
        isAuthenticated: false,
        isInitialized: false,
        _hydrated: false,
        setAuth: (() => undefined) as never,
        clearAuth: (() => undefined) as never,
        setUser: (() => undefined) as never,
        setInitialized: ((v: boolean) => useAuthStore.setState({ isInitialized: v })) as never,
      },
      true,
    )
  })

  it('isAdmin requires ADMIN role and token', () => {
    expect(isAdmin({ token: 't', role: 'ADMIN' })).toBe(true)
    expect(isAdmin({ token: 't', role: 'USER' })).toBe(false)
    expect(isAdmin({ token: null, role: 'ADMIN' })).toBe(false)
  })

  it('getAuthSnapshot reads token and role', () => {
    useAuthStore.setState({
      token: 'tok',
      user: { id: '1', role: 'ADMIN', email: 'a@b.com' },
    } as never)
    expect(getAuthSnapshot()).toEqual({ token: 'tok', role: 'ADMIN' })
  })

  it('waitForAuthInit resolves immediately when hydrated', async () => {
    useAuthStore.setState({ _hydrated: true, isInitialized: true } as never)
    const result = await waitForAuthInit()
    expect(result).toBeUndefined()
  })

  it('waitForAuthInit times out and marks initialized', async () => {
    useAuthStore.setState({ _hydrated: false, isInitialized: false } as never)
    const start = Date.now()
    await waitForAuthInit(150)
    const elapsed = Date.now() - start
    expect(elapsed).toBeGreaterThanOrEqual(140)
    expect(useAuthStore.getState().isInitialized).toBe(true)
  }, 5000)
})
