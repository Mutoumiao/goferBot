import { describe, it, expect, beforeEach, vi } from 'vitest'

const DEFAULT_CONFIG = {
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

// 每个 top-level describe 前重置模块，避免 persist hydrate 跨测试污染
describe('SettingsStore — 基础结构（任务 1）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-01: store 导出 useSettingsStore', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    expect(useSettingsStore).toBeDefined()
    expect(typeof useSettingsStore.getState).toBe('function')
  })

  it('AC-01: 初始化时 config 等于 DEFAULT_CONFIG', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    const { config } = useSettingsStore.getState()
    expect(config.providers.openai.model).toBe('gpt-4o')
    expect(config.providers.claude.model).toBe('claude-3-5-sonnet-20241022')
    expect(config.providers.deepseek.model).toBe('deepseek-chat')
    expect(config.providers.ollama.enabled).toBe(false)
    expect(config.temperature).toBe(0.7)
    expect(config.defaultChatProvider).toBe('deepseek')
  })

  it('AC-01: 初始化时 savedConfig 等于 config（DEFAULT_CONFIG）', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    const { config, savedConfig } = useSettingsStore.getState()
    expect(JSON.stringify(config)).toBe(JSON.stringify(savedConfig))
  })

  it('AC-02: persist 配置 name 为 goferbot-settings', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    useSettingsStore.getState().updateConfig({ temperature: 0.8 })

    const stored = localStorage.getItem('goferbot-settings')
    expect(stored).toBeTruthy()
    const parsed = JSON.parse(stored!)
    expect(parsed.state.config.temperature).toBe(0.8)
  })

  it('AC-01: persist 仅持久化 config 字段，不持久化 savedConfig/isLoading/error', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    useSettingsStore.getState().updateConfig({ temperature: 0.5 })

    const stored = localStorage.getItem('goferbot-settings')
    const parsed = JSON.parse(stored!)
    expect(parsed.state).toHaveProperty('config')
    expect(parsed.state).not.toHaveProperty('savedConfig')
    expect(parsed.state).not.toHaveProperty('isLoading')
    expect(parsed.state).not.toHaveProperty('error')
  })
})

describe('SettingsStore — Dirty 追踪（任务 2）', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-03: updateConfig 更新 config，不修改 savedConfig', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    const { updateConfig } = useSettingsStore.getState()
    const oldSavedConfig = useSettingsStore.getState().savedConfig

    updateConfig({ temperature: 0.3 })

    const { config, savedConfig } = useSettingsStore.getState()
    expect(config.temperature).toBe(0.3)
    expect(savedConfig).toEqual(oldSavedConfig)
    expect(savedConfig.temperature).toBe(0.7) // DEFAULT 不变
  })

  it('AC-04: 初始状态 isDirty() === false', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    expect(useSettingsStore.getState().isDirty()).toBe(false)
  })

  it('AC-04: updateConfig 后 isDirty() === true', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    useSettingsStore.getState().updateConfig({ temperature: 0.5 })
    expect(useSettingsStore.getState().isDirty()).toBe(true)
  })

  it('AC-04: updateConfig({}) 空对象不改变 isDirty', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    useSettingsStore.getState().updateConfig({})
    expect(useSettingsStore.getState().isDirty()).toBe(false)
  })

  it('AC-04: 嵌套 provider 字段变更 isDirty() === true', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    const state = useSettingsStore.getState()
    state.updateConfig({
      providers: {
        ...state.config.providers,
        openai: { ...state.config.providers.openai, apiKey: 'sk-xxx' },
      },
    })
    expect(useSettingsStore.getState().isDirty()).toBe(true)
  })

  it('AC-05: resetToSaved 将 config 重置为 savedConfig', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    const { updateConfig, resetToSaved } = useSettingsStore.getState()

    updateConfig({ temperature: 0.1 })
    expect(useSettingsStore.getState().isDirty()).toBe(true)

    resetToSaved()

    const { config, savedConfig } = useSettingsStore.getState()
    expect(config.temperature).toBe(0.7)
    expect(config).toEqual(savedConfig)
    expect(useSettingsStore.getState().isDirty()).toBe(false)
  })

  it('AC-05: resetToSaved 在未修改状态下调用无副作用', async () => {
    const { useSettingsStore } = await import('@/stores/settings')
    const { resetToSaved } = useSettingsStore.getState()
    const before = useSettingsStore.getState().config

    resetToSaved()

    expect(useSettingsStore.getState().config).toEqual(before)
    expect(useSettingsStore.getState().isDirty()).toBe(false)
  })
})

