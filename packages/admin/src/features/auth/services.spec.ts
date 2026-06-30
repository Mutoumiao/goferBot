import { toast } from 'sonner'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchCurrentUser,
  getRememberedEmail,
  hasRefreshToken,
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
      password: 'x',
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

  it('refreshAuth returns false when backend rejects', async () => {
    mockRefresh.mockRejectedValueOnce(new Error('bad'))
    expect(await refreshAuth()).toBe(false)
  })

  it('refreshAuth returns true on success', async () => {
    mockRefresh.mockResolvedValueOnce(undefined)
    expect(await refreshAuth()).toBe(true)
  })

  it('fetchCurrentUser clears auth on 401', async () => {
    mockGetCurrentUser.mockRejectedValueOnce({ status: 401 })
    expect(await fetchCurrentUser()).toBe(false)
    expect(mockClearAuth).toHaveBeenCalled()
  })

  it('logoutService clears tokens and shows success toast', async () => {
    mockLogout.mockResolvedValueOnce(undefined)
    await logoutService()
    expect(mockClearAuth).toHaveBeenCalled()
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

  it('hasRefreshToken always returns false (refresh token moved to HttpOnly Cookie)', () => {
    // Refresh token is now managed via HttpOnly cookies, hasRefreshToken is kept for backward compatibility
    expect(hasRefreshToken()).toBe(false)
  })
})
