import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type AppConfig,
  type LLMConfig,
  DEFAULT_CONFIG,
  getLLMConfig as resolveLLMConfig,
  configuredProviders as resolveProviders,
  mergeAppConfig,
} from '@/utils/llm-config'

// 向下兼容 — 类型重导出
export type {
  ChatProviderConfig,
  OllamaConfig,
  EmbeddingProviderConfig,
  AppConfig,
  LLMConfig,
} from '@/utils/llm-config'
export { DEFAULT_CONFIG } from '@/utils/llm-config'

// ---- Store 接口 ----
interface SettingsState {
  config: AppConfig
  savedConfig: AppConfig
  isLoading: boolean
  error: string | null

  updateConfig: (updates: Partial<AppConfig>) => void
  resetToSaved: () => void
  clearError: () => void
  loadConfig: () => Promise<void>
  saveConfig: (updates: Partial<AppConfig>) => Promise<boolean>
  isDirty: () => boolean
  getLLMConfig: (providerKey?: string) => LLMConfig | null
  configuredProviders: () => { key: string; name: string; model: string }[]
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_CONFIG },
      savedConfig: { ...DEFAULT_CONFIG },
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      updateConfig: (updates) => {
        set({ config: mergeAppConfig(get().config, updates) })
      },

      resetToSaved: () => {
        const { savedConfig } = get()
        set({ config: { ...savedConfig } })
      },

      isDirty: () => {
        const { config, savedConfig } = get()
        return JSON.stringify(config) !== JSON.stringify(savedConfig)
      },

      loadConfig: async () => {
        set({ isLoading: true, error: null })
        try {
          const res = await fetch('/api/settings', {
            headers: { 'Content-Type': 'application/json' },
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const json = await res.json()
          const serverConfig = json.data ?? json

          const merged = mergeAppConfig(DEFAULT_CONFIG, serverConfig)
          set({ config: merged, savedConfig: merged, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      saveConfig: async (updates) => {
        set({ isLoading: true, error: null })
        const body = mergeAppConfig(get().config, updates)

        try {
          const res = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)

          set({ config: body, savedConfig: body, isLoading: false })
          return true
        } catch (e) {
          set({
            error: e instanceof Error ? e.message : '保存失败',
            isLoading: false,
          })
          return false
        }
      },

      getLLMConfig: (providerKey?) => {
        return resolveLLMConfig(get().config, providerKey)
      },

      configuredProviders: () => {
        return resolveProviders(get().config)
      },
    }),
    {
      name: 'goferbot-settings',
      partialize: (state) => ({
        config: state.config,
      }),

      merge: (persisted: unknown, current: SettingsState): SettingsState => {
        const stored = persisted as { config?: Partial<AppConfig> } | undefined

        if (!stored?.config) {
          return { ...current, config: { ...DEFAULT_CONFIG } }
        }

        try {
          const merged = mergeAppConfig(DEFAULT_CONFIG, stored.config)
          return { ...current, config: merged, savedConfig: merged }
        } catch {
          return { ...current, config: { ...DEFAULT_CONFIG }, savedConfig: { ...DEFAULT_CONFIG } }
        }
      },

      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            state.savedConfig = state.config
          }
        }
      },
    },
  ),
)
