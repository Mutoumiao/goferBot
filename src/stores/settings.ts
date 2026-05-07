import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { LLMConfig } from '@/types'

const STORAGE_KEY = 'kb_chat_config'

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com',
  apiKey: '',
}

function loadConfig(): LLMConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_CONFIG }
}

export const useSettingsStore = defineStore('settings', () => {
  const llmConfig = ref<LLMConfig>(loadConfig())

  function saveConfig(config: Partial<LLMConfig>) {
    llmConfig.value = { ...llmConfig.value, ...config }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(llmConfig.value))
  }

  return {
    llmConfig,
    saveConfig,
  }
})
