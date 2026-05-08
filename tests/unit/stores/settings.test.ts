import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('has default config initially', () => {
    const store = useSettingsStore()
    expect(store.llmConfig.provider).toBe('deepseek')
    expect(store.llmConfig.model).toBe('deepseek-chat')
    expect(store.llmConfig.baseUrl).toBe('https://api.deepseek.com')
  })

  it('loads config from localStorage', async () => {
    localStorage.setItem('kb_chat_config', JSON.stringify({ provider: 'openai', model: 'gpt-4' }))

    // Re-import to trigger loadConfig
    vi.resetModules()
    const { useSettingsStore: freshStore } = await import('@/stores/settings')
    setActivePinia(createPinia())
    const store = freshStore()
    expect(store.llmConfig.provider).toBe('openai')
    expect(store.llmConfig.model).toBe('gpt-4')
    expect(store.llmConfig.baseUrl).toBe('https://api.deepseek.com') // default preserved
  })

  it('falls back to defaults on parse error', async () => {
    localStorage.setItem('kb_chat_config', 'not-json')

    vi.resetModules()
    const { useSettingsStore: freshStore } = await import('@/stores/settings')
    setActivePinia(createPinia())
    const store = freshStore()
    expect(store.llmConfig.provider).toBe('deepseek')
  })

  it('saveConfig merges and persists to localStorage', () => {
    const store = useSettingsStore()
    store.saveConfig({ apiKey: 'secret-key' })

    expect(store.llmConfig.apiKey).toBe('secret-key')
    expect(store.llmConfig.provider).toBe('deepseek') // unchanged

    const raw = localStorage.getItem('kb_chat_config')
    const saved = JSON.parse(raw!)
    expect(saved.apiKey).toBe('secret-key')
  })
})
