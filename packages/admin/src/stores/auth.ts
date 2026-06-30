import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROUTES_REGISTER } from '@/router-register'

export type AdminRole = 'ADMIN' | 'USER'

export interface AdminUser {
  id: string
  email: string
  name?: string
  role: AdminRole
  avatarUrl?: string | null
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

interface AuthState {
  user: AdminUser | null
  isAuthenticated: boolean
  isInitialized: boolean
  _hydrated: boolean

  setUser: (user: AdminUser) => void
  clearAuth: () => void
  setInitialized: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isInitialized: false,
      _hydrated: false,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: true,
        }),

      clearAuth: () => {
        set({
          user: null,
          isAuthenticated: false,
        })
        window.location.href = ROUTES_REGISTER.login.path
      },

      setInitialized: (value: boolean) => set({ isInitialized: value }),
    }),
    {
      name: 'goferbot-admin-auth',
      // ponytail: 仅持久化 user 便于刷新后恢复；认证凭据由 HttpOnly Cookie 承担
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          state._hydrated = true
        }
      },
    },
  ),
)
