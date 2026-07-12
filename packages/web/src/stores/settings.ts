import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  type AppConfig,
  DEFAULT_CONFIG,
  type LLMConfig,
  mergeAppConfig,
  type ProviderConfig,
  getLLMConfig as resolveLLMConfig,
  configuredProviders as resolveProviders,
} from '@/utils/llm-config'
import { alovaInstance } from '@/utils/server'

// 向下兼容 — 类型重导出
export type {
  AppConfig,
  EmbeddingProviderConfig,
  LLMConfig,
  ProviderConfig,
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
  saveConfig: (updates?: Partial<AppConfig>) => Promise<boolean>
  isDirty: () => boolean
  getLLMConfig: (providerKey?: string) => LLMConfig | null
  configuredProviders: () => { key: string; name: string; model: string }[]

  // 自定义模型 CRUD
  addCustomProvider: (key: string, config: ProviderConfig) => void
  updateCustomProvider: (key: string, config: Partial<ProviderConfig>) => void
  removeCustomProvider: (key: string) => void

  // 快捷设置
  setAppearance: (value: 'light' | 'dark' | 'system') => void
  setFontSizeLevel: (value: 1 | 2 | 3 | 4 | 5) => void
  setDefaultChatProvider: (value: string) => void
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
          // 后端 Settings.appearance = { mode, fontSizeLevel }；前端 AppConfig 为扁平字段
          const data = (await alovaInstance.Get<Record<string, unknown>>('/settings').send()) as {
            appearance?:
              | 'light'
              | 'dark'
              | 'system'
              | { mode?: 'light' | 'dark' | 'system'; fontSizeLevel?: number }
            fontSizeLevel?: number
          }
          let appearance: AppConfig['appearance'] = DEFAULT_CONFIG.appearance
          let fontSizeLevel: AppConfig['fontSizeLevel'] = DEFAULT_CONFIG.fontSizeLevel
          if (typeof data.appearance === 'string') {
            appearance = data.appearance
          } else if (data.appearance && typeof data.appearance === 'object') {
            appearance = data.appearance.mode ?? appearance
            if (typeof data.appearance.fontSizeLevel === 'number') {
              fontSizeLevel = data.appearance.fontSizeLevel as AppConfig['fontSizeLevel']
            }
          }
          if (typeof data.fontSizeLevel === 'number') {
            fontSizeLevel = data.fontSizeLevel as AppConfig['fontSizeLevel']
          }
          const userEditable: Partial<AppConfig> = { appearance, fontSizeLevel }
          const merged = mergeAppConfig(DEFAULT_CONFIG, userEditable)
          set({ config: merged, savedConfig: merged, isLoading: false })
        } catch (e) {
          set({ isLoading: false, error: e instanceof Error ? e.message : '加载设置失败' })
        }
      },

      saveConfig: async (updates) => {
        set({ isLoading: true, error: null })
        const body = updates ? mergeAppConfig(get().config, updates) : get().config
        // 后端 appearance 分类契约：{ mode, fontSizeLevel }
        const appearancePayload = {
          mode: body.appearance,
          fontSizeLevel: body.fontSizeLevel,
        }

        try {
          await alovaInstance.Post('/settings/appearance', appearancePayload).send()
          set((s) => ({
            config: {
              ...body,
              providers: s.config.providers,
              defaultChatProvider: s.config.defaultChatProvider,
            },
            savedConfig: {
              ...body,
              providers: s.config.providers,
              defaultChatProvider: s.config.defaultChatProvider,
            },
            isLoading: false,
          }))
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

      addCustomProvider: (key, config) => {
        set((state) => ({
          config: {
            ...state.config,
            providers: { ...state.config.providers, [key]: config },
          },
        }))
      },

      updateCustomProvider: (key, config) => {
        set((state) => ({
          config: {
            ...state.config,
            providers: {
              ...state.config.providers,
              [key]: { ...state.config.providers[key], ...config },
            },
          },
        }))
      },

      removeCustomProvider: (key) => {
        set((state) => {
          const { [key]: _, ...rest } = state.config.providers
          const updates: Partial<AppConfig> = { providers: rest }
          if (state.config.defaultChatProvider === key) {
            // ponytail: 选择第一个已配置的 provider 作为默认值
            const configured = Object.keys(rest).filter((k) => rest[k].apiKey)
            updates.defaultChatProvider = configured[0] || ''
          }
          return { config: { ...state.config, ...updates } }
        })
      },

      setAppearance: (value) => {
        set((state) => ({
          config: { ...state.config, appearance: value },
        }))
      },

      setFontSizeLevel: (value) => {
        set((state) => ({
          config: { ...state.config, fontSizeLevel: value },
        }))
      },

      setDefaultChatProvider: (value) => {
        set((state) => ({
          config: { ...state.config, defaultChatProvider: value },
        }))
      },
    }),
    {
      name: 'goferbot-settings',
      partialize: (state) => ({
        config: state.config,
      }),

      merge: (persisted: unknown, current: SettingsState): SettingsState => {
        const stored = persisted as { config?: Record<string, unknown> } | undefined

        if (!stored?.config) {
          return { ...current, config: { ...DEFAULT_CONFIG } }
        }

        // ponytail: 防止持久化数据污染（如 appearance 被序列化为对象），只提取合法字段
        const sanitized: Partial<AppConfig> = {}
        const validThemes = new Set(['light', 'dark', 'system'])
        const validFontSizes = new Set([1, 2, 3, 4, 5])

        if (
          typeof stored.config.appearance === 'string' &&
          validThemes.has(stored.config.appearance)
        ) {
          sanitized.appearance = stored.config.appearance as 'light' | 'dark' | 'system'
        }
        if (
          typeof stored.config.fontSizeLevel === 'number' &&
          validFontSizes.has(stored.config.fontSizeLevel)
        ) {
          sanitized.fontSizeLevel = stored.config.fontSizeLevel as 1 | 2 | 3 | 4 | 5
        }
        if (typeof stored.config.defaultChatProvider === 'string') {
          sanitized.defaultChatProvider = stored.config.defaultChatProvider
        }

        try {
          const merged = mergeAppConfig(DEFAULT_CONFIG, sanitized)
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
