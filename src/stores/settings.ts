import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { sidecarFetch } from '@/utils/sidecarClient'
import type { AppConfig, LLMConfig, ChatProviderConfig, OllamaConfig } from '@/types'

const DEFAULT_CONFIG: AppConfig = {
  providers: {
    openai: { apiKey: '', model: 'gpt-4o', baseUrl: '' },
    claude: { apiKey: '', model: 'claude-3-5-sonnet-20241022', baseUrl: '' },
    deepseek: { apiKey: '', model: 'deepseek-chat', baseUrl: '' },
    custom: { apiKey: '', model: '', baseUrl: '' },
    ollama: { enabled: false, url: 'http://localhost:11434', model: '' },
  },
  embeddingProvider: { provider: 'openai', apiKey: '', model: 'text-embedding-3-small', baseUrl: '' },
  temperature: 0.7,
  defaultChatProvider: 'deepseek',
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
  const isLoading = ref(false)

  async function loadConfig() {
    isLoading.value = true
    try {
      const res = await sidecarFetch('/settings')
      if (res.ok) {
        const data = await res.json()
        config.value = { ...DEFAULT_CONFIG, ...data, providers: { ...DEFAULT_CONFIG.providers, ...data.providers } }
      }
    } finally {
      isLoading.value = false
    }
  }

  async function saveConfig(updates: Partial<AppConfig>) {
    const newConfig = {
      ...config.value,
      ...updates,
      providers: updates.providers ? { ...config.value.providers, ...updates.providers } : config.value.providers,
      embeddingProvider: updates.embeddingProvider
        ? { ...config.value.embeddingProvider, ...updates.embeddingProvider }
        : config.value.embeddingProvider,
    } as AppConfig
    const res = await sidecarFetch('/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig),
    })
    if (res.ok) {
      config.value = newConfig
    }
  }

  function getLLMConfig(providerKey?: string): LLMConfig | null {
    const key = providerKey || config.value.defaultChatProvider
    const pc = config.value.providers[key as keyof AppConfig['providers']]
    if (!pc) return null

    if (key === 'ollama') {
      const oc = config.value.providers.ollama
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
  }

  const configuredProviders = computed(() => {
    const list: { key: string; name: string; model: string }[] = []
    const names: Record<string, string> = {
      openai: 'OpenAI',
      claude: 'Claude',
      deepseek: 'DeepSeek',
      custom: '自定义',
      ollama: 'Ollama',
    }
    for (const [key, p] of Object.entries(config.value.providers)) {
      if (key === 'ollama') {
        if ((p as OllamaConfig).enabled) {
          list.push({ key, name: names[key] || key, model: (p as OllamaConfig).model })
        }
      } else if ((p as ChatProviderConfig).apiKey) {
        list.push({ key, name: names[key] || key, model: (p as ChatProviderConfig).model })
      }
    }
    return list
  })

  return {
    config,
    isLoading,
    loadConfig,
    saveConfig,
    getLLMConfig,
    configuredProviders,
  }
})
