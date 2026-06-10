import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { User } from '@goferbot/data'

vi.mock('@/api/auth', () => ({
  login: vi.fn(() => ({ send: vi.fn() })),
  register: vi.fn(() => ({ send: vi.fn() })),
  refresh: vi.fn(() => ({ send: vi.fn() })),
  getMe: vi.fn(() => ({ send: vi.fn() })),
}))

vi.mock('@/utils/password-encryption', () => ({
  encryptPassword: vi.fn((pwd: string) => Promise.resolve(`encrypted-${pwd}`)),
  clearPublicKeyCache: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn() },
}))

import { login, register, refresh, getMe } from '@/api/auth'
import { encryptPassword, clearPublicKeyCache } from '@/utils/password-encryption'
import { useAuthStore } from '@/stores/auth'
import { loginUser, registerUser, logoutUser, refreshAuth, fetchCurrentUser } from '@/features/auth/services'

const mockUser: User = {
  id: 'u1',
  email: 'user@example.com',
  name: 'User',
  createdAt: '',
  updatedAt: '',
}

describe('auth services', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, token: null, isAuthenticated: false, isInitialized: false })
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

    it('encrypts password before sending', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'token-1', user: mockUser }),
      } as any)

      await loginUser('user@example.com', 'password', false)

      expect(encryptPassword).toHaveBeenCalledWith('password')
      expect(login).toHaveBeenCalledWith({ email: 'user@example.com', encryptedPassword: 'encrypted-password' })
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

    it('clears public key cache on DECRYPT_FAILED', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'DECRYPT_FAILED', message: '密钥过期' }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('加密密钥已过期，请刷新页面后重试')
      expect(clearPublicKeyCache).toHaveBeenCalled()
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

    it('encrypts password before sending', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'token-2', user: mockUser }),
      } as any)

      await registerUser('User', 'user@example.com', 'password')

      expect(encryptPassword).toHaveBeenCalledWith('password')
      expect(register).toHaveBeenCalledWith({ email: 'user@example.com', encryptedPassword: 'encrypted-password', name: 'User' })
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

    it('clears public key cache on DECRYPT_FAILED', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'DECRYPT_FAILED', message: '密钥过期' }),
      } as any)

      const result = await registerUser('User', 'user@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('加密密钥已过期，请刷新页面后重试')
      expect(clearPublicKeyCache).toHaveBeenCalled()
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

    it('clears refresh token from localStorage', () => {
      useAuthStore.setState({ token: 'token-1', user: mockUser, isAuthenticated: true })
      localStorage.setItem('goferbot_access_token', 'token-1')
      localStorage.setItem('goferbot_refresh_token', 'refresh-1')

      logoutUser()

      expect(localStorage.getItem('goferbot_access_token')).toBeNull()
      expect(localStorage.getItem('goferbot_refresh_token')).toBeNull()
    })
  })

  describe('refreshAuth', () => {
    it('returns true and stores tokens on success', async () => {
      vi.mocked(refresh).mockReturnValue({
        send: vi.fn().mockResolvedValue({ accessToken: 'new-token', refreshToken: 'new-refresh' }),
      } as any)

      const result = await refreshAuth()

      expect(result).toBe(true)
      expect(localStorage.getItem('goferbot_access_token')).toBe('new-token')
      expect(localStorage.getItem('goferbot_refresh_token')).toBe('new-refresh')
    })

    it('returns false when no accessToken in response', async () => {
      vi.mocked(refresh).mockReturnValue({
        send: vi.fn().mockResolvedValue({ refreshToken: 'new-refresh' }),
      } as any)

      const result = await refreshAuth()

      expect(result).toBe(false)
    })

    it('returns false on api failure', async () => {
      vi.mocked(refresh).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('invalid refresh token')),
      } as any)

      const result = await refreshAuth()

      expect(result).toBe(false)
    })
  })

  describe('fetchCurrentUser', () => {
    it('returns true and updates user on success', async () => {
      vi.mocked(getMe).mockReturnValue({
        send: vi.fn().mockResolvedValue(mockUser),
      } as any)

      const result = await fetchCurrentUser()

      expect(result).toBe(true)
      expect(useAuthStore.getState().user).toEqual(mockUser)
    })

    it('returns false on api failure', async () => {
      vi.mocked(getMe).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('unauthorized')),
      } as any)

      const result = await fetchCurrentUser()

      expect(result).toBe(false)
      expect(useAuthStore.getState().user).toBeNull()
    })
  })

  describe('mapAuthError', () => {
    it('maps USER_EXISTS to user-friendly message', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'USER_EXISTS', message: 'Email already registered' }),
      } as any)

      const result = await registerUser('User', 'user@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('该邮箱已被注册')
    })

    it('maps AUTH_FAIL to user-friendly message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'AUTH_FAIL', message: 'Invalid credentials' }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('邮箱或密码错误')
    })

    it('maps ACCOUNT_DISABLED to user-friendly message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'ACCOUNT_DISABLED', message: 'Account disabled' }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('账号已被禁用')
    })

    it('maps INVALID_REFRESH_TOKEN to user-friendly message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'INVALID_REFRESH_TOKEN', message: 'Token expired' }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('登录已过期，请重新登录')
    })

    it('maps USER_NOT_FOUND to user-friendly message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'USER_NOT_FOUND', message: 'User not found' }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('用户不存在')
    })

    it('maps VALIDATION_ERROR with message', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'VALIDATION_ERROR', message: 'Name too short' }),
      } as any)

      const result = await registerUser('U', 'user@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Name too short')
    })

    it('maps VALIDATION_ERROR without message to fallback', async () => {
      vi.mocked(register).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'VALIDATION_ERROR' }),
      } as any)

      const result = await registerUser('User', 'user@example.com', 'password')

      expect(result.success).toBe(false)
      expect(result.error).toBe('输入信息不符合要求')
    })

    it('maps unknown error code to fallback message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue({ code: 'UNKNOWN_ERROR', message: 'Something weird' }),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Something weird')
    })

    it('maps plain Error instance to message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue(new Error('network timeout')),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('network timeout')
    })

    it('maps non-object error to fallback message', async () => {
      vi.mocked(login).mockReturnValue({
        send: vi.fn().mockRejectedValue('string error'),
      } as any)

      const result = await loginUser('user@example.com', 'password', false)

      expect(result.success).toBe(false)
      expect(result.error).toBe('操作失败，请稍后重试')
    })
  })
})
