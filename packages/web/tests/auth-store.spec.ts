import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../../../packages/web/src/stores/auth'

describe('auth Store', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
    })
    localStorage.clear()
  })

  it('AC-05: initial state is unauthenticated', () => {
    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
  })

  it('AC-05: setAuth sets token, user, and isAuthenticated', () => {
    useAuthStore.getState().setAuth('test-token', {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
    })

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(true)
    expect(state.token).toBe('test-token')
    expect(state.user?.email).toBe('test@example.com')
  })

  it('AC-09: clearAuth resets all state and removes localStorage token', () => {
    localStorage.setItem('goferbot_access_token', 'test-value')
    useAuthStore.getState().setAuth('token', {
      id: '1',
      email: 'a@b.com',
      name: 'X',
    })
    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.isAuthenticated).toBe(false)
    expect(state.token).toBeNull()
    expect(state.user).toBeNull()
    // clearAuth 应同步清除直接的 localStorage key
    expect(localStorage.getItem('goferbot_access_token')).toBeNull()
  })

  it('AC-05: setUser updates only user field', () => {
    useAuthStore.getState().setAuth('token', {
      id: '1',
      email: 'old@b.com',
      name: 'Old',
    })
    useAuthStore.getState().setUser({
      id: '1',
      email: 'new@b.com',
      name: 'New',
    })

    expect(useAuthStore.getState().user?.email).toBe('new@b.com')
    expect(useAuthStore.getState().token).toBe('token')
  })
})
