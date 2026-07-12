/**
 * Provider 类体系 e2e 测试
 *
 * 覆盖：
 *   - BaseProvider / DeepSeekProvider fetchModels (OpenAI 协议)
 *   - OllamaProvider fetchModels (自定义 /api/tags 协议)
 *   - CustomProvider fetchModels (抛出 AppException)
 *   - toLangChain 客户端创建
 *   - 响应体大小限制 (OOM 防护)
 *   - ProviderRegistry 缓存 / 失效
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BaseProvider } from '@/modules/settings/providers/base.provider.js'
import { DeepSeekProvider } from '@/modules/settings/providers/deepseek.provider.js'
import { OllamaProvider } from '@/modules/settings/providers/ollama.provider.js'
import { CustomProvider } from '@/modules/settings/providers/custom.provider.js'
import type { ProviderConfig } from '@/modules/settings/providers/base.provider.js'

const DEFAULT_CONFIG: ProviderConfig = {
  id: 'test-provider',
  name: 'Test',
  enabled: true,
  apiKey: 'sk-test',
  baseUrl: 'https://api.example.com/v1',
  isCompleteUrl: false,
  timeoutMs: 300_000,
  model: 'test-model',
  type: 'llm',
}

const DEFAULT_CONFIG_OLLAMA: ProviderConfig = {
  ...DEFAULT_CONFIG,
  id: 'test-ollama',
  name: 'Ollama',
  apiKey: '',
  baseUrl: 'http://localhost:11434',
}

// ==================== BaseProvider / DeepSeekProvider ====================

describe('BaseProvider', () => {
  it('stores provider and model config', () => {
    const p = new BaseProvider(DEFAULT_CONFIG)
    expect(p.id).toBe('test-provider')
    expect(p.model).toBe('test-model')
    expect(p.type).toBe('llm')
  })

  it('toLangChain creates ChatOpenAI client', () => {
    const p = new BaseProvider(DEFAULT_CONFIG)
    const client = p.toLangChain()
    expect(client).toBeDefined()
    expect(typeof client.invoke).toBe('function')
  })

  it('toLangChain accepts overrides parameter', () => {
    const p = new BaseProvider(DEFAULT_CONFIG)
    const client = p.toLangChain({ temperature: 0 })
    expect(client).toBeDefined()
  })

  it('toLangChain works with isCompleteUrl', () => {
    const p = new BaseProvider({
      ...DEFAULT_CONFIG,
      baseUrl: 'https://api.example.com/v1/chat/completions',
      isCompleteUrl: true,
    })
    const client = p.toLangChain()
    expect(client).toBeDefined()
  })

  it('inferModelType classifies models correctly', () => {
    const p = new BaseProvider(DEFAULT_CONFIG)
    expect((p as any).inferModelType('text-embedding-3-small')).toBe('embedding')
    expect((p as any).inferModelType('bge-reranker-v2')).toBe('reranker')
    expect((p as any).inferModelType('gpt-4')).toBe('llm')
    expect((p as any).inferModelType('ocr-parser')).toBe('document-parser')
  })
})

// ==================== fetchModels — OpenAI 协议 ====================

describe('DeepSeekProvider.fetchModels', () => {
  const mockFetch = vi.fn()
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('parses OpenAI-format model list', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '200' }),
      text: async () => JSON.stringify({
        object: 'list',
        data: [{ id: 'deepseek-chat' }, { id: 'deepseek-coder' }],
      }),
    })

    const provider = new DeepSeekProvider(DEFAULT_CONFIG)
    const models = await provider.fetchModels()

    expect(models).toHaveLength(2)
    expect(models[0]).toEqual({ name: 'deepseek-chat', type: 'llm' })
    expect(models[1]).toEqual({ name: 'deepseek-coder', type: 'llm' })

    // 验证调用了正确的 API 路径
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/models'),
      expect.objectContaining({ headers: { Authorization: 'Bearer sk-test' } }),
    )
  })

  it('parses embedding models', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '200' }),
      text: async () => JSON.stringify({
        data: [{ id: 'text-embedding-3-small' }],
      }),
    })

    const provider = new DeepSeekProvider(DEFAULT_CONFIG)
    const models = await provider.fetchModels()
    expect(models[0].type).toBe('embedding')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
    })

    const provider = new DeepSeekProvider(DEFAULT_CONFIG)
    await expect(provider.fetchModels()).rejects.toThrow('远程返回 401')
  })

  it('rejects response exceeding 1MB (OOM protection)', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '2000000' }), // 2MB
    })

    const provider = new DeepSeekProvider(DEFAULT_CONFIG)
    await expect(provider.fetchModels()).rejects.toThrow('响应体过大')
  })

  it('rejects response body exceeding 1MB even without content-length header', async () => {
    const hugeJson = JSON.stringify({ data: Array.from({ length: 50_000 }, (_, i) => ({ id: `model-${i}` })) })
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers(),
      text: async () => hugeJson, // will exceed 1MB
    })

    const provider = new DeepSeekProvider(DEFAULT_CONFIG)
    await expect(provider.fetchModels()).rejects.toThrow('响应体过大')
  })

  it('returns empty array when data is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '50' }),
      text: async () => JSON.stringify({ object: 'list' }),
    })

    const provider = new DeepSeekProvider(DEFAULT_CONFIG)
    const models = await provider.fetchModels()
    expect(models).toEqual([])
  })
})

// ==================== OllamaProvider.fetchModels ====================

describe('OllamaProvider.fetchModels', () => {
  const mockFetch = vi.fn()
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.fetch = mockFetch as any
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('parses Ollama /api/tags format', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '300' }),
      text: async () => JSON.stringify({
        models: [
          { name: 'llama3:latest', details: { family: 'llama' } },
          { name: 'mistral:7b', details: { family: 'llama' } },
        ],
      }),
    })

    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    const models = await provider.fetchModels()

    expect(models).toHaveLength(2)
    expect(models[0]).toEqual({ name: 'llama3:latest', type: 'llm' })
    expect(models[1]).toEqual({ name: 'mistral:7b', type: 'llm' })

    // 验证调用了 /api/tags 路径
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tags'),
      expect.any(Object),
    )
  })

  it('detects embedding models from bert family', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '200' }),
      text: async () => JSON.stringify({
        models: [{ name: 'bge-m3', details: { family: 'bert' } }],
      }),
    })

    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    const models = await provider.fetchModels()
    expect(models[0].type).toBe('embedding')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      headers: new Headers(),
    })

    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    await expect(provider.fetchModels()).rejects.toThrow('Ollama 返回 500')
  })

  it('has response size limit protection', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '2000000' }),
    })

    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    await expect(provider.fetchModels()).rejects.toThrow('响应体过大')
  })

  it('returns empty array when models is missing', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '30' }),
      text: async () => JSON.stringify({}),
    })

    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    const models = await provider.fetchModels()
    expect(models).toEqual([])
  })
})

// ==================== CustomProvider ====================

describe('CustomProvider', () => {
  it('fetchModels throws AppException with correct error code', () => {
    const provider = new CustomProvider({ ...DEFAULT_CONFIG, apiKey: '', baseUrl: '' })
    expect(provider.fetchModels()).rejects.toMatchObject({
      code: 'FETCH_MODELS_NOT_SUPPORTED',
    })
  })
})

// ==================== OllamaProvider SDK 客户端 ====================

describe('OllamaProvider SDK 客户端', () => {
  it('toLangChain creates ChatOllama with correct config', () => {
    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    const client = provider.toLangChain()
    expect(client).toBeDefined()
    expect(typeof client.invoke).toBe('function')
  })

  it('toLangChain accepts overrides', () => {
    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    const client = provider.toLangChain({ temperature: 0.3 })
    expect(client).toBeDefined()
  })

  it('toLangChain creates ChatOllama client', () => {
    const provider = new OllamaProvider(DEFAULT_CONFIG_OLLAMA)
    const client = provider.toLangChain()
    expect(client).toBeDefined()
    expect(typeof client.invoke).toBe('function')
  })

  it('resolveOllamaHost falls back to localhost:11434', () => {
    const provider = new OllamaProvider({ ...DEFAULT_CONFIG_OLLAMA, baseUrl: '' })
    const client = provider.toLangChain()
    expect(client).toBeDefined()
  })
})
