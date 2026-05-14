import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { FakeBackendTransport } from '@goferbot/backend-adapters'
import { setBackend } from '@goferbot/backend-adapters'

describe('useSettingsStore', () => {
  let backend: FakeBackendTransport

  beforeEach(() => {
    setActivePinia(createPinia())
    backend = new FakeBackendTransport()
    setBackend(backend)
  })

  afterEach(() => {
    setBackend(null)
  })

  it('has default config initially', () => {
    const store = useSettingsStore()
    expect(store.config.defaultChatProvider).toBe('deepseek')
    expect(store.config.temperature).toBe(0.7)
    expect(store.config.providers.openai.model).toBe('gpt-4o')
  })

  it('loadConfig fetches from API', async () => {
    backend.when('GET', '/settings').respond(200, { temperature: 1.0, defaultChatProvider: 'openai' })

    const store = useSettingsStore()
    await store.loadConfig()
    expect(store.config.temperature).toBe(1.0)
    expect(store.config.defaultChatProvider).toBe('openai')
  })

  it('saveConfig posts to API and updates local state', async () => {
    backend.when('POST', '/settings').respond(200, { success: true })

    const store = useSettingsStore()
    await store.saveConfig({ temperature: 1.5 })
    expect(store.config.temperature).toBe(1.5)
    expect(backend.wasRequestCalled('POST', '/settings')).toBe(true)
  })

  it('getLLMConfig returns config for given provider', () => {
    const store = useSettingsStore()
    store.config.providers.openai = { apiKey: 'key', model: 'gpt-4', baseUrl: 'https://api.openai.com' }
    const cfg = store.getLLMConfig('openai')
    expect(cfg).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      baseUrl: 'https://api.openai.com',
      apiKey: 'key',
    })
  })

  it('getLLMConfig returns default provider when no arg', () => {
    const store = useSettingsStore()
    const cfg = store.getLLMConfig()
    expect(cfg?.provider).toBe('deepseek')
  })

  it('getLLMConfig returns null for disabled ollama', () => {
    const store = useSettingsStore()
    store.config.providers.ollama.enabled = false
    expect(store.getLLMConfig('ollama')).toBeNull()
  })

  it('getLLMConfig returns ollama config when enabled', () => {
    const store = useSettingsStore()
    store.config.providers.ollama = { enabled: true, url: 'http://localhost:11434', model: 'llama2' }
    const cfg = store.getLLMConfig('ollama')
    expect(cfg).toEqual({
      provider: 'ollama',
      model: 'llama2',
      baseUrl: 'http://localhost:11434',
      apiKey: '',
    })
  })

  it('configuredProviders requires apiKey for cloud providers', () => {
    const store = useSettingsStore()
    store.config.providers.openai = { apiKey: '', model: 'gpt-4', baseUrl: '' }
    store.config.providers.deepseek = { apiKey: 'key', model: 'deepseek-chat', baseUrl: '' }
    store.config.providers.ollama = { enabled: false, url: '', model: '' }

    const list = store.configuredProviders
    expect(list.some((p) => p.key === 'openai')).toBe(false)
    expect(list.some((p) => p.key === 'deepseek')).toBe(true)
    expect(list.some((p) => p.key === 'ollama')).toBe(false)
  })

  it('configuredProviders includes ollama only when enabled', () => {
    const store = useSettingsStore()
    store.config.providers.ollama = { enabled: true, url: 'http://localhost:11434', model: 'llama2' }

    const list = store.configuredProviders
    expect(list.some((p) => p.key === 'ollama')).toBe(true)
  })

  it('saveConfig deep-merges embeddingProvider fields', async () => {
    backend.when('POST', '/settings').respond(200, { success: true })

    const store = useSettingsStore()
    store.config.embeddingProvider = {
      provider: 'openai',
      apiKey: 'old-key',
      model: 'text-embedding-3-small',
      baseUrl: 'https://api.openai.com',
    }

    await store.saveConfig({ embeddingProvider: { provider: 'siliconflow' } as any })

    expect(store.config.embeddingProvider.provider).toBe('siliconflow')
    expect(store.config.embeddingProvider.apiKey).toBe('old-key')
    expect(store.config.embeddingProvider.model).toBe('text-embedding-3-small')
    expect(backend.wasRequestCalled('POST', '/settings')).toBe(true)
  })
})
