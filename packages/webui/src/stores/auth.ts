import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import { encryptPassword, clearPublicKeyCache } from '@/utils/password-encryption'
import type { AuthResponse, JwtTokens, UserDTO } from '@/api/types'

function mapAuthError(e: unknown): string {
  if (e && typeof e === 'object' && 'code' in e) {
    const code = (e as { code: string }).code
    const msg = (e as { message?: string }).message
    switch (code) {
      case 'USER_EXISTS':
        return '该邮箱已被注册'
      case 'AUTH_FAIL':
        return '邮箱或密码错误'
      case 'INVALID_REFRESH_TOKEN':
        return '登录已过期，请重新登录'
      case 'USER_NOT_FOUND':
        return '用户不存在'
      case 'DECRYPT_FAILED':
        return '加密密钥已过期，请重试'
      default:
        return msg || '操作失败，请稍后重试'
    }
  }
  if (e instanceof Error) {
    return e.message
  }
  return '操作失败，请稍后重试'
}

const ACCESS_TOKEN_KEY = 'goferbot_access_token'
const REFRESH_TOKEN_KEY = 'goferbot_refresh_token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY))
  const user = ref<UserDTO | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isInitialized = ref(false)

  const isAuthenticated = computed(() => !!accessToken.value)

  function setTokens(tokens: JwtTokens) {
    accessToken.value = tokens.accessToken
    refreshToken.value = tokens.refreshToken
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
  }

  function clearTokens() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  async function login(credentials: { email: string; password: string }, isRetry = false) {
    isLoading.value = true
    error.value = null
    try {
      const encryptedPassword = await encryptPassword(credentials.password)
      const res = await api.post<AuthResponse>('/api/auth/login', {
        email: credentials.email,
        encryptedPassword,
      })
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken })
      user.value = res.user
      return res
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'DECRYPT_FAILED' && !isRetry) {
        clearPublicKeyCache()
        return login(credentials, true)
      }
      error.value = mapAuthError(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function register(credentials: { email: string; password: string; name?: string }, isRetry = false) {
    isLoading.value = true
    error.value = null
    try {
      const encryptedPassword = await encryptPassword(credentials.password)
      const res = await api.post<AuthResponse>('/api/auth/register', {
        email: credentials.email,
        encryptedPassword,
        name: credentials.name,
      })
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken })
      user.value = res.user
      return res
    } catch (e) {
      const code = (e as { code?: string }).code
      if (code === 'DECRYPT_FAILED' && !isRetry) {
        clearPublicKeyCache()
        return register(credentials, true)
      }
      error.value = mapAuthError(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function refresh() {
    const currentRefreshToken = refreshToken.value
    if (!currentRefreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const res = await api.post<JwtTokens>('/api/auth/refresh', {
        refreshToken: currentRefreshToken,
      })
      setTokens(res)
      return res
    } catch (e) {
      clearTokens()
      throw e
    }
  }

  async function logout() {
    try {
      if (accessToken.value) {
        await api.post('/api/auth/logout', {})
      }
    } finally {
      clearTokens()
    }
  }

  async function fetchMe() {
    if (!accessToken.value) return null
    try {
      const res = await api.get<{ data: UserDTO }>('/api/auth/me')
      user.value = res.data
      return res.data
    } catch (e) {
      clearTokens()
      throw e
    }
  }

  async function init() {
    const savedAccess = localStorage.getItem(ACCESS_TOKEN_KEY)
    const savedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (savedAccess && savedRefresh) {
      accessToken.value = savedAccess
      refreshToken.value = savedRefresh
      try {
        await fetchMe()
      } catch {
        // fetchMe 失败时已调用 clearTokens()
      }
    }
    isInitialized.value = true
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoading,
    error,
    isAuthenticated,
    isInitialized,
    login,
    register,
    refresh,
    logout,
    fetchMe,
    init,
    setTokens,
    clearTokens,
  }
})
