import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROUTES_REGISTER } from '@/router-register'
import { clearTokens, getAccessToken } from '@/utils/auth-token'

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
  token: string | null
  isAuthenticated: boolean
  isInitialized: boolean
  _hydrated: boolean

  setAuth: (token: string, user: AdminUser) => void
  clearAuth: () => void
  setUser: (user: AdminUser) => void
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

      setAuth: (token, user) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      clearAuth: () => {
        clearTokens()
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        })
        window.location.href = ROUTES_REGISTER.login.path
      },

      setUser: (user) => set({ user }),
      setInitialized: (value) => set({ isInitialized: value }),
    }),
    {
      name: 'goferbot-admin-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          const rawToken = getAccessToken()
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
