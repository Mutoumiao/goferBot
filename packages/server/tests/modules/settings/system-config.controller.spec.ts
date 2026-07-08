/**
 * SystemConfigController e2e 测试
 *
 * 验证修改后的接口行为：
 *   1. GET  /admin/providers/presets     → 返回 hasFetchModels 字段
 *   2. POST /admin/providers/fetch-models → 接收 presetKey，返回 { models }
 *   3. POST /admin/system-config/reload   → 返回 void（不再返回 { success: true }）
 *   4. DELETE /admin/providers/:id        → 返回 void（不再返回 { success: true }）
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ConfigCryptoService } from '@/modules/settings/config-crypto.service.js'
import { ProviderRegistry } from '@/modules/settings/providers/index.js'
import { SystemConfigController } from '@/modules/settings/system-config.controller.js'
import { SystemConfigService } from '@/modules/settings/system-config.service.js'

function createMockSystemConfigService(overrides = {}) {
  return {
    getSystemConfig: vi.fn().mockResolvedValue({}),
    getSystemCategory: vi.fn().mockResolvedValue({}),
    saveSystemCategory: vi.fn().mockResolvedValue({}),
    reloadModels: vi.fn().mockResolvedValue(undefined),
    getProviders: vi.fn().mockResolvedValue({}),
    getProvider: vi.fn().mockResolvedValue({ id: 'p1', name: 'Test' }),
    saveProvider: vi.fn().mockImplementation((dto: any) => Promise.resolve({ ...dto, id: dto.id || 'p1' })),
    deleteProvider: vi.fn().mockResolvedValue(undefined),
    getPresets: vi.fn().mockReturnValue([
      { key: 'deepseek', label: 'DeepSeek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
      { key: 'ollama', label: 'Ollama (本地)', name: 'Ollama', baseUrl: 'http://localhost:11434/v1' },
      { key: 'custom', label: '自定义配置', name: '', baseUrl: '' },
    ]),
    ...overrides,
  }
}

function createMockCrypto(overrides = {}) {
  return {
    maskObject: vi.fn().mockImplementation((obj: any) => obj),
    ...overrides,
  }
}

function createMockProviderRegistry(overrides = {}) {
  return {
    createFromPreset: vi.fn().mockImplementation((_presetKey: string) => ({
      fetchModels: vi.fn().mockResolvedValue([
        { name: 'model-a', type: 'llm', dimensions: undefined, maxLength: undefined },
        { name: 'text-embed', type: 'embedding', dimensions: 1536, maxLength: undefined },
      ]),
    })),
    get: vi.fn(),
    invalidate: vi.fn(),
    invalidateAll: vi.fn(),
    ...overrides,
  }
}

describe('SystemConfigController', () => {
  let controller: SystemConfigController
  let systemConfigService: ReturnType<typeof createMockSystemConfigService>
  let registry: ReturnType<typeof createMockProviderRegistry>

  beforeEach(() => {
    vi.clearAllMocks()
    const crypto = createMockCrypto()
    systemConfigService = createMockSystemConfigService()
    registry = createMockProviderRegistry()
    controller = new SystemConfigController(
      systemConfigService as unknown as SystemConfigService,
      crypto as unknown as ConfigCryptoService,
      registry as unknown as ProviderRegistry,
    )
  })

  // ==================== GET /admin/providers/presets ====================

  describe('GET /admin/providers/presets', () => {
    it('returns presets with hasFetchModels field', () => {
      const result = controller.getPresets()

      expect(result).toHaveLength(3)
      expect(result[0]).toMatchObject({
        key: 'deepseek',
        label: 'DeepSeek',
        hasFetchModels: true,
      })
      expect(result[1].hasFetchModels).toBe(true)  // ollama
      expect(result[2].hasFetchModels).toBe(false) // custom
    })

    it('custom preset has hasFetchModels = false', () => {
      const result = controller.getPresets()
      const custom = result.find((p) => p.key === 'custom')
      expect(custom?.hasFetchModels).toBe(false)
    })

    it('built-in presets have hasFetchModels = true', () => {
      const result = controller.getPresets()
      const builtIn = result.filter((p) => p.key !== 'custom')
      expect(builtIn.length).toBe(2)
      builtIn.forEach((p) => {
        expect(p.hasFetchModels).toBe(true)
      })
    })
  })

  // ==================== POST /admin/providers/fetch-models ====================

  describe('POST /admin/providers/fetch-models', () => {
    it('passes presetKey, baseUrl, apiKey to ProviderRegistry.createFromPreset', async () => {
      const dto = { presetKey: 'deepseek' as const, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'sk-test' }

      const result = await controller.fetchModels(dto)

      expect(registry.createFromPreset).toHaveBeenCalledWith('deepseek', 'https://api.deepseek.com/v1', 'sk-test')
      expect(result).toEqual({ models: expect.any(Array) })
    })

    it('returns { models } array — ResponseInterceptor wraps to { success, data: { models }, meta }', async () => {
      const dto = { presetKey: 'deepseek' as const, baseUrl: 'https://api.deepseek.com/v1', apiKey: 'sk-test' }

      const result = await controller.fetchModels(dto)

      expect(result).toHaveProperty('models')
      expect(result).not.toHaveProperty('success')
      expect(result).not.toHaveProperty('error')
      expect(Array.isArray(result.models)).toBe(true)
    })

    it('returns model list with correct FetchedModel shape', async () => {
      const dto = { presetKey: 'deepseek' as const, baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test' }

      const result = await controller.fetchModels(dto)

      expect(result.models).toHaveLength(2)
      expect(result.models[0]).toEqual({
        name: 'model-a',
        type: 'llm',
        dimensions: undefined,
        maxLength: undefined,
      })
      expect(result.models[1]).toEqual({
        name: 'text-embed',
        type: 'embedding',
        dimensions: 1536,
        maxLength: undefined,
      })
    })

    it('supports ollama presetKey', async () => {
      const dto = { presetKey: 'ollama' as const, baseUrl: 'http://localhost:11434', apiKey: '' }

      const result = await controller.fetchModels(dto)

      expect(registry.createFromPreset).toHaveBeenCalledWith('ollama', 'http://localhost:11434', '')
      expect(result.models).toBeDefined()
    })
  })

  // ==================== POST /admin/system-config/reload ====================

  describe('POST /admin/system-config/reload', () => {
    it('returns void — does not return { success: true }', async () => {
      const result = await controller.reloadModels()

      expect(result).toBeUndefined()
      expect(systemConfigService.reloadModels).toHaveBeenCalled()
    })
  })

  // ==================== DELETE /admin/providers/:id ====================

  describe('DELETE /admin/providers/:id', () => {
    it('returns void — does not return { success: true }', async () => {
      const result = await controller.deleteProvider('p1')

      expect(result).toBeUndefined()
      expect(systemConfigService.deleteProvider).toHaveBeenCalledWith('p1')
    })

    it('delegates to systemConfigService.deleteProvider', async () => {
      await controller.deleteProvider('my-provider')

      expect(systemConfigService.deleteProvider).toHaveBeenCalledWith('my-provider')
    })
  })

  // ==================== 响应格式合规性 ====================

  describe('Response envelope compliance', () => {
    it('fetchModels 返回纯业务数据，无 success/error 字段', async () => {
      const result = await controller.fetchModels({
        presetKey: 'deepseek' as const,
        baseUrl: 'https://api.example.com/v1',
        apiKey: 'sk-test',
      })

      expect(Object.keys(result)).toEqual(['models'])
    })

    it('reloadModels 返回 void，由 ResponseInterceptor 注入 success + meta', async () => {
      const result = await controller.reloadModels()
      expect(result).toBeUndefined()
    })

    it('deleteProvider 返回 void，由 ResponseInterceptor 注入 success + meta', async () => {
      const result = await controller.deleteProvider('p1')
      expect(result).toBeUndefined()
    })
  })
})
