import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type AppearanceMode = 'light' | 'dark' | 'system'

interface SettingsState {
  appearance: AppearanceMode
  setAppearance: (v: AppearanceMode) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appearance: 'light',
      setAppearance: (v) => set({ appearance: v }),
    }),
    {
      name: 'goferbot-admin-settings',
      partialize: (state) => ({
        appearance: state.appearance,
      }),
    },
  ),
)
