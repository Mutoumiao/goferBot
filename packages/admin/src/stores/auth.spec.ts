import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
    })
    localStorage.clear()
  })

  it('has default state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setUser updates user and isAuthenticated', () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      name: 'User',
      role: 'ADMIN' as const,
      isActive: true,
    }
    useAuthStore.getState().setUser(user)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser updates user only', () => {
    useAuthStore.getState().setUser({
      id: 'u1',
      email: 'a@b.com',
      name: 'Old',
      role: 'ADMIN' as const,
      isActive: true,
    })
    useAuthStore
      .getState()
      .setUser({ id: 'u1', email: 'a@b.com', name: 'New', role: 'ADMIN' as const, isActive: true })

    expect(useAuthStore.getState().user?.name).toBe('New')
  })

  it('clearAuth resets state', () => {
    useAuthStore.setState({
      user: { id: 'u1', email: 'a@b.com', name: 'User', role: 'ADMIN' as const, isActive: true },
      isAuthenticated: true,
      isInitialized: true,
    })

    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
