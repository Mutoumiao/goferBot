import { useSettingsStore } from '@/stores/settings'
import type { ProviderConfig } from '@/utils/llm-config'
import { generateCustomProviderKey } from './types'

export function useSettingsServices() {
  const store = useSettingsStore()

  return {
    config: store.config,
    isLoading: store.isLoading,
    error: store.error,

    addCustomProvider: (data: ProviderConfig) => {
      const key = generateCustomProviderKey()
      store.addCustomProvider(key, data)
      store.saveConfig()
    },

    updateCustomProvider: (key: string, data: Partial<ProviderConfig>) => {
      store.updateCustomProvider(key, data)
      store.saveConfig()
    },

    removeCustomProvider: (key: string) => {
      store.removeCustomProvider(key)
      store.saveConfig()
    },

    saveAppearance: (value: 'light' | 'dark' | 'system') => {
      store.setAppearance(value)
      store.saveConfig()
    },

    saveFontSizeLevel: (value: 1 | 2 | 3 | 4 | 5) => {
      store.setFontSizeLevel(value)
      store.saveConfig()
    },

    saveDefaultProvider: (value: string) => {
      store.setDefaultChatProvider(value)
      store.saveConfig()
    },

    loadSettings: store.loadConfig,
  }
}
