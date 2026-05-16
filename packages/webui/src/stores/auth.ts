import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { api } from '@/api/client'
import type { AuthResponse, JwtTokens, UserDTO } from '@/api/types'

const ACCESS_TOKEN_KEY = 'goferbot_access_token'
const REFRESH_TOKEN_KEY = 'goferbot_refresh_token'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY))
  const refreshToken = ref<string | null>(localStorage.getItem(REFRESH_TOKEN_KEY))
  const user = ref<UserDTO | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

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

  async function login(credentials: { email: string; password: string }) {
    isLoading.value = true
    error.value = null
    try {
      const res = await api.post<AuthResponse>('/auth/login', credentials)
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken })
      user.value = res.user
      return res
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function register(credentials: { email: string; password: string; name?: string }) {
    isLoading.value = true
    error.value = null
    try {
      const res = await api.post<AuthResponse>('/auth/register', credentials)
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken })
      user.value = res.user
      return res
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
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
      const res = await api.post<JwtTokens>('/auth/refresh', {
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
        await api.post('/auth/logout', {})
      }
    } finally {
      clearTokens()
    }
  }

  async function fetchMe() {
    if (!accessToken.value) return null
    try {
      const res = await api.get<{ data: UserDTO }>('/auth/me')
      user.value = res.data
      return res.data
    } catch (e) {
      clearTokens()
      throw e
    }
  }

  function init() {
    const savedAccess = localStorage.getItem(ACCESS_TOKEN_KEY)
    const savedRefresh = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (savedAccess && savedRefresh) {
      accessToken.value = savedAccess
      refreshToken.value = savedRefresh
      fetchMe().catch(() => {
        // 静默处理，fetchMe 会清除无效 token
      })
    }
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoading,
    error,
    isAuthenticated,
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
