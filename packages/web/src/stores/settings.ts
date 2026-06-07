import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ---- 类型定义 ----
export interface ChatProviderConfig {
  apiKey: string
  model: string
  baseUrl: string
}

export interface OllamaConfig {
  enabled: boolean
  url: string
  model: string
}

export interface EmbeddingProviderConfig {
  provider: string
  apiKey: string
  model: string
  baseUrl: string
}

export interface AppConfig {
  providers: {
    openai: ChatProviderConfig
    claude: ChatProviderConfig
    deepseek: ChatProviderConfig
    custom: ChatProviderConfig
    ollama: OllamaConfig
  }
  embeddingProvider: EmbeddingProviderConfig
  temperature: number
  defaultChatProvider: string
}

export interface LLMConfig {
  provider: string
  model: string
  baseUrl: string
  apiKey: string
}

// ---- 默认配置 ----
export const DEFAULT_CONFIG: AppConfig = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: {
    provider: 'openai',
    apiKey: '',
    model: 'text-embedding-3-small',
    baseUrl: '',
  },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

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

      updateConfig: (updates: Partial<AppConfig>) => {
        const { config } = get()
        const newConfig: AppConfig = {
          ...config,
          ...updates,
          providers: updates.providers
            ? { ...config.providers, ...updates.providers }
            : config.providers,
          embeddingProvider: updates.embeddingProvider
            ? { ...config.embeddingProvider, ...updates.embeddingProvider }
            : config.embeddingProvider,
        }
        set({ config: newConfig })
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

          const merged: AppConfig = {
            ...DEFAULT_CONFIG,
            ...serverConfig,
            providers: {
              ...DEFAULT_CONFIG.providers,
              ...(serverConfig.providers || {}),
            },
            embeddingProvider: serverConfig.embeddingProvider
              ? { ...DEFAULT_CONFIG.embeddingProvider, ...serverConfig.embeddingProvider }
              : DEFAULT_CONFIG.embeddingProvider,
          }
          set({ config: merged, savedConfig: merged, isLoading: false })
        } catch {
          set({ isLoading: false })
        }
      },

      saveConfig: async (updates: Partial<AppConfig>) => {
        set({ isLoading: true, error: null })
        const { config } = get()
        const body: AppConfig = {
          ...config,
          ...updates,
          providers: updates.providers
            ? { ...config.providers, ...updates.providers }
            : config.providers,
          embeddingProvider: updates.embeddingProvider
            ? { ...config.embeddingProvider, ...updates.embeddingProvider }
            : config.embeddingProvider,
        }

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

      getLLMConfig: (providerKey?: string): LLMConfig | null => {
        const { config } = get()
        const key = providerKey || config.defaultChatProvider

        const providers = config.providers as Record<string, ChatProviderConfig | OllamaConfig>
        const pc = providers[key]
        if (!pc) return null

        if (key === 'ollama') {
          const oc = pc as OllamaConfig
          if (!oc.enabled) return null
          return {
            provider: 'ollama',
            model: oc.model,
            baseUrl: oc.url,
            apiKey: '',
          }
        }

        const cc = pc as ChatProviderConfig
        return {
          provider: key,
          model: cc.model,
          baseUrl: cc.baseUrl,
          apiKey: cc.apiKey,
        }
      },

      configuredProviders: (): { key: string; name: string; model: string }[] => {
        const { config } = get()
        const list: { key: string; name: string; model: string }[] = []

        const names: Record<string, string> = {
          openai: 'OpenAI',
          claude: 'Claude',
          deepseek: 'DeepSeek',
          custom: '自定义',
          ollama: 'Ollama',
        }

        for (const [key, p] of Object.entries(config.providers)) {
          if (key === 'ollama') {
            if ((p as OllamaConfig).enabled) {
              list.push({ key, name: names[key] || key, model: (p as OllamaConfig).model })
            }
          } else {
            if ((p as ChatProviderConfig).apiKey) {
              list.push({ key, name: names[key] || key, model: (p as ChatProviderConfig).model })
            }
          }
        }

        return list
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
          const merged: AppConfig = {
            ...DEFAULT_CONFIG,
            ...stored.config,
            providers: {
              ...DEFAULT_CONFIG.providers,
              ...(stored.config.providers || {}),
            },
            embeddingProvider: stored.config.embeddingProvider
              ? { ...DEFAULT_CONFIG.embeddingProvider, ...stored.config.embeddingProvider }
              : DEFAULT_CONFIG.embeddingProvider,
          }
          return {
            ...current,
            config: merged,
            savedConfig: merged,
          }
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
