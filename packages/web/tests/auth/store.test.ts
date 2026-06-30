import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthPageStore } from '@/features/auth/store'
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

  describe('useAuthStore', () => {
    it('has default state', () => {
      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
      expect(state.isInitialized).toBe(false)
    })

    it('setUser updates user and isAuthenticated', () => {
      const user = { id: 'u1', email: 'a@b.com', name: 'User' }
      useAuthStore.getState().setUser(user as any)

      const state = useAuthStore.getState()
      expect(state.user).toEqual(user)
      expect(state.isAuthenticated).toBe(true)
    })

    it('clearAuth resets state', () => {
      useAuthStore.setState({
        user: { id: 'u1', email: 'a@b.com', name: 'User' } as any,
        isAuthenticated: true,
        isInitialized: true,
      })

      useAuthStore.getState().clearAuth()

      const state = useAuthStore.getState()
      expect(state.user).toBeNull()
      expect(state.isAuthenticated).toBe(false)
    })

    it('setUser updates user only', () => {
      useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com', name: 'Old' } as any)
      useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com', name: 'New' } as any)

      expect(useAuthStore.getState().user?.name).toBe('New')
    })

    it('setInitialized updates isInitialized', () => {
      useAuthStore.getState().setInitialized(true)
      expect(useAuthStore.getState().isInitialized).toBe(true)
    })

    it('persists user and isAuthenticated to localStorage', () => {
      useAuthStore.getState().setUser({ id: 'u1', email: 'a@b.com', name: 'User' } as any)

      const raw = localStorage.getItem('goferbot-auth')
      expect(raw).not.toBeNull()
      const persisted = JSON.parse(raw as string)
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
