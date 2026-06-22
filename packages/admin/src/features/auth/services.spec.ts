import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  loginService,
  refreshAuth,
  fetchCurrentUser,
  logoutService,
  changePasswordService,
  getRememberedEmail,
  setRememberedEmail,
  hasRefreshToken,
} from '@/features/auth/services'
import { toast } from 'sonner'

const {
  mockLogin,
  mockRefresh,
  mockGetCurrentUser,
  mockChangePassword,
  mockSetAccessToken,
  mockSetRefreshToken,
  mockClearTokens,
  mockGetRefreshToken,
  mockSetAuth,
  mockSetUser,
  mockClearAuth,
} = vi.hoisted(() => ({
  mockLogin: vi.fn(),
  mockRefresh: vi.fn(),
  mockGetCurrentUser: vi.fn(),
  mockChangePassword: vi.fn(),
  mockSetAccessToken: vi.fn(),
  mockSetRefreshToken: vi.fn(),
  mockClearTokens: vi.fn(),
  mockGetRefreshToken: vi.fn(),
  mockSetAuth: vi.fn(),
  mockSetUser: vi.fn(),
  mockClearAuth: vi.fn(),
}))

vi.mock('@/api/auth', () => ({
  login: (d: unknown) => ({ send: () => mockLogin(d) }),
  refresh: () => ({ send: mockRefresh }),
  getCurrentUser: () => ({ send: mockGetCurrentUser }),
  changePassword: (d: unknown) => ({ send: () => mockChangePassword(d) }),
}))

vi.mock('@/stores/auth', () => ({
  useAuthStore: {
    getState: () => ({
      setAuth: mockSetAuth,
      setUser: mockSetUser,
      clearAuth: mockClearAuth,
    }),
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

describe('auth services', () => {
  beforeEach(() => vi.clearAllMocks())

  it('loginService validates input', async () => {
    expect((await loginService('', 'x')).success).toBe(false)
    expect((await loginService('a', '')).success).toBe(false)
  })

  it('loginService success sets token and auth', async () => {
    mockLogin.mockResolvedValueOnce({
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: '1', email: 'a@b.com', roles: [] },
    })
    const r = await loginService('a@b.com', 'x')
    expect(r.success).toBe(true)
    expect(mockSetAccessToken).toHaveBeenCalledWith('at')
    expect(mockSetRefreshToken).toHaveBeenCalledWith('rt')
    expect(mockSetAuth).toHaveBeenCalled()
  })

  it('loginService handles error', async () => {
    mockLogin.mockRejectedValueOnce(new Error('bad'))
    const r = await loginService('a@b.com', 'x')
    expect(r.success).toBe(false)
    expect(r.error).toBeTruthy()
  })

  it('refreshAuth returns false on error', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('bad'))
    expect(await refreshAuth()).toBe(false)
  })

  it('fetchCurrentUser clears auth on 401', async () => {
    mockGetCurrentUser.mockRejectedValueOnce({ status: 401 })
    expect(await fetchCurrentUser()).toBe(false)
    expect(mockClearAuth).toHaveBeenCalled()
  })

  it('logoutService clears tokens', () => {
    logoutService()
    expect(mockClearTokens).toHaveBeenCalled()
    expect(mockClearAuth).toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalled()
  })

  it('changePasswordService succeeds', async () => {
    mockChangePassword.mockResolvedValueOnce(undefined)
    const r = await changePasswordService('o', 'n')
    expect(r.success).toBe(true)
    expect(toast.success).toHaveBeenCalled()
  })

  it('remembered email storage', () => {
    localStorage.clear()
    expect(getRememberedEmail()).toBeNull()
    setRememberedEmail('a@b.com')
    expect(getRememberedEmail()).toBe('a@b.com')
    setRememberedEmail(null)
    expect(getRememberedEmail()).toBeNull()
  })

  it('hasRefreshToken checks storage', () => {
    mockGetRefreshToken.mockReturnValue('rt')
    expect(hasRefreshToken()).toBe(true)
    mockGetRefreshToken.mockReturnValue(null)
    expect(hasRefreshToken()).toBe(false)
  })
})