describe('SettingsStore — 异步 actions（任务 3）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    vi.restoreAllMocks()
  })

  describe('saveConfig', () => {
    it('AC-06: saveConfig 成功 → savedConfig 同步 + isDirty=false + isLoading 恢复', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: {} }), { status: 200 }),
      )

      const { updateConfig, saveConfig } = useSettingsStore.getState()
      updateConfig({ temperature: 0.2 })

      const result = await saveConfig({ temperature: 0.2 })

      expect(result).toBe(true)
      const state = useSettingsStore.getState()
      expect(state.isDirty()).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.savedConfig.temperature).toBe(0.2)
      expect(state.config.temperature).toBe(0.2)
      fetchSpy.mockRestore()
    })

    it('AC-06: saveConfig 失败 → config 保留修改 + isDirty=true + error 设置', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      )

      const { updateConfig, saveConfig } = useSettingsStore.getState()
      updateConfig({ temperature: 0.2 })

      const result = await saveConfig({ temperature: 0.2 })

      expect(result).toBe(false)
      const state = useSettingsStore.getState()
      expect(state.isDirty()).toBe(true)
      expect(state.config.temperature).toBe(0.2)
      expect(state.savedConfig.temperature).toBe(0.7)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeTruthy()
      fetchSpy.mockRestore()
    })

    it('AC-06: saveConfig 期间 isLoading === true', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      let resolvePromise!: (value: Response) => void
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
        new Promise((resolve) => { resolvePromise = resolve }),
      )

      const { saveConfig } = useSettingsStore.getState()
      const savePromise = saveConfig({ temperature: 0.9 })

      expect(useSettingsStore.getState().isLoading).toBe(true)

      resolvePromise(new Response(JSON.stringify({ data: {} }), { status: 200 }))
      await savePromise

      expect(useSettingsStore.getState().isLoading).toBe(false)
      fetchSpy.mockRestore()
    })
  })

  describe('loadConfig', () => {
    it('AC-07: loadConfig 成功 → config + savedConfig 同时更新', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const serverConfig = {
        temperature: 0.5,
        defaultChatProvider: 'openai',
      }
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ data: serverConfig }), { status: 200 }),
      )

      const { loadConfig } = useSettingsStore.getState()
      await loadConfig()

      const state = useSettingsStore.getState()
      expect(state.config.temperature).toBe(0.5)
      expect(state.config.defaultChatProvider).toBe('openai')
      expect(state.config.providers.openai.model).toBe('gpt-4o')
      expect(state.isDirty()).toBe(false)
      expect(state.isLoading).toBe(false)
      fetchSpy.mockRestore()
    })

    it('AC-07: loadConfig 失败 → 不覆盖现有 config + isLoading 恢复为 false', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      )

      const { loadConfig } = useSettingsStore.getState()
      await loadConfig()

      const state = useSettingsStore.getState()
      expect(state.config.temperature).toBe(0.7)
      expect(state.isLoading).toBe(false)
      fetchSpy.mockRestore()
    })

    it('AC-07: loadConfig 期间 isLoading === true', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      let resolvePromise!: (value: Response) => void
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockReturnValueOnce(
        new Promise((resolve) => { resolvePromise = resolve }),
      )

      const { loadConfig } = useSettingsStore.getState()
      const loadPromise = loadConfig()

      expect(useSettingsStore.getState().isLoading).toBe(true)

      resolvePromise(new Response(JSON.stringify({ data: {} }), { status: 200 }))
      await loadPromise

      expect(useSettingsStore.getState().isLoading).toBe(false)
      fetchSpy.mockRestore()
    })
  })
})

