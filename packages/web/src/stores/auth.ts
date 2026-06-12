import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@goferbot/data'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isInitialized: boolean
  /** 标记 Zustand persist rehydration 是否已完成（不持久化） */
  _hydrated: boolean

  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  setUser: (user: User) => void
  setInitialized: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isInitialized: false,
      _hydrated: false,

      setAuth: (token: string, user: User) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      clearAuth: () => {
        localStorage.removeItem('goferbot_access_token')
        localStorage.removeItem('goferbot_refresh_token')
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        })
      },

      setUser: (user: User) => set({ user }),
      setInitialized: (value: boolean) => set({ isInitialized: value }),
    }),
    {
      name: 'goferbot-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      /** rehydrate 后同步 raw localStorage + 标记 hydration 完成 */
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          const rawToken = localStorage.getItem('goferbot_access_token')
          // raw localStorage 无 token → 登录态已被清理，同步清除 Zustand 持久化数据
          if (!rawToken && state.token) {
            state.token = null
            state.isAuthenticated = false
          }
          state._hydrated = true
        }
      },
    },
  ),
)
