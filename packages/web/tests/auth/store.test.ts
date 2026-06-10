import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthPageStore } from '@/features/auth/store'

describe('auth page store', () => {
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
