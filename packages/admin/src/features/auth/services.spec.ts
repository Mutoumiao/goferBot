import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCurrentUser,
  getRememberedEmail,
  loginService,
  logoutService,
  refreshAuth,
  setRememberedEmail,
} from '@/features/auth/services'

const {
  mockLogin,
  mockRefresh,
  mockGetCurrentUser,
  mockSetAccessToken,
  mockSetRefreshToken,
  mockClearTokens,
  mockGetRefreshToken,
  mockLogout,
  mockSetAuth,
  mockSetUser,
  mockClearAuth,
  mockSetState,
  mockEncryptPassword,
  mockClearPublicKeyCache,
} = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRefresh: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockSetAccessToken: vi.fn(),
  mockSetRefreshToken: vi.fn(),
  mockClearTokens: vi.fn(),
  mockGetRefreshToken: vi.fn(),
  mockLogout: vi.fn(),
  mockSetAuth: vi.fn(),
  mockSetUser: vi.fn(),
  mockClearAuth: vi.fn(),
  mockSetState: vi.fn(),
  mockEncryptPassword: vi.fn().mockResolvedValue('encrypted-password'),
  mockClearPublicKeyCache: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  login: (d: unknown) => ({ send: () => mockLogin(d) }),
  logout: (d: unknown) => ({ send: () => mockLogout(d) }),
  refresh: () => ({ send: mockRefresh }),
  getCurrentUser: () => ({ send: mockGetCurrentUser }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: () => ({
      setAuth: mockSetAuth,
      setUser: mockSetUser,
      clearAuth: mockClearAuth,
    }),
    setState: mockSetState,
  },
}))

vi.mock('@/utils/auth-token', () => ({
  setAccessToken: mockSetAccessToken,
  setRefreshToken: mockSetRefreshToken,
  clearTokens: mockClearTokens,
  getRefreshToken: mockGetRefreshToken,
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock('@/utils/password-encryption', () => ({
  encryptPassword: (...args: unknown[]) => mockEncryptPassword(...args),
  clearPublicKeyCache: () => mockClearPublicKeyCache(),
}))

describe('auth services', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(document, 'cookie', {
      value: 'goferbot_admin_access_token=test-token',
      writable: true,
    })
  })

  it('loginService validates input', async () => {
    expect((await loginService('', 'x')).success).toBe(false)
    expect((await loginService('a', '')).success).toBe(false)
  })

  it('loginService success sets user', async () => {
    mockLogin.mockResolvedValueOnce({
      user: { id: '1', email: 'a@b.com', roles: [] },
    })
    const r = await loginService('a@b.com', 'x', {
      captchaId: 'cid-1',
      captchaCode: 'ABCD',
    })
    expect(r.success).toBe(true)
    expect(mockLogin).toHaveBeenCalledWith({
      email: 'a@b.com',
      encryptedPassword: expect.any(String),
      captchaId: 'cid-1',
      captchaCode: 'ABCD',
    })
    expect(mockSetUser).toHaveBeenCalled()
  })

  it('loginService handles error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('bad'))
    const r = await loginService('a@b.com', 'x', {
      captchaId: 'cid-1',
      captchaCode: 'ABCD',
    })
    expect(r.success).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('loginService retries on DECRYPT_FAILED', async () => {
    mockLogin.mockRejectedValueOnce({ code: 'DECRYPT_FAILED' })
    mockLogin.mockResolvedValueOnce({ user: { id: '1', email: 'a@b.com', roles: [] } })
    const r = await loginService('a@b.com', 'x', {
      captchaId: 'cid-1',
      captchaCode: 'ABCD',
    })
    expect(r.success).toBe(true)
    expect(mockClearPublicKeyCache).toHaveBeenCalled()
    expect(mockLogin).toHaveBeenCalledTimes(2)
  })

  it('loginService shows auth error on 401', async () => {
    mockLogin.mockRejectedValueOnce({ status: 401, code: 'AUTH_FAIL' })
    const r = await loginService('a@b.com', 'x', {
      captchaId: 'cid-1',
      captchaCode: 'ABCD',
    })
    expect(r.success).toBe(false)
    expect(r.error).toBe('账号或密码错误')
  })

  it('refreshAuth returns false when backend rejects', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('bad'))
    expect(await refreshAuth()).toBe(false)
  })

  it('refreshAuth returns true on success', async () => {
    mockRefresh.mockResolvedValueOnce(undefined)
    expect(await refreshAuth()).toBe(true)
  })

  describe('fetchCurrentUser', () => {
    it('returns true and updates user on success', async () => {
      const mockUser = { id: '1', email: 'a@b.com', roles: ['admin'] }
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const result = await fetchCurrentUser()

      expect(result).toBe(true)
      expect(mockGetCurrentUser).toHaveBeenCalled()
      expect(mockSetUser).toHaveBeenCalledWith(mockUser)
    })

    it('clears auth on 401', async () => {
      mockGetCurrentUser.mockRejectedValueOnce({ status: 401 })

      const result = await fetchCurrentUser()

      expect(result).toBe(false)
      expect(mockGetCurrentUser).toHaveBeenCalled()
      expect(mockClearAuth).toHaveBeenCalled()
    })

    it('sets isInitialized on non-401 failure', async () => {
      mockGetCurrentUser.mockRejectedValueOnce(new Error('network error'))

      const result = await fetchCurrentUser()

      expect(result).toBe(false)
      expect(mockGetCurrentUser).toHaveBeenCalled()
      expect(mockSetState).toHaveBeenCalledWith({ isInitialized: true })
    })

    it('does not call API when no auth cookie', async () => {
      Object.defineProperty(document, 'cookie', {
        value: '',
        writable: true,
      })

      const result = await fetchCurrentUser()

      expect(result).toBe(false)
      expect(mockGetCurrentUser).not.toHaveBeenCalled()
      expect(mockClearAuth).toHaveBeenCalled()
    })

    it('concurrent calls share the same promise', async () => {
      const mockUser = { id: '1', email: 'a@b.com', roles: ['admin'] }
      mockGetCurrentUser.mockResolvedValueOnce(mockUser)

      const [result1, result2] = await Promise.all([fetchCurrentUser(), fetchCurrentUser()])

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1)
    })
  })

  it('logoutService calls API, clears auth, shows success and navigates on success', async () => {
    mockLogout.mockResolvedValueOnce(undefined)
    const originalHref = window.location.href
    await logoutService()
    expect(mockLogout).toHaveBeenCalled()
    expect(mockClearAuth).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith('已退出登录')
    expect(window.location.href).toContain('/login')
    window.location.href = originalHref
  })

  it('logoutService clears auth and navigates even on API failure', async () => {
    mockLogout.mockRejectedValueOnce(new Error('network error'))
    const originalHref = window.location.href
    await logoutService()
    expect(mockLogout).toHaveBeenCalled()
    expect(mockClearAuth).toHaveBeenCalled()
    expect(window.location.href).toContain('/login')
    window.location.href = originalHref
  })

  it('remembered email storage', () => {
    localStorage.clear()
    expect(getRememberedEmail()).toBeNull()
    setRememberedEmail('a@b.com')
    expect(getRememberedEmail()).toBe('a@b.com')
    setRememberedEmail(null)
    expect(getRememberedEmail()).toBeNull()
  })
})