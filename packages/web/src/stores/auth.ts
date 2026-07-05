import type { User } from '@goferbot/data'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { getMe } from '@/api/auth'
import { ROUTES_REGISTER } from '@/router-register'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isInitialized: boolean
  /** 标记 Zustand persist rehydration 是否已完成（不持久化） */
  _hydrated: boolean
  fetchMePromise: Promise<boolean> | null

  setUser: (user: User) => void
  clearAuth: () => void
  setInitialized: (value: boolean) => void
  fetchMe: () => Promise<boolean>
}

const LEGACY_KEYS = ['goferbot-auth', 'goferbot-admin-auth']

function isLegacyUserShape(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const parsed = raw as Record<string, unknown>
  const inner = (parsed.state as Record<string, unknown> | undefined) ?? parsed
  const user = inner?.user
  if (!user || typeof user !== 'object') return false
  // 旧版数据结构中 user.role 为 string 字符串字段
  return 'role' in user && typeof (user as Record<string, unknown>).role === 'string'
}

function purgeLegacyAuthCache() {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key)
      if (raw && isLegacyUserShape(JSON.parse(raw))) {
        localStorage.removeItem(key)
      }
    } catch {
      // JSON 解析失败或 localStorage 不可用时忽略
    }
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      _hydrated: false,
      fetchMePromise: null,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
          isInitialized: true,
        }),

      clearAuth: () => {
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        })
        window.location.href = ROUTES_REGISTER.login.path
      },

      setInitialized: (value: boolean) => set({ isInitialized: value }),

      fetchMe: async () => {
        const existing = get().fetchMePromise
        if (existing) return existing

        const promise = (async (): Promise<boolean> => {
          try {
            const user = await getMe()
            useAuthStore.getState().setUser(user)
            return true
          } catch {
            useAuthStore.setState({ isInitialized: true, fetchMePromise: null })
            return false
          } finally {
            useAuthStore.setState({ fetchMePromise: null })
          }
        })()

        set({ fetchMePromise: promise })
        return promise
      },
    }),
    {
      name: 'goferbot-auth',
      // 仅持久化 user 便于刷新后恢复用户资料；认证凭据由 HttpOnly Cookie 承担
      partialize: (state) => ({ user: state.user }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          purgeLegacyAuthCache()
          state._hydrated = true
        }
      },
    },
  ),
)