describe('SettingsStore — 派生方法（任务 4）', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
  })

  describe('getLLMConfig', () => {
    it('AC-08: 无参数时使用 defaultChatProvider（deepseek）', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const cfg = useSettingsStore.getState().getLLMConfig()
      expect(cfg).not.toBeNull()
      expect(cfg!.provider).toBe('deepseek')
      expect(cfg!.model).toBe('deepseek-chat')
      expect(cfg!.apiKey).toBe('')
    })

    it('AC-08: 指定 openai 返回对应 provider 配置', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const state = useSettingsStore.getState()
      state.updateConfig({
        providers: {
          ...state.config.providers,
          openai: { apiKey: 'sk-xxx', model: 'gpt-4', baseUrl: 'https://api.openai.com' },
        },
      })

      const cfg = useSettingsStore.getState().getLLMConfig('openai')
      expect(cfg).not.toBeNull()
      expect(cfg!.provider).toBe('openai')
      expect(cfg!.model).toBe('gpt-4')
      expect(cfg!.baseUrl).toBe('https://api.openai.com')
      expect(cfg!.apiKey).toBe('sk-xxx')
    })

    it('AC-08: ollama enabled=true 时返回配置', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const state = useSettingsStore.getState()
      state.updateConfig({
        providers: {
          ...state.config.providers,
          ollama: { enabled: true, url: 'http://localhost:11434', model: 'llama3' },
        },
      })

      const cfg = useSettingsStore.getState().getLLMConfig('ollama')
      expect(cfg).not.toBeNull()
      expect(cfg!.provider).toBe('ollama')
      expect(cfg!.model).toBe('llama3')
      expect(cfg!.baseUrl).toBe('http://localhost:11434')
      expect(cfg!.apiKey).toBe('')
    })

    it('AC-08: ollama enabled=false 时返回 null', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const cfg = useSettingsStore.getState().getLLMConfig('ollama')
      expect(cfg).toBeNull()
    })

    it('边界: ollama enabled=true 但 model 为空 → 仍返回配置', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const state = useSettingsStore.getState()
      state.updateConfig({
        providers: {
          ...state.config.providers,
          ollama: { enabled: true, url: 'http://localhost:11434', model: '' },
        },
      })

      const cfg = useSettingsStore.getState().getLLMConfig('ollama')
      expect(cfg).not.toBeNull()
      expect(cfg!.model).toBe('')
    })

    it('边界: 默认 provider 在 providers 中不存在 → 返回 null', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      useSettingsStore.setState({
        config: { ...DEFAULT_CONFIG, defaultChatProvider: 'nonexistent' },
        savedConfig: { ...DEFAULT_CONFIG, defaultChatProvider: 'nonexistent' },
      })

      const cfg = useSettingsStore.getState().getLLMConfig()
      expect(cfg).toBeNull()
    })

    it('边界: 指定不存在的 provider key → 返回 null', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const cfg = useSettingsStore.getState().getLLMConfig('nonexistent')
      expect(cfg).toBeNull()
    })
  })

  describe('configuredProviders', () => {
    it('AC-03: 初始状态无已配置 provider（所有 apiKey 为空）', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const list = useSettingsStore.getState().configuredProviders()
      expect(list).toHaveLength(0)
    })

    it('AC-03: openai 设置 apiKey 后出现在列表中', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const state = useSettingsStore.getState()
      state.updateConfig({
        providers: {
          ...state.config.providers,
          openai: { ...state.config.providers.openai, apiKey: 'sk-xxx' },
        },
      })

      const list = useSettingsStore.getState().configuredProviders()
      expect(list.length).toBeGreaterThanOrEqual(1)
      const openai = list.find((p) => p.key === 'openai')
      expect(openai).toBeDefined()
      expect(openai!.name).toBe('OpenAI')
      expect(openai!.model).toBe('gpt-4o')
    })

    it('AC-03: ollama enabled=true 时出现在列表中', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const state = useSettingsStore.getState()
      state.updateConfig({
        providers: {
          ...state.config.providers,
          ollama: { enabled: true, url: 'http://localhost:11434', model: 'llama3' },
        },
      })

      const list = useSettingsStore.getState().configuredProviders()
      const ollama = list.find((p) => p.key === 'ollama')
      expect(ollama).toBeDefined()
      expect(ollama!.name).toBe('Ollama')
    })

    it('AC-03: ollama enabled=false 时不出现在列表中', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const list = useSettingsStore.getState().configuredProviders()
      const ollama = list.find((p) => p.key === 'ollama')
      expect(ollama).toBeUndefined()
    })

    it('AC-03: 多个 provider 配置后全部列出', async () => {
      const { useSettingsStore } = await import('@/stores/settings')
      const state = useSettingsStore.getState()
      state.updateConfig({
        providers: {
          ...state.config.providers,
          openai: { ...state.config.providers.openai, apiKey: 'sk-1' },
          claude: { ...state.config.providers.claude, apiKey: 'sk-2' },
          ollama: { enabled: true, url: 'http://localhost:11434', model: 'llama3' },
        },
      })

      const list = useSettingsStore.getState().configuredProviders()
      expect(list.length).toBe(3)
      expect(list.map((p) => p.key).sort()).toEqual(['claude', 'ollama', 'openai'])
    })
  })
})

