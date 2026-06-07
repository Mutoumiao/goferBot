import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@goferbot/data'

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean

  setAuth: (token: string, user: User) => void
  clearAuth: () => void
  setUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (token: string, user: User) =>
        set({
          token,
          user,
          isAuthenticated: true,
        }),

      clearAuth: () => {
        localStorage.removeItem('goferbot_access_token')
        set({
          token: null,
          user: null,
          isAuthenticated: false,
        })
      },

      setUser: (user: User) => set({ user }),
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
