import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '@/stores/auth'

describe('auth store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: false,
    })
    localStorage.clear()
  })

  it('has default state', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setAuth updates token, user, isAuthenticated', () => {
    const user = {
      id: 'u1',
      email: 'a@b.com',
      name: 'User',
      role: 'ADMIN' as const,
      isActive: true,
    }
    useAuthStore.getState().setAuth('token-1', user)

    const state = useAuthStore.getState()
    expect(state.token).toBe('token-1')
    expect(state.user).toEqual(user)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser updates user only', () => {
    useAuthStore
      .getState()
      .setAuth('token-1', {
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
    expect(useAuthStore.getState().token).toBe('token-1')
  })

  it('clearAuth clears state and tokens', () => {
    localStorage.setItem('goferbot_admin_access_token', 'token-1')
    useAuthStore.setState({
      token: 'token-1',
      user: { id: 'u1', email: 'a@b.com', name: 'User', role: 'ADMIN' as const, isActive: true },
      isAuthenticated: true,
      isInitialized: true,
    })

    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(localStorage.getItem('goferbot_admin_access_token')).toBeNull()
    expect(localStorage.getItem('goferbot_admin_refresh_token')).toBeNull()
  })
})
