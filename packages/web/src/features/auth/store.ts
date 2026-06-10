import { create } from 'zustand'

export type AuthTab = 'login' | 'register'

interface AuthPageState {
  tab: AuthTab
  rememberEmail: string | null

  setTab: (tab: AuthTab) => void
  setRememberEmail: (email: string | null) => void
}

export const useAuthPageStore = create<AuthPageState>((set) => ({
  tab: 'login',
  rememberEmail: null,

  setTab: (tab) => set({ tab }),
  setRememberEmail: (email) => set({ rememberEmail: email }),
}))
