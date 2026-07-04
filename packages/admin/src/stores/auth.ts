import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { ROUTES_REGISTER } from '@/router-register'

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
          isInitialized: true,
        }),

      clearAuth: () => {
        localStorage.removeItem('goferbot-admin-auth')
        set({
          user: null,
          isAuthenticated: false,
          isInitialized: false,
        })
      },

      setInitialized: (value: boolean) => set({ isInitialized: value }),
    }),
    {
      name: 'goferbot-admin-auth',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => {
        return (state) => {
          if (!state) return
          state._hydrated = true
          if (state.isAuthenticated && state.user) {
            useAuthStore.setState({ isInitialized: true })
          }
        }
      },
    },
  ),
)
