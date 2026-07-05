import { beforeEach, describe, expect, it } from 'vitest'
import type { AdminRoleCode } from '@/stores/auth'
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
      roles: ['admin'] as AdminRoleCode[],
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
      roles: ['admin'] as AdminRoleCode[],
      isActive: true,
    })
    useAuthStore.getState().setUser({
      id: 'u1',
      email: 'a@b.com',
      name: 'New',
      roles: ['admin'] as AdminRoleCode[],
      isActive: true,
    })

    expect(useAuthStore.getState().user?.name).toBe('New')
  })

  it('clearAuth resets state but keeps isInitialized=true', () => {
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'a@b.com',
        name: 'User',
        roles: ['admin'] as AdminRoleCode[],
        isActive: true,
      },
      isAuthenticated: true,
      isInitialized: true,
    })

    useAuthStore.getState().clearAuth()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isInitialized).toBe(true)
  })

  it('setUser sets isInitialized to true to enable app rendering', () => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      _hydrated: true,
    })

    useAuthStore.getState().setUser({
      id: 'u1',
      email: 'a@b.com',
      name: 'User',
      roles: ['admin'] as AdminRoleCode[],
      isActive: true,
    })

    const state = useAuthStore.getState()
    expect(state.user).toBeDefined()
    expect(state.isAuthenticated).toBe(true)
    expect(state.isInitialized).toBe(true)
  })
})
