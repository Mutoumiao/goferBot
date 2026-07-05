import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getCurrentUser } from '@/api/auth'

export type AdminRoleCode = 'super_admin' | 'admin' | 'user'

export interface AdminUser {
  id: string
  email: string
  name?: string
  avatarUrl?: string | null
  isActive: boolean
  roles: AdminRoleCode[]
  permissions?: string[]
  createdAt?: string
  updatedAt?: string
}

interface AuthState {
  user: AdminUser | null
  isAuthenticated: boolean
  isInitialized: boolean
  _hydrated: boolean
  fetchMePromise: Promise<boolean> | null

  setUser: (user: AdminUser) => void
  clearAuth: () => void
  setInitialized: (value: boolean) => void
  fetchMe: () => Promise<boolean>
}

const LEGACY_KEYS = ['goferbot-admin-auth', 'goferbot-auth']

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
        localStorage.removeItem('goferbot-admin-auth')
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: true,
        })
      },

      setInitialized: (value: boolean) => set({ isInitialized: value }),

      fetchMe: async () => {
        const existing = get().fetchMePromise
        if (existing) return existing

        const promise = (async (): Promise<boolean> => {
          try {
            const response = await getCurrentUser().send()
            const user = { ...response, avatarUrl: (response as any).avatar } as AdminUser
            useAuthStore.getState().setUser(user)
            return true
          } catch {
            useAuthStore.getState().clearAuth()
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
      name: 'goferbot-admin-auth',
      // 仅持久化 user 作为 hydration 缓存，认证状态以 /auth/me 为唯一信任源
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