describe('SettingsStore — Persist hydrate 恢复（任务 5）', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
  })

  it('AC-09: localStorage 有完整配置 → hydrate 恢复 config', async () => {
    const storedConfig = {
      state: {
        config: {
          ...DEFAULT_CONFIG,
          temperature: 0.3,
          defaultChatProvider: 'openai',
        },
      },
      version: 0,
    }
    localStorage.setItem('goferbot-settings', JSON.stringify(storedConfig))

    const { useSettingsStore } = await import('@/stores/settings')

    await new Promise<void>((resolve) => {
      const unsub = useSettingsStore.persist.onFinishHydration(() => {
        unsub()
        resolve()
      })
      if (useSettingsStore.persist.hasHydrated()) {
        unsub()
        resolve()
      }
    })

    const state = useSettingsStore.getState()
    expect(state.config.temperature).toBe(0.3)
    expect(state.config.defaultChatProvider).toBe('openai')
  })

  it('AC-09: localStorage 有部分配置 → hydrate 后与 DEFAULT_CONFIG 合并', async () => {
    const partialConfig = {
      state: {
        config: {
          temperature: 0.1,
        },
      },
      version: 0,
    }
    localStorage.setItem('goferbot-settings', JSON.stringify(partialConfig))

    const { useSettingsStore } = await import('@/stores/settings')

    await new Promise<void>((resolve) => {
      const unsub = useSettingsStore.persist.onFinishHydration(() => {
        unsub()
        resolve()
      })
      if (useSettingsStore.persist.hasHydrated()) {
        unsub()
        resolve()
      }
    })

    const state = useSettingsStore.getState()
    expect(state.config.temperature).toBe(0.1)
    expect(state.config.providers.openai.model).toBe('gpt-4o')
  })

  it('AC-09: localStorage 为空 → 使用 DEFAULT_CONFIG', async () => {
    localStorage.removeItem('goferbot-settings')

    const { useSettingsStore } = await import('@/stores/settings')

    await new Promise<void>((resolve) => {
      const unsub = useSettingsStore.persist.onFinishHydration(() => {
        unsub()
        resolve()
      })
      if (useSettingsStore.persist.hasHydrated()) {
        unsub()
        resolve()
      }
    })

    const state = useSettingsStore.getState()
    expect(state.config).toEqual(DEFAULT_CONFIG)
    expect(state.config.temperature).toBe(0.7)
  })

  it('AC-09: localStorage 数据损坏 → 捕获异常，使用 DEFAULT_CONFIG', async () => {
    localStorage.setItem('goferbot-settings', 'invalid-json{{{')

    const { useSettingsStore } = await import('@/stores/settings')

    // Zustand persist 内部 catch JSON parse 错误，hydrate 可能已完成或未触发
    // 使用带超时的等待
    await new Promise<void>((resolve) => {
      if (useSettingsStore.persist.hasHydrated()) {
        resolve()
        return
      }
      const unsub = useSettingsStore.persist.onFinishHydration(() => {
        unsub()
        resolve()
      })
      // 超时保护：500ms 后无论如何继续
      setTimeout(() => {
        unsub()
        resolve()
      }, 500)
    })

    const state = useSettingsStore.getState()
    // 损坏数据时应降级为 DEFAULT_CONFIG
    expect(state.config.temperature).toBe(0.7)
    expect(state.config.providers.openai.model).toBe('gpt-4o')
  }, 10000)

  it('AC-09: hydrate 后 fresh 状态 isDirty() === false', async () => {
    const storedConfig = {
      state: {
        config: { ...DEFAULT_CONFIG, temperature: 0.9 },
      },
      version: 0,
    }
    localStorage.setItem('goferbot-settings', JSON.stringify(storedConfig))

    const { useSettingsStore } = await import('@/stores/settings')

    await new Promise<void>((resolve) => {
      const unsub = useSettingsStore.persist.onFinishHydration(() => {
        unsub()
        resolve()
      })
      if (useSettingsStore.persist.hasHydrated()) {
        unsub()
        resolve()
      }
    })

    const state = useSettingsStore.getState()
    expect(state.isDirty()).toBe(false)
    expect(state.config.temperature).toBe(0.9)
    expect(state.savedConfig.temperature).toBe(0.9)
  })
})
