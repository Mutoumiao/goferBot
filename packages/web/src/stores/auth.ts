import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@goferbot/data'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isInitialized: boolean

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
    },
  ),
)
