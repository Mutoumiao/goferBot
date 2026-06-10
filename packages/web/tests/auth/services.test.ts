import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@goferbot/data'

vi.mock('@/api/auth', () => ({
  login: vi.fn(() => ({ send: vi.fn() })),
  register: vi.fn(() => ({ send: vi.fn() })),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

import { login, register } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { loginUser, registerUser, logoutUser } from '@/features/auth/services'

const mockUser: User = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  createdAt: '',
  updatedAt: '',
}

describe('auth services', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('loginUser', () => {
    it('returns false when email or password is empty', async () => {
      const r1 = await loginUser('', 'pass', false)
      expect(r1.success).toBe(false)
      const r2 = await loginUser('a@b.com', '', false)
      expect(r2.success).toBe(false)
      expect(login).not.toHaveBeenCalled()
    })

    it('sets auth on success', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'token-1', user: mockUser }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(true)
      expect(useAuthStore.getState().token).toBe('token-1')
      expect(useAuthStore.getState().user).toEqual(mockUser)
      expect(useAuthStore.getState().isAuthenticated).toBe(true)
      expect(localStorage.getItem('goferbot_access_token')).toBe('token-1')
      expect(localStorage.getItem('goferbot_remember_email')).toBeNull()
    })

    it('remembers email when rememberMe is true', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'token-1', user: mockUser }),
      } as any)

      await loginUser('user@example.com', 'password', true)

      expect(localStorage.getItem('goferbot_remember_email')).toBe('user@example.com')
    })

    it('removes remembered email when rememberMe is false', async () => {
      localStorage.setItem('goferbot_remember_email', 'old@example.com')
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'token-1', user: mockUser }),
      } as any)

      await loginUser('user@example.com', 'password', false)

      expect(localStorage.getItem('goferbot_remember_email')).toBeNull()
    })

    it('returns error on api failure', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('invalid credentials')),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('invalid credentials')
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })

  describe('registerUser', () => {
    it('returns false when fields are empty', async () => {
      const r1 = await registerUser('', 'a@b.com', 'pass')
      expect(r1.success).toBe(false)
      const r2 = await registerUser('name', '', 'pass')
      expect(r2.success).toBe(false)
      const r3 = await registerUser('name', 'a@b.com', '')
      expect(r3.success).toBe(false)
      expect(register).not.toHaveBeenCalled()
    })

    it('sets auth on success', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'token-2', user: mockUser }),
      } as any)

      const result = await registerUser('User', 'user@example.com', 'password')

      expect(result.success).toBe(true)
      expect(useAuthStore.getState().token).toBe('token-2')
      expect(useAuthStore.getState().user).toEqual(mockUser)
      expect(localStorage.getItem('goferbot_access_token')).toBe('token-2')
    })

    it('returns error on api failure', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('email taken')),
      } as any)

      const result = await registerUser('User', 'user@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('email taken')
      expect(useAuthStore.getState().isAuthenticated).toBe(false)
    })
  })

  describe('logoutUser', () => {
    it('clears auth state', () => {
      useAuthStore.setState({ token: 'token-1', user: mockUser, isAuthenticated: true })
      localStorage.setItem('goferbot_access_token', 'token-1')

      logoutUser()

      expect(useAuthStore.getState().isAuthenticated).toBe(false)
      expect(useAuthStore.getState().token).toBeNull()
      expect(useAuthStore.getState().user).toBeNull()
    })
  })
})
