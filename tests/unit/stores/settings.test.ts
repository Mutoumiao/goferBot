import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import { sidecarFetch } from '@/utils/sidecarClient'

vi.mock('@/utils/sidecarClient')

describe('useSettingsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(sidecarFetch).mockReset()
  })

  it('has default config initially', () => {
    const store = useSettingsStore()
    expect(store.config.defaultChatProvider).toBe('deepseek')
    expect(store.config.temperature).toBe(0.7)
    expect(store.config.providers.openai.model).toBe('gpt-4o')
  })

  it('loadConfig fetches from API', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ temperature: 1.0, defaultChatProvider: 'openai' }),
    } as Response)

    const store = useSettingsStore()
    await store.loadConfig()
    expect(store.config.temperature).toBe(1.0)
    expect(store.config.defaultChatProvider).toBe('openai')
  })

  it('saveConfig posts to API and updates local state', async () => {
    vi.mocked(sidecarFetch).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    } as Response)

    const store = useSettingsStore()
    await store.saveConfig({ temperature: 1.5 })
    expect(store.config.temperature).toBe(1.5)
    expect(sidecarFetch).toHaveBeenCalledWith('/settings', expect.objectContaining({ method: 'POST' }))
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
})
