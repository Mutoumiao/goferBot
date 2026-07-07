import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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

const LEGACY_KEYS = ['goferbot-admin-auth', 'goferbot-auth']

function isLegacyUserShape(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false
  const parsed = raw as Record<string, unknown>
  const inner = (parsed.state as Record<string, unknown> | undefined) ?? parsed
  const user = inner?.user
  if (!user || typeof user !== 'object') return false
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
    }
  }
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
          isInitialized: true,
        })
      },

      setInitialized: (value: boolean) => set({ isInitialized: value }),
    }),
    {
      name: 'goferbot-admin-auth',
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