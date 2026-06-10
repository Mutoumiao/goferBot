import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '@/stores/auth'
import { useAuthPageStore } from '@/features/auth/store'

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

  describe('useAuthStore', () => {
    it('has default state', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.token).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isInitialized).toBe(false)
    })

    it('setAuth updates token, user and isAuthenticated', () => {
      const user = { id: 'u1', email: 'a@b.com', name: 'User' }
      useAuthStore.getState().setAuth('token-1', user as any)

      const state = useAuthStore.getState()
      expect(state.token).toBe('token-1')
      expect(state.user).toEqual(user)
      expect(state.isAuthenticated).toBe(true)
    })

    it('clearAuth resets state and removes tokens from localStorage', () => {
      localStorage.setItem('goferbot_access_token', 'token-1')
      localStorage.setItem('goferbot_refresh_token', 'refresh-1')
      useAuthStore.setState({
        token: 'token-1',
        user: { id: 'u1', email: 'a@b.com', name: 'User' } as any,
        isAuthenticated: true,
        isInitialized: true,
      })

      useAuthStore.getState().clearAuth()

      const state = useAuthStore.getState()
      expect(state.token).toBeNull()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(localStorage.getItem('goferbot_access_token')).toBeNull()
      expect(localStorage.getItem('goferbot_refresh_token')).toBeNull()
    })

    it('setUser updates user only', () => {
      useAuthStore.getState().setAuth('token-1', { id: 'u1', email: 'a@b.com', name: 'Old' } as any)
      useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com', name: 'New' } as any)

      expect(useAuthStore.getState().user?.name).toBe('New')
      expect(useAuthStore.getState().token).toBe('token-1')
    })

    it('setInitialized updates isInitialized', () => {
      useAuthStore.getState().setInitialized(true)
      expect(useAuthStore.getState().isInitialized).toBe(true)
    })

    it('persists token and isAuthenticated to localStorage', () => {
      useAuthStore.getState().setAuth('token-1', { id: 'u1', email: 'a@b.com', name: 'User' } as any)

      const persisted = JSON.parse(localStorage.getItem('goferbot-auth')!)
      expect(persisted.state.token).toBe('token-1')
      expect(persisted.state.isAuthenticated).toBe(true)
    })
  })

  describe('useAuthPageStore', () => {
    beforeEach(() => {
      useAuthPageStore.setState({ tab: 'login', rememberEmail: null })
    })

    it('defaults to login tab', () => {
      expect(useAuthPageStore.getState().tab).toBe('login')
      expect(useAuthPageStore.getState().rememberEmail).toBeNull()
    })

    it('switches tab to register', () => {
      useAuthPageStore.getState().setTab('register')
      expect(useAuthPageStore.getState().tab).toBe('register')
    })

    it('switches tab back to login', () => {
      useAuthPageStore.setState({ tab: 'register' })
      useAuthPageStore.getState().setTab('login')
      expect(useAuthPageStore.getState().tab).toBe('login')
    })

    it('stores remembered email', () => {
      useAuthPageStore.getState().setRememberEmail('user@example.com')
      expect(useAuthPageStore.getState().rememberEmail).toBe('user@example.com')
    })

    it('clears remembered email', () => {
      useAuthPageStore.setState({ rememberEmail: 'user@example.com' })
      useAuthPageStore.getState().setRememberEmail(null)
      expect(useAuthPageStore.getState().rememberEmail).toBeNull()
    })
  })
})
